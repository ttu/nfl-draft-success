import { DraftClassCard } from '../../draft/DraftClassCard';
import { RollingDraftScoreCard } from '../../draft/RollingDraftScoreCard';
import { PlayerList } from '../../draft/PlayerList';
import { RoleFilter } from '../../filters/RoleFilter';
import {
  buildDraftClassMetricsRows,
  findLatestYearWithAwaitingData,
  shouldHideRosterYearHeading,
} from '../../../lib/draftClassDisplay';
import type { DraftClass, DraftPick, Role } from '../../../types';
import type { TeamRanking } from '../../draft/RollingDraftScoreCard';
import type { RollingDraftScore } from '../../../lib/getRollingDraftScore';

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
  const hideRosterYearHeading = shouldHideRosterYearHeading({
    yearCount,
    draftClassesLength: draftClasses.length,
    rosterByDraftYear,
    draftClassYear: draftClasses[0]?.year,
  });
  const metricsRows = buildDraftClassMetricsRows(draftClasses, selectedTeam, {
    draftingTeamOnly,
  });
  const latestYearWithAwaiting = findLatestYearWithAwaitingData(metricsRows);

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
        {metricsRows.map(({ dc, metrics }) => (
          <DraftClassCard
            key={dc.year}
            year={dc.year}
            metrics={metrics}
            showAwaitingDataNote={
              latestYearWithAwaiting != null &&
              dc.year === latestYearWithAwaiting
            }
          />
        ))}
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
