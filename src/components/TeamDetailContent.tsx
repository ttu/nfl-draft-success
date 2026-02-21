import { DraftClassCard } from './DraftClassCard';
import { FiveYearScoreCard } from './FiveYearScoreCard';
import { PlayerList } from './PlayerList';
import { RoleFilter } from './RoleFilter';
import { getDraftClassMetrics } from '../lib/getDraftClassMetrics';
import type { DraftClass, DraftPick, Role } from '../types';
import type { TeamRanking } from './FiveYearScoreCard';
import type { FiveYearScore } from '../lib/getFiveYearScore';

export interface RosterPick {
  pick: DraftPick;
  draftYear: number;
}

export interface TeamDetailContentProps {
  fiveYearScore: FiveYearScore;
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
}

export function TeamDetailContent({
  fiveYearScore,
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
}: TeamDetailContentProps) {
  return (
    <>
      <section className="app-score">
        <FiveYearScoreCard
          score={fiveYearScore}
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
  );
}
