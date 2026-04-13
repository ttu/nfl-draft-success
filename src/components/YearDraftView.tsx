import { Link } from 'react-router-dom';
import { PlayerList } from './PlayerList';
import type { DraftClass, DraftPick } from '../types';

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

  return (
    <>
      <div className="year-draft-view__intro">
        <h2 id="year-draft-title">{year} NFL Draft — all picks</h2>
        <p className="year-draft-view__lede">
          Every selection in the {year} draft, in pick order. Choose a team from{' '}
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
