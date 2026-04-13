import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlayerList } from './PlayerList';
import {
  filterPicksByPosition,
  groupPicksByDraftYear,
} from '../lib/positionDraft';
import { getPositionDisplayName } from '../lib/positionDisplayName';
import type { DraftClass } from '../types';

export interface PositionDraftViewProps {
  position: string;
  yearFrom: number;
  yearTo: number;
  draftClasses: DraftClass[];
  draftingTeamOnly: boolean;
  onShowRankings: () => void;
}

export function PositionDraftView({
  position,
  yearFrom,
  yearTo,
  draftClasses,
  draftingTeamOnly,
  onShowRankings,
}: PositionDraftViewProps) {
  const groups = useMemo(() => {
    const flat = filterPicksByPosition(draftClasses, position);
    return groupPicksByDraftYear(flat);
  }, [draftClasses, position]);

  const positionTitle = getPositionDisplayName(position);

  return (
    <>
      <div className="year-draft-view__intro position-draft-view__intro">
        <h2 id="position-draft-title">
          {positionTitle} ({position}) — drafts {yearFrom}–{yearTo}
        </h2>
        <p className="year-draft-view__lede">
          Every player drafted at {positionTitle.toLowerCase()} ({position}) in
          the years you selected (pick order within each year). Open{' '}
          <button
            type="button"
            className="year-draft-view__inline-link"
            onClick={onShowRankings}
          >
            team rankings
          </button>{' '}
          or the{' '}
          <Link className="year-draft-view__inline-link" to={`/year/${yearTo}`}>
            {yearTo} draft board
          </Link>
          .
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="position-draft-view__empty" role="status">
          No picks at {positionTitle} ({position}) in this range.
        </p>
      ) : (
        groups.map(({ year, picks }) => (
          <section
            key={year}
            className="app-players position-draft-view__year"
            aria-label={`${year} draft, ${positionTitle} (${position})`}
          >
            <h3 className="position-draft-view__year-heading">{year}</h3>
            <PlayerList
              picks={picks}
              teamId={picks[0]?.pick.teamId ?? 'KC'}
              brandByDraftingTeam
              yearDraftBoard
              draftingTeamOnly={draftingTeamOnly}
            />
          </section>
        ))
      )}
    </>
  );
}
