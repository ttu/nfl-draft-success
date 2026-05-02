import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
} from 'react';
import {
  Routes,
  Route,
  useParams,
  useSearchParams,
  useNavigate,
  useMatch,
} from 'react-router-dom';
import { AppHeader } from './components/layout/AppHeader';
import { LoadingSpinner } from './components/layout/LoadingSpinner';
import { roleFilterAllows, DEFAULT_ROLE_FILTER } from './lib/roleFilter';
import { getPlayerRole } from './lib/getPlayerRole';
import {
  loadDataForYears,
  loadDefaultRankings,
  loadDataMeta,
} from './lib/loadData';
import { formatDataLastUpdatedDate } from './lib/formatDataLastUpdated';
import { isDraftPickRetainedForRoster } from './lib/draftPickLatestSeason';
import {
  getRollingDraftScore,
  type RollingDraftScore,
} from './lib/getRollingDraftScore';
import {
  collectDraftPositions,
  resolveCanonicalPosition,
} from './lib/positionDraft';
import {
  loadRoleFilter,
  saveRoleFilter,
  loadShowDeparted,
  saveShowDeparted,
  loadLandingIntroDismissed,
  saveLandingIntroDismissed,
} from './lib/storage';
import { TEAMS } from './data/teams';
import { getTeamDepthChartUrl } from './data/teamColors';
import {
  type DraftClass,
  type DefaultRankingsData,
  type Role,
  ActiveView,
} from './types';
import './App.css';

import type { TeamRanking } from './components/draft/RollingDraftScoreCard';

import { TeamRankingsView } from './components/views/team/TeamRankingsView';
import { SiteIntroBanner } from './components/layout/SiteIntroBanner';
import { Footer } from './components/layout/Footer';
import type { RosterPick } from './components/views/team/TeamDetailContent';

const InfoView = lazy(() =>
  import('./components/layout/InfoView').then((m) => ({
    default: m.InfoView,
  })),
);
const TeamDetailContent = lazy(() =>
  import('./components/views/team/TeamDetailContent').then((m) => ({
    default: m.TeamDetailContent,
  })),
);
const YearDraftView = lazy(() =>
  import('./components/views/draft-year/YearDraftView').then((m) => ({
    default: m.YearDraftView,
  })),
);
const PositionDraftView = lazy(() =>
  import('./components/views/position/PositionDraftView').then((m) => ({
    default: m.PositionDraftView,
  })),
);

const YEAR_MIN = 2018;
const YEAR_MAX = 2026;
const DEFAULT_YEAR_MIN = 2021;

const validTeamIds = new Set(TEAMS.map((t) => t.id));
const yearBounds = { min: YEAR_MIN, max: YEAR_MAX };

/** Placeholder “data last updated” until `loadDataMeta` resolves (Unix epoch UTC). */
const MIN_DATETIME_ISO = '1970-01-01T00:00:00.000Z';

/**
 * When `forcedSingleYear` is set ( /year/:y route ), use that range only and do not
 * overwrite missing query params with defaults (avoids clobbering /year/2020 ).
 */
function useResolvedYearRange(
  forcedSingleYear: number | null,
  searchParams: URLSearchParams,
  setSearchParams: (params: Record<string, string>) => void,
): { startYear: number; endYear: number } {
  const from = parseInt(searchParams.get('from') ?? '', 10);
  const to = parseInt(searchParams.get('to') ?? '', 10);
  const valid =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= yearBounds.min &&
    to <= yearBounds.max &&
    from <= to;

  const correctedRef = useRef(false);
  useEffect(() => {
    if (forcedSingleYear != null) {
      return;
    }
    if (!valid && !correctedRef.current) {
      correctedRef.current = true;
      setSearchParams({
        from: String(DEFAULT_YEAR_MIN),
        to: String(YEAR_MAX),
      });
    }
  }, [valid, setSearchParams, forcedSingleYear]);

  if (
    forcedSingleYear != null &&
    forcedSingleYear >= yearBounds.min &&
    forcedSingleYear <= yearBounds.max
  ) {
    return { startYear: forcedSingleYear, endYear: forcedSingleYear };
  }

  return valid
    ? { startYear: from, endYear: to }
    : { startYear: DEFAULT_YEAR_MIN, endYear: YEAR_MAX };
}

/** Path params from `/:teamId` and `/year/:draftYear` in this file’s `Routes`. */
type AppRouteParams = {
  teamId?: string;
  draftYear?: string;
};

/**
 * Resolves `/position/:position` from `useMatch` — decodes the segment for display/routing.
 */
