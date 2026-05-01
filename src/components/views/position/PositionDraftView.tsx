import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlayerList } from '../../draft/PlayerList';
import {
  filterPicksByPosition,
  groupPicksByDraftYear,
} from '../../../lib/positionDraft';
import { getPositionDisplayName } from '../../../lib/positionDisplayName';
import type { DraftClass } from '../../../types';

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
  const singleCalendarYear = yearFrom === yearTo;
  const titleDraftRange = singleCalendarYear
    ? ` · ${yearFrom}`
    : ` — drafts ${yearFrom}–${yearTo}`;

  return (
    <>
      <div className="year-draft-view__intro position-draft-view__intro">
        <h2 id="position-draft-title">
          {positionTitle} ({position}){titleDraftRange}
        </h2>
        <p className="year-draft-view__lede">
          {singleCalendarYear ? (
            <>
              Every {positionTitle.toLowerCase()} ({position}) picked in{' '}
              {yearFrom} (order below follows draft position within the year).
              Open{' '}
            </>
          ) : (
            <>
              All {positionTitle.toLowerCase()} ({position}) picks in this range
              (pick order within each year). Open{' '}
            </>
          )}
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
        groups.map(({ year, picks }) => {
          const hideYearBanner =
            singleCalendarYear && groups.length === 1 && year === yearFrom;
          return (
            <section
              key={year}
              className="app-players position-draft-view__year"
              aria-label={
                hideYearBanner
                  ? undefined
                  : `${year} draft, ${positionTitle} (${position})`
              }
              aria-labelledby={
                hideYearBanner ? 'position-draft-title' : undefined
              }
            >
              {!hideYearBanner && (
                <h3 className="position-draft-view__year-heading">{year}</h3>
              )}
              <PlayerList
                picks={picks}
                teamId={picks[0]?.pick.teamId ?? 'KC'}
                brandByDraftingTeam
                yearDraftBoard
                draftingTeamOnly={draftingTeamOnly}
              />
            </section>
          );
        })
      )}
    </>
  );
}
