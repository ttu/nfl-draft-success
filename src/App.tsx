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
  type SetURLSearchParams,
} from 'react-router-dom';
import { Masthead, type MastheadTab } from './components/layout/Masthead';
import { Subbar, Chip, YearRangeChips } from './components/layout/Subbar';
import { LoadingSpinner } from './components/layout/LoadingSpinner';
import { DEFAULT_ROLE_FILTER } from './lib/roleFilter';
import {
  loadDataForYears,
  loadDefaultRankings,
  loadDataMeta,
} from './lib/loadData';
import { formatDataLastUpdatedDate } from './lib/formatDataLastUpdated';
import { getRosterByDraftYear } from './lib/getRosterByDraftYear';
import { getTeamRankSummary } from './lib/getTeamRankSummary';
import { getLeagueContext, type LeagueContext } from './lib/getLeagueContext';
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
  loadDarkMode,
  saveDarkMode,
} from './lib/storage';
import { TEAMS } from './data/teams';
import { getTeamDepthChartUrl } from './data/teamColors';
import {
  type DraftClass,
  type DraftPick,
  type DefaultRankingsData,
  type Role,
  ActiveView,
} from './types';
import {
  resolveYearRange,
  clampYear,
  generateYearArray,
} from './lib/yearRange';
import {
  parsePositionParam,
  determineActiveView,
  isRouteYearValid,
} from './lib/viewRouter';
import {
  resolvePlayerBackTarget,
  resolvePlayerOriginTab,
} from './lib/playerBackTarget';
import './App.css';

import type { TeamRanking } from './lib/getRollingDraftScore';

import { TeamRankingsView } from './components/views/team/TeamRankingsView';
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
const PlayerDetailView = lazy(() =>
  import('./components/views/player/PlayerDetailView').then((m) => ({
    default: m.PlayerDetailView,
  })),
);

const YEAR_MIN = 2018;
const YEAR_MAX = 2026;
const DEFAULT_YEAR_MIN = 2021;
// The newest draft class (YEAR_MAX) has not played a full season yet, so the
// last *completed* season is the year before it. Drives the "Last 3 yr" preset.
const LATEST_COMPLETED_YEAR = YEAR_MAX - 1;

const validTeamIds = new Set(TEAMS.map((t) => t.id));
const yearBounds = { min: YEAR_MIN, max: YEAR_MAX };
const MIN_DATETIME_ISO = '1970-01-01T00:00:00.000Z';

/** Masthead tab that owns each non-player view. */
const ACTIVE_VIEW_TAB: Record<ActiveView, MastheadTab> = {
  [ActiveView.TeamRankings]: 'rankings',
  [ActiveView.TeamDetail]: 'team',
  [ActiveView.DraftYears]: 'year',
  [ActiveView.Position]: 'pos',
};

function useResolvedYearRange(
  forcedSingleYear: number | null,
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
): { startYear: number; endYear: number } {
  const { range, needsCorrection } = resolveYearRange(
    searchParams.get('from'),
    searchParams.get('to'),
    forcedSingleYear,
    yearBounds,
    { startYear: DEFAULT_YEAR_MIN, endYear: LATEST_COMPLETED_YEAR },
  );
  const correctedRef = useRef(false);
  useEffect(() => {
    if (!needsCorrection || correctedRef.current) return;
    correctedRef.current = true;
    // Merge onto existing params so a range correction never drops unrelated
    // params (e.g. the player detail `ref` origin crumb).
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', String(DEFAULT_YEAR_MIN));
      next.set('to', String(LATEST_COMPLETED_YEAR));
      return next;
    });
  }, [needsCorrection, setSearchParams]);
  return range;
}

/** Dark-mode toggle, persisted to storage and reflected on `<html data-dark>`. */
function useDarkMode(): [boolean, (updater: (v: boolean) => boolean) => void] {
  const [dark, setDark] = useState(() => loadDarkMode());
  useEffect(() => {
    document.documentElement.dataset.dark = String(dark);
    saveDarkMode(dark);
  }, [dark]);
  return [dark, setDark];
}