function getPositionParam(match: { params: { position?: string } } | null): {
  isPositionView: boolean;
  positionParam: string | undefined;
} {
  if (match == null) {
    return { isPositionView: false, positionParam: undefined };
  }
  const raw = match.params.position;
  return {
    isPositionView: true,
    positionParam: raw != null ? decodeURIComponent(raw) : undefined,
  };
}

function AppContent() {
  const { teamId, draftYear: draftYearParam } = useParams<AppRouteParams>();
  const positionMatch = useMatch('/position/:position');
  const { isPositionView, positionParam } = getPositionParam(positionMatch);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const parsedRouteYear =
    draftYearParam != null ? parseInt(draftYearParam, 10) : NaN;
  const routeYearValid =
    Number.isInteger(parsedRouteYear) &&
    parsedRouteYear >= YEAR_MIN &&
    parsedRouteYear <= YEAR_MAX;
  const isYearView = draftYearParam !== undefined && routeYearValid;
  const forcedSingleYear = isYearView ? parsedRouteYear : null;

  const selectedTeam = teamId && validTeamIds.has(teamId) ? teamId : null;

  const activeView = isYearView
    ? ActiveView.DraftYears
    : isPositionView
      ? ActiveView.Position
      : selectedTeam
        ? ActiveView.TeamDetail
        : ActiveView.TeamRankings;

  useLayoutEffect(() => {
    if (draftYearParam !== undefined && !routeYearValid) {
      navigate(`/year/${YEAR_MAX}`, { replace: true });
    }
  }, [draftYearParam, routeYearValid, navigate]);

  const { startYear, endYear } = useResolvedYearRange(
    forcedSingleYear,
    searchParams,
    setSearchParams,
  );
  const yearCount = endYear - startYear + 1;

  const [roleFilter, setRoleFilter] = useState<Set<Role>>(() => {
    const stored = loadRoleFilter();
    return (
      stored?.length ? new Set(stored) : new Set(DEFAULT_ROLE_FILTER)
    ) as Set<Role>;
  });
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const [defaultRankings, setDefaultRankings] =
    useState<DefaultRankingsData | null>(null);
  const [showLandingIntro, setShowLandingIntro] = useState(
    () => !loadLandingIntroDismissed(),
  );
  const [showInfoView, setShowInfoView] = useState(false);
  const [dataLastUpdatedDate, setDataLastUpdatedDate] = useState(() =>
    formatDataLastUpdatedDate(MIN_DATETIME_ISO),
  );
  const [showDeparted, setShowDeparted] = useState(() => loadShowDeparted());

  const positionOptions = useMemo(
    () => collectDraftPositions(draftClasses),
    [draftClasses],
  );

  const canonicalPosition =
    positionParam != null && positionOptions.length > 0
      ? resolveCanonicalPosition(positionOptions, positionParam)
      : null;

  useLayoutEffect(() => {
    if (!isPositionView || loading || draftClasses.length === 0) return;
    if (positionParam == null || positionParam.trim() === '') {
      navigate('/', { replace: true });
      return;
    }
    if (positionOptions.length === 0) return;
    if (canonicalPosition != null) return;
    const fallback = positionOptions.includes('QB') ? 'QB' : positionOptions[0];
    navigate(
      {
        pathname: `/position/${encodeURIComponent(fallback)}`,
        search: searchParams.toString(),
      },
      { replace: true },
    );
  }, [
    isPositionView,
    loading,
    draftClasses.length,
    positionParam,
    positionOptions,
    canonicalPosition,
    navigate,
    searchParams,
  ]);

  useEffect(() => {
    saveRoleFilter(Array.from(roleFilter));
  }, [roleFilter]);

  useEffect(() => {
    saveShowDeparted(showDeparted);
  }, [showDeparted]);

  useEffect(() => {
    loadDefaultRankings()
      .then(setDefaultRankings)
      .catch(() => {
        // Silently fail — falls back to full data load
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadDataMeta().then((meta) => {
      if (cancelled || !meta?.lastUpdated) return;
      const label = formatDataLastUpdatedDate(meta.lastUpdated);
      if (label) setDataLastUpdatedDate(label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleYearRangeChange = (range: [number, number]) => {
    if (isYearView) {
      if (range[0] === range[1]) {
        navigate(`/year/${range[0]}`);
      } else {
        navigate(`/?from=${range[0]}&to=${range[1]}`);
      }
      return;
    }
    setSearchParams({ from: String(range[0]), to: String(range[1]) });
  };

  const draftPickYear = Math.min(
    YEAR_MAX,
    Math.max(YEAR_MIN, isYearView ? parsedRouteYear : endYear),
  );

  const handleDraftPickYear = (year: number) => {
    navigate(`/year/${year}`);
  };

  const handleDismissLandingIntro = () => {
    setShowLandingIntro(false);
    saveLandingIntroDismissed(true);
  };

  const handleTeamSelect = (team: string) => {
    navigate(`/${team}?from=${startYear}&to=${endYear}`);
  };

  const handleShowRankings = () => {
    navigate(`/?from=${startYear}&to=${endYear}`);
  };

  const positionBrowseSearch = new URLSearchParams({
    from: String(startYear),
    to: String(endYear),
  }).toString();

  const handlePositionChange = (pos: string) => {
    const search =
      searchParams.toString() ||
      new URLSearchParams({
        from: String(startYear),
        to: String(endYear),
      }).toString();
    navigate({
      pathname: `/position/${encodeURIComponent(pos)}`,
      search,
    });
  };

  useEffect(() => {
    let cancelled = false;
    let showLoadingId: ReturnType<typeof setTimeout> | null = null;
    const loadId = (loadIdRef.current += 1);
    const delayBeforeShowMs = 50;
    queueMicrotask(() => setError(null));
    showLoadingId = setTimeout(() => {
      if (!cancelled && loadIdRef.current === loadId) {
        setLoading(true);
      }
    }, delayBeforeShowMs);
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i,
    );
    loadDataForYears(years)
      .then((data) => {
        if (!cancelled) setDraftClasses(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (showLoadingId) {
          clearTimeout(showLoadingId);
          showLoadingId = null;
        }
        if (!cancelled && loadIdRef.current === loadId) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (showLoadingId) clearTimeout(showLoadingId);
    };
  }, [startYear, endYear]);

  const draftingTeamOnly = true;
  const rollingDraftScore =
    draftClasses.length > 0 && selectedTeam
      ? getRollingDraftScore(draftClasses, selectedTeam, { draftingTeamOnly })
      : null;

  const teamRank =
    draftClasses.length > 0
      ? (() => {
          const teamScores = TEAMS.map((t) => ({
            teamId: t.id,
            teamName: t.name,
            score: getRollingDraftScore(draftClasses, t.id, {
              draftingTeamOnly,
            }).score,
          }));
          teamScores.sort((a, b) => b.score - a.score);
          const rankings: Array<{
            teamId: string;
            teamName: string;
            score: number;
            rank: number;
          }> = [];
          let rank = 1;
          let prevScore = Infinity;
          let selectedRank = 0;
          for (let i = 0; i < teamScores.length; i++) {
            if (teamScores[i].score < prevScore) rank = i + 1;
            prevScore = teamScores[i].score;
            rankings.push({
              ...teamScores[i],
              rank,
            });
            if (teamScores[i].teamId === selectedTeam) selectedRank = rank;
          }
          return {
            rank: selectedRank,
            total: TEAMS.length,
            rankings,
          };
        })()
      : null;

  const allTeamPicks = draftClasses.flatMap((dc) =>
    dc.picks
      .filter((p) => p.teamId === selectedTeam)
      .map((p) => ({ pick: p, draftYear: dc.year })),
  );
  allTeamPicks.sort(
    (a, b) =>
      a.draftYear - b.draftYear || a.pick.overallPick - b.pick.overallPick,
  );

  const rosterPicks = showDeparted
    ? allTeamPicks
    : allTeamPicks.filter(({ pick }) => isDraftPickRetainedForRoster(pick));

  const filteredRosterPicks = rosterPicks.filter(
    ({ pick }) =>
      pick.seasons.length === 0 ||
      roleFilterAllows(roleFilter, getPlayerRole(pick, { draftingTeamOnly })),
  );

  const rosterByDraftYear = (() => {
    const byYear = new Map<number, typeof filteredRosterPicks>();
    for (const item of filteredRosterPicks) {
      const list = byYear.get(item.draftYear) ?? [];
      list.push(item);
      byYear.set(item.draftYear, list);
    }
    return draftClasses
      .map((dc) => ({ year: dc.year, picks: byYear.get(dc.year) ?? [] }))
      .filter((g) => g.picks.length > 0);
  })();

  const selectedTeamData = selectedTeam
    ? TEAMS.find((t) => t.id === selectedTeam)
    : undefined;
  const depthChartUrl =
    selectedTeam && selectedTeamData
      ? getTeamDepthChartUrl(selectedTeam, selectedTeamData.name)
      : null;

  return (
    <main className="app">
      <AppHeader
        activeView={activeView}
        selectedTeam={selectedTeam}
        draftPickYear={draftPickYear}
        onDraftPickYear={handleDraftPickYear}
        yearRange={[startYear, endYear]}
        onShowRankings={handleShowRankings}
        onTeamSelect={handleTeamSelect}
        onYearRangeChange={handleYearRangeChange}
        onShowInfo={() => setShowInfoView(true)}
        positionBrowseSearch={positionBrowseSearch}
        positionOptions={positionOptions}
        selectedPosition={canonicalPosition}
        onPositionChange={handlePositionChange}
        dataLastUpdatedDate={dataLastUpdatedDate}
      />
      {activeView === ActiveView.TeamRankings && showLandingIntro && (
        <SiteIntroBanner onDismiss={handleDismissLandingIntro} />
      )}

      {getMainContent(
        activeView,
        loading,
        defaultRankings,
        yearCount,
        selectedTeam,
        handleTeamSelect,
        handleShowRankings,
        teamRank,
        rollingDraftScore,
        draftClasses,
        draftingTeamOnly,
        roleFilter,
        setRoleFilter,
        rosterByDraftYear,
        depthChartUrl,
        showDeparted,
        setShowDeparted,
        canonicalPosition,
        startYear,
        endYear,
      )}

      {showInfoView && (
        <Suspense fallback={null}>
          <InfoView
            onClose={() => setShowInfoView(false)}
            dataLastUpdatedDate={dataLastUpdatedDate}
          />
        </Suspense>
      )}
      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}
      <Footer />
    </main>
  );
}

const getMainContent = (
  activeView: ActiveView,
  loading: boolean,
  defaultRankings: DefaultRankingsData | null,
  yearCount: number,
  selectedTeam: string | null,
  handleTeamSelect: (team: string) => void,
  handleShowRankings: () => void,
  teamRank: { rank: number; total: number; rankings: TeamRanking[] } | null,
  rollingDraftScore: RollingDraftScore | null,
  draftClasses: DraftClass[],
  draftingTeamOnly: boolean,
  roleFilter: Set<Role>,
  setRoleFilter: (value: Set<Role>) => void,
  rosterByDraftYear: { year: number; picks: RosterPick[] }[],
  depthChartUrl: string | null,
  showDeparted: boolean,
  setShowDeparted: (value: boolean) => void,
  canonicalPosition: string | null,
  startYear: number,
  endYear: number,
) => {
  const showTeamRankingsWithDefaultRankings =
    activeView === ActiveView.TeamRankings && loading && defaultRankings;
  if (showTeamRankingsWithDefaultRankings) {
    return (
      <TeamRankingsView
        rankings={defaultRankings.rankings}
        yearCount={yearCount}
        onTeamSelect={handleTeamSelect}
        onBack={selectedTeam ? handleShowRankings : undefined}
      />
    );
  }

  const showTeamRankings =
    activeView === ActiveView.TeamRankings && !loading && teamRank?.rankings;
  if (showTeamRankings) {
    return (
      <TeamRankingsView
        rankings={teamRank.rankings}
        yearCount={yearCount}
        onTeamSelect={handleTeamSelect}
        onBack={selectedTeam ? handleShowRankings : undefined}
      />
    );
  }

  if (
    activeView === ActiveView.TeamDetail &&
    !loading &&
    rollingDraftScore &&
    selectedTeam
  ) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <TeamDetailContent
          rollingDraftScore={rollingDraftScore}
          yearCount={yearCount}
          teamRank={teamRank}
          onShowRankings={handleShowRankings}
          draftClasses={draftClasses}
          selectedTeam={selectedTeam}
          draftingTeamOnly={draftingTeamOnly}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          rosterByDraftYear={rosterByDraftYear}
          depthChartUrl={depthChartUrl}
          showDeparted={showDeparted}
          setShowDeparted={setShowDeparted}
        />
      </Suspense>
    );
  }
  if (activeView === ActiveView.DraftYears && draftClasses.length === 1) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <YearDraftView
          draftClass={draftClasses[0]}
          draftingTeamOnly={draftingTeamOnly}
          onShowRankings={handleShowRankings}
        />
      </Suspense>
    );
  }

  if (
    activeView === ActiveView.Position &&
    canonicalPosition &&
    draftClasses.length > 0
  ) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <PositionDraftView
          position={canonicalPosition}
          yearFrom={startYear}
          yearTo={endYear}
          draftClasses={draftClasses}
          draftingTeamOnly={draftingTeamOnly}
          onShowRankings={handleShowRankings}
        />
      </Suspense>
    );
  }

  return <LoadingSpinner message="Loading draft data…" />;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/position/:position" element={<AppContent />} />
      <Route path="/year/:draftYear" element={<AppContent />} />
      <Route path="/:teamId" element={<AppContent />} />
    </Routes>
  );
}

export default App;
