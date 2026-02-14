import { useState, useEffect } from 'react';
import { TeamSelector } from './components/TeamSelector';
import { YearRangeFilter } from './components/YearRangeFilter';
import { DraftClassCard } from './components/DraftClassCard';
import { FiveYearScoreCard } from './components/FiveYearScoreCard';
import { TeamRankingsView } from './components/TeamRankingsView';
import { PlayerList } from './components/PlayerList';
import { loadDataForYears } from './lib/loadData';
import { getDraftClassMetrics } from './lib/getDraftClassMetrics';
import { getFiveYearScore } from './lib/getFiveYearScore';
import { loadPreferences, savePreferences } from './lib/storage';
import { getUrlState, updateUrl, getShareableUrl } from './lib/urlState';
import { TEAMS } from './data/teams';
import { getTeamLogoUrl, getTeamDepthChartUrl } from './data/teamColors';
import type { DraftClass } from './types';
import './App.css';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;
const DEFAULT_TEAM = 'SEA';
const DEFAULT_YEAR_MIN = 2021;

const validTeamIds = new Set(TEAMS.map((t) => t.id));
const yearBounds = { min: YEAR_MIN, max: YEAR_MAX };

let cachedPrefs: ReturnType<typeof loadPreferences> | null = null;
function getInitialPreferences() {
  cachedPrefs ??= loadPreferences(
    DEFAULT_TEAM,
    DEFAULT_YEAR_MIN,
    YEAR_MAX,
    yearBounds,
    validTeamIds,
  );
  return cachedPrefs;
}

function getInitialState() {
  const urlState = getUrlState(validTeamIds, yearBounds);
  if (urlState) {
    return {
      team: urlState.team,
      yearRange: [urlState.from, urlState.to] as [number, number],
    };
  }
  const p = getInitialPreferences();
  return {
    team: p.team,
    yearRange: [p.yearMin, p.yearMax] as [number, number],
  };
}

function App() {
  const [selectedTeam, setSelectedTeam] = useState(
    () => getInitialState().team,
  );
  const [yearRange, setYearRange] = useState<[number, number]>(
    () => getInitialState().yearRange,
  );
  useEffect(() => {
    savePreferences({
      team: selectedTeam,
      yearMin: yearRange[0],
      yearMax: yearRange[1],
    });
  }, [selectedTeam, yearRange]);

  useEffect(() => {
    updateUrl(selectedTeam, yearRange[0], yearRange[1]);
  }, [selectedTeam, yearRange]);
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRankingsView, setShowRankingsView] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyLink = () => {
    const url = getShareableUrl(selectedTeam, yearRange[0], yearRange[1]);
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
    draftClasses.length > 0
      ? getFiveYearScore(draftClasses, selectedTeam, { draftingTeamOnly })
      : null;

  const teamRank =
    draftClasses.length > 0 && fiveYearScore
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

  const selectedTeamData = TEAMS.find((t) => t.id === selectedTeam);
  const depthChartUrl = selectedTeamData
    ? getTeamDepthChartUrl(selectedTeam, selectedTeamData.name)
    : null;

  return (
    <main className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <img
            src={getTeamLogoUrl(selectedTeam)}
            alt=""
            className="app-header__logo"
            aria-hidden
          />
          <h1>NFL Draft Success</h1>
        </div>
        <div className="app-controls">
          <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
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
        </div>
      </header>

      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading draft data…</p>
      ) : showRankingsView && teamRank?.rankings ? (
        <TeamRankingsView
          rankings={teamRank.rankings}
          yearCount={yearRange[1] - yearRange[0] + 1}
          onTeamSelect={(teamId) => {
            setSelectedTeam(teamId);
            setShowRankingsView(false);
          }}
          onBack={() => setShowRankingsView(false)}
        />
      ) : (
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
            <PlayerList
              picks={retainedPicks}
              teamId={selectedTeam}
              draftingTeamOnly={draftingTeamOnly}
            />
          </section>
        </>
      )}
    </main>
  );
}

export default App;