/**
 * Loads the draft classes for a year range. Uses a monotonic load id so a slow
 * in-flight request can't overwrite the result of a newer one, and only shows
 * the spinner if a load runs longer than 50ms (avoids a flash on fast loads).
 */
function useDraftClassLoader(
  startYear: number,
  endYear: number,
): { draftClasses: DraftClass[]; loading: boolean; error: string | null } {
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let showLoadingId: ReturnType<typeof setTimeout> | null = null;
    const loadId = (loadIdRef.current += 1);
    queueMicrotask(() => setError(null));
    showLoadingId = setTimeout(() => {
      if (!cancelled && loadIdRef.current === loadId) setLoading(true);
    }, 50);
    const years = generateYearArray(startYear, endYear);
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
        if (!cancelled && loadIdRef.current === loadId) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (showLoadingId) clearTimeout(showLoadingId);
    };
  }, [startYear, endYear]);

  return { draftClasses, loading, error };
}

/**
 * Resolves the pick for the player detail view. When the player isn't in the
 * current range's classes, loads every year on demand so the detail view (and
 * its position cohort) still has data; that all-years set is reset once the
 * player is found in-range again.
 */
function usePlayerLookup(
  isPlayerView: boolean,
  playerId: string | undefined,
  draftClasses: DraftClass[],
): {
  playerLookupClasses: DraftClass[];
  playerInfo: { pick: DraftPick; draftYear: number } | null;
} {
  const [playerSearchClasses, setPlayerSearchClasses] = useState<
    DraftClass[] | null
  >(null);

  useEffect(() => {
    if (!isPlayerView || !playerId) return;
    const found = draftClasses.some((dc) =>
      dc.picks.some((p) => p.playerId === playerId),
    );
    if (found) {
      // Player is in the current range: clear any all-years data fetched for a
      // previously-viewed out-of-range player. A one-time reset, not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlayerSearchClasses(null);
      return;
    }
    let cancelled = false;
    const years = generateYearArray(YEAR_MIN, YEAR_MAX);
    loadDataForYears(years)
      .then((all) => {
        if (!cancelled) setPlayerSearchClasses(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPlayerView, playerId, draftClasses]);

  const playerLookupClasses = playerSearchClasses ?? draftClasses;
  let playerInfo: { pick: DraftPick; draftYear: number } | null = null;
  if (isPlayerView && playerId) {
    for (const dc of playerLookupClasses) {
      const found = dc.picks.find((p) => p.playerId === playerId);
      if (found) {
        playerInfo = { pick: found, draftYear: dc.year };
        break;
      }
    }
  }

  return { playerLookupClasses, playerInfo };
}

type AppRouteParams = {
  teamId?: string;
  draftYear?: string;
  playerId?: string;
};

function AppContent() {
  const {
    teamId,
    draftYear: draftYearParam,
    playerId,
  } = useParams<AppRouteParams>();
  const positionMatch = useMatch('/position/:position');
  const { isPositionView, positionParam } = parsePositionParam(positionMatch);
  const playerMatch = useMatch('/player/:playerId');
  const isPlayerView = !!playerMatch && !!playerId;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const routeYearValid = isRouteYearValid(draftYearParam, yearBounds);
  const isYearView = draftYearParam !== undefined && routeYearValid;
  const forcedSingleYear = isYearView ? parseInt(draftYearParam, 10) : null;

  const selectedTeam = teamId && validTeamIds.has(teamId) ? teamId : null;

  const activeView = determineActiveView({
    isYearView,
    isPositionView,
    hasSelectedTeam: selectedTeam != null,
  });

  const [dark, setDark] = useDarkMode();

  useLayoutEffect(() => {
    if (draftYearParam !== undefined && !routeYearValid) {
      navigate(`/year/${LATEST_COMPLETED_YEAR}`, { replace: true });
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
  const { draftClasses, loading, error } = useDraftClassLoader(
    startYear,
    endYear,
  );
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

  const { playerLookupClasses, playerInfo } = usePlayerLookup(
    isPlayerView,
    playerId,
    draftClasses,
  );

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
      .catch(() => {});
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

  const draftPickYear = clampYear(
    isYearView ? (forcedSingleYear as number) : endYear,
    yearBounds,
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

  const playerBackTarget = resolvePlayerBackTarget(
    searchParams.get('ref'),
    TEAMS,
    { from: startYear, to: endYear },
  );

  const handlePlayerBack = () => {
    navigate(playerBackTarget.to);
  };

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

  const draftingTeamOnly = true;
  const rollingDraftScore =
    draftClasses.length > 0 && selectedTeam
      ? getRollingDraftScore(draftClasses, selectedTeam, { draftingTeamOnly })
      : null;

  const teamRank = getTeamRankSummary(draftClasses, TEAMS, selectedTeam, {
    draftingTeamOnly,
  });

  const leagueContext =
    draftClasses.length > 0
      ? getLeagueContext(draftClasses, TEAMS, { draftingTeamOnly })
      : undefined;

  const rosterByDraftYear = getRosterByDraftYear(
    draftClasses,
    selectedTeam,
    showDeparted,
    roleFilter,
    draftingTeamOnly,
  );

  const selectedTeamData = selectedTeam
    ? TEAMS.find((t) => t.id === selectedTeam)
    : undefined;
  const depthChartUrl =
    selectedTeam && selectedTeamData
      ? getTeamDepthChartUrl(selectedTeam, selectedTeamData.name)
      : null;

  // Active tab for masthead
  const activeTab: MastheadTab = isPlayerView
    ? resolvePlayerOriginTab(searchParams.get('ref'), TEAMS)
    : ACTIVE_VIEW_TAB[activeView];

  return (
    <main className="app">
      <Masthead
        active={activeTab}
        dataLastUpdatedDate={dataLastUpdatedDate}
        fallbackRange={{ from: startYear, to: endYear }}
        onShowInfo={() => setShowInfoView(true)}
        dark={dark}
        onToggleDark={() => setDark((v) => !v)}
      />

      {renderSubbar({
        activeView,
        isPlayerView,
        from: startYear,
        to: endYear,
        min: YEAR_MIN,
        max: YEAR_MAX,
        onRangeChange: handleYearRangeChange,
        draftPickYear,
        onDraftPickYear: handleDraftPickYear,
        selectedTeam,
        selectedTeamName: selectedTeamData?.name,
        onShowRankings: handleShowRankings,
        canonicalPosition,
        playerName: playerInfo?.pick.playerName,
        playerBackLabel: playerBackTarget.label,
        onPlayerBack: handlePlayerBack,
      })}

      {showLandingIntro &&
        activeView === ActiveView.TeamRankings &&
        !isPlayerView && (
          <div className="site-intro">
            <span className="kicker">Welcome</span>
            <span className="site-intro__text">
              Compare every NFL draft pick by snap share, retention and a draft
              success score. Click a team to dive in.
            </span>
            <button
              type="button"
              className="site-intro__dismiss"
              onClick={handleDismissLandingIntro}
            >
              Got it ✕
            </button>
          </div>
        )}

      <div className="app-main">
        {renderMainContent({
          activeView,
          isPlayerView,
          loading,
          defaultRankings,
          yearCount,
          selectedTeam,
          handleTeamSelect,
          handleShowRankings,
          teamRank,
          leagueContext,
          rollingDraftScore,
          draftClasses,
          playerLookupClasses,
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
          positionOptions,
          handlePositionChange,
          playerInfo,
        })}
      </div>

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

interface SubbarArgs {
  activeView: ActiveView;
  isPlayerView: boolean;
  from: number;
  to: number;
  min: number;
  max: number;
  onRangeChange: (r: [number, number]) => void;
  draftPickYear: number;
  onDraftPickYear: (y: number) => void;
  selectedTeam: string | null;
  selectedTeamName: string | undefined;
  onShowRankings: () => void;
  canonicalPosition: string | null;
  playerName?: string;
  playerBackLabel?: string;
  onPlayerBack?: () => void;
}

function renderSubbar(a: SubbarArgs) {
  const {
    activeView,
    isPlayerView,
    from,
    to,
    min,
    max,
    onRangeChange,
    draftPickYear,
    onDraftPickYear,
    selectedTeam,
    selectedTeamName,
    onShowRankings,
    canonicalPosition,
    playerName,
    playerBackLabel,
    onPlayerBack,
  } = a;
  if (isPlayerView) {
    return (
      <Subbar>
        <button className="subbar__crumb" onClick={onPlayerBack}>
          ← {playerBackLabel ?? 'Rankings'}
        </button>
        <span className="subbar__slash">/</span>
        <span className="subbar__crumb-active">{playerName ?? 'Player'}</span>
      </Subbar>
    );
  }
  if (activeView === ActiveView.TeamRankings) {
    return (
      <Subbar>
        <YearRangeChips
          from={from}
          to={to}
          min={min}
          max={max}
          latestCompletedYear={LATEST_COMPLETED_YEAR}
          onChange={onRangeChange}
        />
      </Subbar>
    );
  }
  if (activeView === ActiveView.TeamDetail) {
    return (
      <Subbar>
        <button className="subbar__crumb" onClick={onShowRankings}>
          ← Rankings
        </button>
        <span className="subbar__slash">/</span>
        <span className="subbar__crumb-active">
          {selectedTeamName ?? selectedTeam}
        </span>
        <span className="subbar__sp" />
        <YearRangeChips
          from={from}
          to={to}
          min={min}
          max={max}
          latestCompletedYear={LATEST_COMPLETED_YEAR}
          onChange={onRangeChange}
        />
      </Subbar>
    );
  }
  if (activeView === ActiveView.DraftYears) {
    return (
      <Subbar>
        <button className="subbar__crumb" onClick={onShowRankings}>
          ← Rankings
        </button>
        <span className="subbar__slash">/</span>
        <span className="subbar__crumb-active">Draft Year</span>
        <span className="subbar__sp" />
        <span className="subbar__label">Year</span>
        {generateYearArray(min, max).map((y) => (
          <Chip
            key={y}
            on={y === draftPickYear}
            onClick={() => onDraftPickYear(y)}
          >
            {y}
          </Chip>
        ))}
      </Subbar>
    );
  }
  if (activeView === ActiveView.Position) {
    return (
      <Subbar>
        <button className="subbar__crumb" onClick={onShowRankings}>
          ← Rankings
        </button>
        <span className="subbar__slash">/</span>
        <span className="subbar__crumb-active">
          Position{canonicalPosition ? ` · ${canonicalPosition}` : ''}
        </span>
        <span className="subbar__sp" />
        <YearRangeChips
          from={from}
          to={to}
          min={min}
          max={max}
          latestCompletedYear={LATEST_COMPLETED_YEAR}
          onChange={onRangeChange}
        />
      </Subbar>
    );
  }
}

interface RenderMainArgs {
  activeView: ActiveView;
  isPlayerView: boolean;
  loading: boolean;
  defaultRankings: DefaultRankingsData | null;
  yearCount: number;
  selectedTeam: string | null;
  handleTeamSelect: (team: string) => void;
  handleShowRankings: () => void;
  teamRank: { rank: number; total: number; rankings: TeamRanking[] } | null;
  leagueContext: LeagueContext | undefined;
  rollingDraftScore: RollingDraftScore | null;
  draftClasses: DraftClass[];
  // Classes the player pick was resolved from — spans all years when the player
  // sits outside the current range, so the cohort/"ranked by load" list has data.
  playerLookupClasses: DraftClass[];
  draftingTeamOnly: boolean;
  roleFilter: Set<Role>;
  setRoleFilter: (value: Set<Role>) => void;
  rosterByDraftYear: { year: number; picks: RosterPick[] }[];
  depthChartUrl: string | null;
  showDeparted: boolean;
  setShowDeparted: (value: boolean) => void;
  canonicalPosition: string | null;
  startYear: number;
  endYear: number;
  positionOptions: string[];
  handlePositionChange: (pos: string) => void;
  playerInfo: { pick: DraftPick; draftYear: number } | null;
}

function renderMainContent(a: RenderMainArgs) {
  if (a.isPlayerView) {
    if (!a.playerInfo) {
      return <LoadingSpinner message="Loading player…" />;
    }
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <PlayerDetailView
          pick={a.playerInfo.pick}
          draftYear={a.playerInfo.draftYear}
          draftClasses={a.playerLookupClasses}
          draftingTeamOnly={a.draftingTeamOnly}
        />
      </Suspense>
    );
  }
  if (
    a.activeView === ActiveView.TeamRankings &&
    a.loading &&
    a.defaultRankings
  ) {
    return (
      <TeamRankingsView
        rankings={a.defaultRankings.rankings}
        yearCount={a.yearCount}
        startYear={a.startYear}
        endYear={a.endYear}
        onTeamSelect={a.handleTeamSelect}
        onBack={a.selectedTeam ? a.handleShowRankings : undefined}
      />
    );
  }
  if (
    a.activeView === ActiveView.TeamRankings &&
    !a.loading &&
    a.teamRank?.rankings
  ) {
    return (
      <TeamRankingsView
        rankings={a.teamRank.rankings}
        yearCount={a.yearCount}
        startYear={a.startYear}
        endYear={a.endYear}
        leagueContext={a.leagueContext}
        onTeamSelect={a.handleTeamSelect}
        onBack={a.selectedTeam ? a.handleShowRankings : undefined}
      />
    );
  }
  if (
    a.activeView === ActiveView.TeamDetail &&
    !a.loading &&
    a.rollingDraftScore &&
    a.selectedTeam
  ) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <TeamDetailContent
          rollingDraftScore={a.rollingDraftScore}
          yearCount={a.yearCount}
          teamRank={a.teamRank}
          onShowRankings={a.handleShowRankings}
          draftClasses={a.draftClasses}
          selectedTeam={a.selectedTeam}
          draftingTeamOnly={a.draftingTeamOnly}
          roleFilter={a.roleFilter}
          setRoleFilter={a.setRoleFilter}
          rosterByDraftYear={a.rosterByDraftYear}
          depthChartUrl={a.depthChartUrl}
          showDeparted={a.showDeparted}
          setShowDeparted={a.setShowDeparted}
        />
      </Suspense>
    );
  }
  if (a.activeView === ActiveView.DraftYears && a.draftClasses.length === 1) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <YearDraftView
          draftClass={a.draftClasses[0]}
          draftingTeamOnly={a.draftingTeamOnly}
        />
      </Suspense>
    );
  }
  if (
    a.activeView === ActiveView.Position &&
    a.canonicalPosition &&
    a.draftClasses.length > 0
  ) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <PositionDraftView
          position={a.canonicalPosition}
          yearFrom={a.startYear}
          yearTo={a.endYear}
          draftClasses={a.draftClasses}
          draftingTeamOnly={a.draftingTeamOnly}
          positionOptions={a.positionOptions}
          onPositionChange={a.handlePositionChange}
        />
      </Suspense>
    );
  }
  return <LoadingSpinner message="Loading draft data…" />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/position/:position" element={<AppContent />} />
      <Route path="/year/:draftYear" element={<AppContent />} />
      <Route path="/player/:playerId" element={<AppContent />} />
      <Route path="/:teamId" element={<AppContent />} />
    </Routes>
  );
}

export default App;
