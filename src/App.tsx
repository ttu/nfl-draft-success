import { useState, useEffect } from 'react';
import { TeamSelector } from './components/TeamSelector';
import { YearRangeFilter } from './components/YearRangeFilter';
import { DraftClassCard } from './components/DraftClassCard';
import { FiveYearScoreCard } from './components/FiveYearScoreCard';
import { PlayerList } from './components/PlayerList';
import { loadDataForYears } from './lib/loadData';
import { getDraftClassMetrics } from './lib/getDraftClassMetrics';
import { getFiveYearScore } from './lib/getFiveYearScore';
import { loadPreferences, savePreferences } from './lib/storage';
import { TEAMS } from './data/teams';
import type { DraftClass } from './types';
import './App.css';

const YEAR_MIN = 2018;
const YEAR_MAX = 2025;
const DEFAULT_TEAM = 'SEA';
const DEFAULT_YEAR_MIN = 2021;

const validTeamIds = new Set(TEAMS.map((t) => t.id));

let cachedPrefs: ReturnType<typeof loadPreferences> | null = null;
function getInitialPreferences() {
  cachedPrefs ??= loadPreferences(
    DEFAULT_TEAM,
    DEFAULT_YEAR_MIN,
    YEAR_MAX,
    { min: YEAR_MIN, max: YEAR_MAX },
    validTeamIds,
  );
  return cachedPrefs;
}

function App() {
  const [selectedTeam, setSelectedTeam] = useState(
    () => getInitialPreferences().team,
  );
  const [yearRange, setYearRange] = useState<[number, number]>(() => {
    const p = getInitialPreferences();
    return [p.yearMin, p.yearMax];
  });
  useEffect(() => {
    savePreferences({
      team: selectedTeam,
      yearMin: yearRange[0],
      yearMax: yearRange[1],
    });
  }, [selectedTeam, yearRange]);
  const [draftClasses, setDraftClasses] = useState<DraftClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="app">
      <header className="app-header">
        <h1>NFL Draft Success</h1>
        <div className="app-controls">
          <TeamSelector value={selectedTeam} onChange={setSelectedTeam} />
          <YearRangeFilter
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={yearRange}
            onChange={setYearRange}
          />
        </div>
      </header>

      {error && (
        <div role="alert" className="app-error">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading draft data…</p>
      ) : (
        <>
          {fiveYearScore && (
            <section className="app-score">
              <FiveYearScoreCard
                score={fiveYearScore}
                yearCount={yearRange[1] - yearRange[0] + 1}
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

          <section className="app-players" aria-label="Draft picks">
            <h2>Players</h2>
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
