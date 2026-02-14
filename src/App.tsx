import { useState, useEffect } from 'react';
import { TeamSelector } from './components/TeamSelector';
import { YearRangeFilter } from './components/YearRangeFilter';
import { RoleFilter } from './components/RoleFilter';
import { InfoView } from './components/InfoView';
import { roleFilterAllows, DEFAULT_ROLE_FILTER } from './lib/roleFilter';
import { DraftClassCard } from './components/DraftClassCard';
import { FiveYearScoreCard } from './components/FiveYearScoreCard';
import { TeamRankingsView } from './components/TeamRankingsView';
import { PlayerList } from './components/PlayerList';
import { getPlayerRole } from './lib/getPlayerRole';
import { loadDataForYears } from './lib/loadData';
import { getDraftClassMetrics } from './lib/getDraftClassMetrics';
import { getFiveYearScore } from './lib/getFiveYearScore';
import { loadPreferences, savePreferences } from './lib/storage';
import { getUrlState, updateUrl, getShareableUrl } from './lib/urlState';
import { TEAMS } from './data/teams';
import {
  getTeamLogoUrl,
  getTeamDepthChartUrl,
  NFL_LOGO_URL,
} from './data/teamColors';
import type { DraftClass, Role } from './types';
import './App.css';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;
const DEFAULT_YEAR_MIN = 2021;

const validTeamIds = new Set(TEAMS.map((t) => t.id));
const yearBounds = { min: YEAR_MIN, max: YEAR_MAX };

let cachedPrefs: ReturnType<typeof loadPreferences> | null = null;
function getInitialPreferences() {
  cachedPrefs ??= loadPreferences(
    undefined,
    DEFAULT_YEAR_MIN,
    YEAR_MAX,
    yearBounds,
    validTeamIds,
  );
  return cachedPrefs;
}

function getInitialState(): {
  team: string | null;
  yearRange: [number, number];
  showRankingsView: boolean;
  roleFilter: Set<Role>;
} {
  const urlState = getUrlState(validTeamIds, yearBounds);
  const p = getInitialPreferences();
  const roleFilter =
    p.roleFilter && p.roleFilter.length > 0
      ? (new Set(p.roleFilter) as Set<Role>)
      : new Set(DEFAULT_ROLE_FILTER);
  if (urlState) {
    return {
      team: urlState.team,
      yearRange: [urlState.from, urlState.to],
      showRankingsView: urlState.team === null,
      roleFilter,
    };
  }
  const showRankingsView = p.view !== 'team'; // rankings if view is 'rankings' or undefined (new/legacy)
  return {
    team: p.team ?? null,
    yearRange: [p.yearMin, p.yearMax],
    showRankingsView,
    roleFilter,
  };
}

function App() {
  const [selectedTeam, setSelectedTeam] = useState(
    () => getInitialState().team,
  );
  const [yearRange, setYearRange] = useState<[number, number]>(
    () => getInitialState().yearRange,
  );
  const [showRankingsView, setShowRankingsView] = useState(
    () => getInitialState().showRankingsView,
  );
  const [roleFilter, setRoleFilter] = useState<Set<Role>>(
    () => getInitialState().roleFilter,
  );
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefs: Parameters<typeof savePreferences>[0] = {
      yearMin: yearRange[0],
      yearMax: yearRange[1],
      view: showRankingsView ? 'rankings' : 'team',
      roleFilter: Array.from(roleFilter),
    };
    if (selectedTeam) prefs.team = selectedTeam;
    savePreferences(prefs);
  }, [selectedTeam, yearRange, showRankingsView, roleFilter]);

  useEffect(() => {
    updateUrl(
      showRankingsView ? null : selectedTeam,
      yearRange[0],
      yearRange[1],
    );
  }, [selectedTeam, yearRange, showRankingsView]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showInfoView, setShowInfoView] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [yearRange]);

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
              onClick={() => {
                setSelectedTeam(null);
                setShowRankingsView(true);
              }}
              className="app-header__rankings-link"
            >
              Team rankings
            </button>
          )}
          {!showRankingsView && selectedTeam && (
            <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
          )}
          <YearRangeFilter
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={yearRange}
            onChange={setYearRange}
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

      {showInfoView && <InfoView onClose={() => setShowInfoView(false)} />}

      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading draft data…</p>
      ) : (showRankingsView || !selectedTeam) && teamRank?.rankings ? (
        <TeamRankingsView
          rankings={teamRank.rankings}
          yearCount={yearRange[1] - yearRange[0] + 1}
          onTeamSelect={(teamId) => {
            setSelectedTeam(teamId);
            setShowRankingsView(false);
          }}
          onBack={selectedTeam ? () => setShowRankingsView(false) : undefined}
        />
      ) : selectedTeam ? (
        <>
          {fiveYearScore && (
            <section className="app-score">
              <FiveYearScoreCard
                score={fiveYearScore}
                yearCount={yearRange[1] - yearRange[0] + 1}
                rank={teamRank}
                onShowRankings={() => setShowRankingsView(true)}
              />
            </section>
          )}

          <section
            className="app-draft-cards"
            aria-label="Draft class metrics by year"
          >
            {draftClasses.map((dc) => {
              const metrics = getDraftClassMetrics(dc, selectedTeam, {
                draftingTeamOnly,
              });
              return (
                <DraftClassCard
                  key={dc.year}
                  year={dc.year}
                  metrics={metrics}
                />
              );
            })}
          </section>

          <section
            className="app-players"
            aria-label="Current roster draft picks"
          >
            <div className="app-players__header">
              <h2>Current roster</h2>
              <RoleFilter value={roleFilter} onChange={setRoleFilter} />
              {depthChartUrl && (
                <a
                  href={depthChartUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-players__depth-link"
                >
                  Open external depth chart
                </a>
              )}
            </div>
            <div className="app-roster-by-year">
              {rosterByDraftYear.map(({ year, picks }) => (
                <article
                  key={year}
                  aria-labelledby={`roster-${year}-title`}
                  className="roster-year-section"
                >
                  <h3
                    id={`roster-${year}-title`}
                    className="roster-year-section__title"
                  >
                    Draft {year}
                  </h3>
                  <PlayerList
                    picks={picks}
                    teamId={selectedTeam}
                    draftingTeamOnly={draftingTeamOnly}
                  />
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p>Loading draft data…</p>
      )}
    </main>
  );
}

export default App;
