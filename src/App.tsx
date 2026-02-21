import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Routes,
  Route,
  useParams,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import { TeamSelector } from './components/TeamSelector';
import { YearRangeFilter } from './components/YearRangeFilter';
import { roleFilterAllows, DEFAULT_ROLE_FILTER } from './lib/roleFilter';
import { getPlayerRole } from './lib/getPlayerRole';
import { loadDataForYears } from './lib/loadData';
import { getFiveYearScore } from './lib/getFiveYearScore';
import { loadRoleFilter, saveRoleFilter } from './lib/storage';
import { getShareableUrl } from './lib/urlState';
import { TEAMS } from './data/teams';
import {
  getTeamLogoUrl,
  getTeamDepthChartUrl,
  NFL_LOGO_URL,
} from './data/teamColors';
import type { DraftClass, Role } from './types';
import './App.css';

const InfoView = lazy(() =>
  import('./components/InfoView').then((m) => ({ default: m.InfoView })),
);
const TeamRankingsView = lazy(() =>
  import('./components/TeamRankingsView').then((m) => ({
    default: m.TeamRankingsView,
  })),
);
const TeamDetailContent = lazy(() =>
  import('./components/TeamDetailContent').then((m) => ({
    default: m.TeamDetailContent,
  })),
);

function LoadingFallback() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="app-loading__spinner" aria-hidden />
      <span className="app-loading__text">Loading…</span>
    </div>
  );
}

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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showInfoView, setShowInfoView] = useState(false);

  useEffect(() => {
    saveRoleFilter(Array.from(roleFilter));
  }, [roleFilter]);

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
      <header className="app-header">
        <div className="app-header__brand">
          {selectedTeam ? (
            <img
              src={getTeamLogoUrl(selectedTeam)}
              alt=""
              className="app-header__logo"
              aria-hidden
            />
          ) : (
            <img
              src={NFL_LOGO_URL}
              alt=""
              className="app-header__logo"
              aria-hidden
            />
          )}
          <h1>NFL Draft Success</h1>
        </div>
        <div className="app-controls">
          {!showRankingsView && (
            <button
              type="button"
              onClick={handleShowRankings}
              className="app-header__rankings-link"
            >
              Team rankings
            </button>
          )}
          {!showRankingsView && selectedTeam && (
            <TeamSelector value={selectedTeam} onChange={handleTeamSelect} />
          )}
          <YearRangeFilter
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={yearRange}
            onChange={handleYearRangeChange}
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="app-controls__copy-link"
            aria-label={copyFeedback ? 'Copied!' : 'Copy shareable link'}
            title="Copy shareable link"
          >
            {copyFeedback ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowInfoView(true)}
            className="app-controls__copy-link"
            aria-label="About"
            title="About"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        </div>
      </header>

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

      {loading ? (
        <div className="app-loading" role="status" aria-live="polite">
          <span className="app-loading__spinner" aria-hidden />
          <span className="app-loading__text">Loading draft data…</span>
        </div>
      ) : (showRankingsView || !selectedTeam) && teamRank?.rankings ? (
        <Suspense fallback={<LoadingFallback />}>
          <TeamRankingsView
            rankings={teamRank.rankings}
            yearCount={yearRange[1] - yearRange[0] + 1}
            onTeamSelect={handleTeamSelect}
            onBack={selectedTeam ? handleShowRankings : undefined}
          />
        </Suspense>
      ) : selectedTeam && fiveYearScore ? (
        <Suspense fallback={<LoadingFallback />}>
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
      ) : selectedTeam ? (
        <div className="app-loading" role="status" aria-live="polite">
          <span className="app-loading__spinner" aria-hidden />
          <span className="app-loading__text">Loading draft data…</span>
        </div>
      ) : (
        <div className="app-loading" role="status" aria-live="polite">
          <span className="app-loading__spinner" aria-hidden />
          <span className="app-loading__text">Loading draft data…</span>
        </div>
      )}
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
