import { Link } from 'react-router-dom';
import { PlayerList } from '../../draft/PlayerList';
import type { DraftClass, DraftPick } from '../../../types';

export interface YearDraftViewProps {
  draftClass: DraftClass;
  draftingTeamOnly: boolean;
  onShowRankings: () => void;
}

function sortPicksByOverall(picks: DraftPick[]): DraftPick[] {
  return [...picks].sort((a, b) => a.overallPick - b.overallPick);
}

export function YearDraftView({
  draftClass,
  draftingTeamOnly,
  onShowRankings,
}: YearDraftViewProps) {
  const year = draftClass.year;
  const sorted = sortPicksByOverall(draftClass.picks);
  const picks = sorted.map((pick) => ({ pick, draftYear: year }));
  const noSeasonDataYet = sorted.every((p) => p.seasons.length === 0);

  return (
    <>
      <div className="year-draft-view__intro">
        <h2 id="year-draft-title">{year} NFL Draft — all picks</h2>
        {noSeasonDataYet && (
          <p className="year-draft-view__pending" role="status">
            Season stats are not in the dataset yet for this class. Player cards
            show draft slot only until NFL snap data is published for the new
            league year.
          </p>
        )}
        <p className="year-draft-view__lede">
          Every pick in draft order (all teams). Choose a team from{' '}
          <button
            type="button"
            className="year-draft-view__inline-link"
            onClick={onShowRankings}
          >
            team rankings
          </button>{' '}
          or open a{' '}
          <Link className="year-draft-view__inline-link" to="/">
            team page
          </Link>{' '}
          for retention-focused analysis.
        </p>
      </div>

      <section
        className="app-players year-draft-view__players"
        aria-label={`${year} NFL draft — all picks`}
      >
        <PlayerList
          picks={picks}
          teamId={picks[0]?.pick.teamId ?? 'KC'}
          brandByDraftingTeam
          yearDraftBoard
          draftingTeamOnly={draftingTeamOnly}
        />
      </section>
    </>
  );
}
