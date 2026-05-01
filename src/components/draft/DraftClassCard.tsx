import type { DraftClassMetrics } from '../../lib/getDraftClassMetrics';

export interface DraftClassCardProps {
  year: number;
  metrics: DraftClassMetrics;
  /**
   * When false, hides all “not yet in season data” messaging for this card so
   * only the latest draft year with gaps shows it (see TeamDetailContent).
   * @default true
   */
  showAwaitingDataNote?: boolean;
}

export function DraftClassCard({
  year,
  metrics,
  showAwaitingDataNote = true,
}: DraftClassCardProps) {
  const {
    totalPicks,
    awaitingDataCount,
    coreStarterCount,
    starterWhenHealthyCount,
    significantContributorCount,
    contributorRoleCount,
    depthCount,
    nonContributorCount,
    retentionCount,
  } = metrics;

  return (
    <article
      aria-labelledby={`draft-${year}-title`}
      className="draft-class-card"
    >
      <h3 id={`draft-${year}-title`}>Draft {year}</h3>
      <div className="draft-class-card__picks">{totalPicks} picks</div>
      {awaitingDataCount === totalPicks &&
      totalPicks > 0 &&
      showAwaitingDataNote ? (
        <p className="draft-class-card__pending">
          NFL season data is not available for this class yet. Outcomes and
          retention will fill in after players log regular-season snaps.
        </p>
      ) : (
        <>
          {awaitingDataCount > 0 && showAwaitingDataNote && (
            <p className="draft-class-card__pending">
              {awaitingDataCount} pick
              {awaitingDataCount === 1 ? '' : 's'} not yet in season data.
            </p>
          )}
          <dl className="draft-class-card__breakdown">
            <dt>Core starters</dt>
            <dd>{coreStarterCount}</dd>
            {starterWhenHealthyCount > 0 && (
              <>
                <dt>Starters when healthy</dt>
                <dd>{starterWhenHealthyCount}</dd>
              </>
            )}
            <dt>Significant contributors</dt>
            <dd>{significantContributorCount}</dd>
            <dt>Contributors</dt>
            <dd>{contributorRoleCount}</dd>
            <dt>Depth</dt>
            <dd>{depthCount}</dd>
            <dt>Non contributors</dt>
            <dd>{nonContributorCount}</dd>
          </dl>
          <div className="draft-class-card__retained">
            <span>Retained</span>
            <span>{retentionCount}</span>
          </div>
        </>
      )}
    </article>
  );
}
