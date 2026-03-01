import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  useParams,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { LoadingSpinner } from './components/LoadingSpinner';
import { roleFilterAllows, DEFAULT_ROLE_FILTER } from './lib/roleFilter';
import { getPlayerRole } from './lib/getPlayerRole';
import { loadDataForYears, loadDefaultRankings } from './lib/loadData';
import { getFiveYearScore } from './lib/getFiveYearScore';
import { loadRoleFilter, saveRoleFilter } from './lib/storage';
import { getShareableUrl } from './lib/urlState';
import { TEAMS } from './data/teams';
import { getTeamDepthChartUrl } from './data/teamColors';
import type { DraftClass, DefaultRankingsData, Role } from './types';
import './App.css';

import { TeamRankingsView } from './components/TeamRankingsView';

const InfoView = lazy(() =>
  import('./components/InfoView').then((m) => ({ default: m.InfoView })),
);
const TeamDetailContent = lazy(() =>
  import('./components/TeamDetailContent').then((m) => ({
    default: m.TeamDetailContent,
  })),
);

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;
const DEFAULT_YEAR_MIN = 2021;

const validTeamIds = new Set(TEAMS.map((t) => t.id));
const yearBounds = { min: YEAR_MIN, max: YEAR_MAX };

function useValidYearRange(
  searchParams: URLSearchParams,
  setSearchParams: (params: Record<string, string>) => void,
): [number, number] {
  const from = parseInt(searchParams.get('from') ?? '', 10);
  const to = parseInt(searchParams.get('to') ?? '', 10);
  const valid =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= yearBounds.min &&
    to <= yearBounds.max &&
    from <= to;

  // Avoid setSearchParams loop: only correct once per mount when params are invalid.
  // setSearchParams triggers navigation → searchParams update → re-render; without
  // a guard, this can cause an infinite loop in some deployments.
  const correctedRef = useRef(false);
  useEffect(() => {
    if (!valid && !correctedRef.current) {
      correctedRef.current = true;
      setSearchParams({
        from: String(DEFAULT_YEAR_MIN),
        to: String(YEAR_MAX),
      });
    }
  }, [valid, setSearchParams]);

  return valid ? [from, to] : [DEFAULT_YEAR_MIN, YEAR_MAX];
}

function AppContent() {
  const { teamId } = useParams<{ teamId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedTeam = teamId && validTeamIds.has(teamId) ? teamId : null;
  const showRankingsView = selectedTeam === null;

  const yearRange = useValidYearRange(searchParams, setSearchParams);
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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showInfoView, setShowInfoView] = useState(false);

  useEffect(() => {
    saveRoleFilter(Array.from(roleFilter));
  }, [roleFilter]);

  useEffect(() => {
    loadDefaultRankings()
      .then(setDefaultRankings)
      .catch(() => {
        // Silently fail — falls back to full data load
      });
  }, []);

  const handleYearRangeChange = (range: [number, number]) => {
    setSearchParams({ from: String(range[0]), to: String(range[1]) });
  };

  const handleCopyLink = () => {
    const url = getShareableUrl(
      showRankingsView ? null : selectedTeam,
      yearRange[0],
      yearRange[1],
    );
    void navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleTeamSelect = (team: string) => {
    navigate(`/${team}?from=${yearRange[0]}&to=${yearRange[1]}`);
  };

  const handleShowRankings = () => {
    navigate(`/?from=${yearRange[0]}&to=${yearRange[1]}`);
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
      { length: yearRange[1] - yearRange[0] + 1 },
      (_, i) => yearRange[0] + i,
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
  }, [yearRange[0], yearRange[1]]);

  const draftingTeamOnly = true;
  const fiveYearScore =
    draftClasses.length > 0 && selectedTeam
      ? getFiveYearScore(draftClasses, selectedTeam, { draftingTeamOnly })
      : null;

  const teamRank =
    draftClasses.length > 0
      ? (() => {
          const teamScores = TEAMS.map((t) => ({
            teamId: t.id,
            teamName: t.name,
            score: getFiveYearScore(draftClasses, t.id, {
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

  const retainedPicks = allTeamPicks.filter(({ pick }) => {
    const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
    return latestSeason?.retained === true;
  });

  const filteredRetainedPicks = retainedPicks.filter(({ pick }) =>
    roleFilterAllows(roleFilter, getPlayerRole(pick, { draftingTeamOnly })),
  );

  const rosterByDraftYear = (() => {
    const byYear = new Map<number, typeof filteredRetainedPicks>();
    for (const item of filteredRetainedPicks) {
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
        selectedTeam={selectedTeam}
        showRankingsView={showRankingsView}
        yearRange={yearRange}
        copyFeedback={copyFeedback}
        onShowRankings={handleShowRankings}
        onTeamSelect={handleTeamSelect}
        onYearRangeChange={handleYearRangeChange}
        onCopyLink={handleCopyLink}
        onShowInfo={() => setShowInfoView(true)}
      />

      {showInfoView && (
        <Suspense fallback={null}>
          <InfoView onClose={() => setShowInfoView(false)} />
        </Suspense>
      )}

      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}

      {loading && showRankingsView && defaultRankings ? (
        <TeamRankingsView
          rankings={defaultRankings.rankings}
          yearCount={yearRange[1] - yearRange[0] + 1}
          onTeamSelect={handleTeamSelect}
        />
      ) : loading ? (
        <LoadingSpinner message="Loading draft data…" />
      ) : (showRankingsView || !selectedTeam) && teamRank?.rankings ? (
        <TeamRankingsView
          rankings={teamRank.rankings}
          yearCount={yearRange[1] - yearRange[0] + 1}
          onTeamSelect={handleTeamSelect}
          onBack={selectedTeam ? handleShowRankings : undefined}
        />
      ) : selectedTeam && fiveYearScore ? (
        <Suspense fallback={<LoadingSpinner />}>
          <TeamDetailContent
            fiveYearScore={fiveYearScore}
            yearCount={yearRange[1] - yearRange[0] + 1}
            teamRank={teamRank}
            onShowRankings={handleShowRankings}
            draftClasses={draftClasses}
            selectedTeam={selectedTeam}
            draftingTeamOnly={draftingTeamOnly}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            rosterByDraftYear={rosterByDraftYear}
            depthChartUrl={depthChartUrl}
          />
        </Suspense>
      ) : (
        <LoadingSpinner message="Loading draft data…" />
      )}

      <footer className="app-footer">
        <p>
          NFLDraftSuccess.com is an independent analytics site and is not
          affiliated with, endorsed by, or sponsored by the National Football
          League or any NFL team.
        </p>
        <p>
          Team logos courtesy of{' '}
          <a
            href="https://www.sportslogos.net/"
            target="_blank"
            rel="noopener noreferrer"
          >
            SportsLogos.net
          </a>
          . Used for educational purposes only.
        </p>
      </footer>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/:teamId" element={<AppContent />} />
    </Routes>
  );
}

export default App;
