import { DraftClassCard } from './DraftClassCard';
import { RollingDraftScoreCard } from './RollingDraftScoreCard';
import { PlayerList } from './PlayerList';
import { RoleFilter } from './RoleFilter';
import { getDraftClassMetrics } from '../lib/getDraftClassMetrics';
import type { DraftClass, DraftPick, Role } from '../types';
import type { TeamRanking } from './RollingDraftScoreCard';
import type { RollingDraftScore } from '../lib/getRollingDraftScore';

export interface RosterPick {
  pick: DraftPick;
  draftYear: number;
}

export interface TeamDetailContentProps {
  rollingDraftScore: RollingDraftScore;
  yearCount: number;
  teamRank: { rank: number; total: number; rankings: TeamRanking[] } | null;
  onShowRankings: () => void;
  draftClasses: DraftClass[];
  selectedTeam: string;
  draftingTeamOnly: boolean;
  roleFilter: Set<Role>;
  setRoleFilter: (value: Set<Role>) => void;
  rosterByDraftYear: { year: number; picks: RosterPick[] }[];
  depthChartUrl: string | null;
  showDeparted: boolean;
  setShowDeparted: (value: boolean) => void;
}

export function TeamDetailContent({
  rollingDraftScore,
  yearCount,
  teamRank,
  onShowRankings,
  draftClasses,
  selectedTeam,
  draftingTeamOnly,
  roleFilter,
  setRoleFilter,
  rosterByDraftYear,
  depthChartUrl,
  showDeparted,
  setShowDeparted,
}: TeamDetailContentProps) {
  const hideRosterYearHeading =
    yearCount === 1 &&
    draftClasses.length === 1 &&
    rosterByDraftYear.length === 1 &&
    rosterByDraftYear[0].year === draftClasses[0].year;

  return (
    <>
      <section className="app-score">
        <RollingDraftScoreCard
          score={rollingDraftScore}
          yearCount={yearCount}
          rank={teamRank}
          onShowRankings={onShowRankings}
        />
      </section>

      <section
        className="app-draft-cards"
        aria-label="Draft class metrics by year"
      >
        {draftClasses.map((dc) => {
          const metrics = getDraftClassMetrics(dc, selectedTeam, {
            draftingTeamOnly,
          });
          return (
            <DraftClassCard key={dc.year} year={dc.year} metrics={metrics} />
          );
        })}
      </section>

      <section className="app-players" aria-label="Current roster draft picks">
        <div className="app-players__header">
          <h2>Current roster</h2>
          <label className="app-players__departed-toggle">
            <input
              type="checkbox"
              checked={showDeparted}
              onChange={(e) => setShowDeparted(e.target.checked)}
              aria-label="Show departed players"
            />
            <span>Show departed</span>
          </label>
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
              className="roster-year-section"
              aria-labelledby={
                hideRosterYearHeading ? undefined : `roster-${year}-title`
              }
              aria-label={
                hideRosterYearHeading
                  ? `Current roster · ${year} draft class`
                  : undefined
              }
            >
              {!hideRosterYearHeading && (
                <h3
                  id={`roster-${year}-title`}
                  className="roster-year-section__title"
                >
                  Draft {year}
                </h3>
              )}
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
  );
}
