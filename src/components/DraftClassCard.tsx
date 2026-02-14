import type { DraftClassMetrics } from '../lib/getDraftClassMetrics';

export interface DraftClassCardProps {
  year: number;
  metrics: DraftClassMetrics;
}

export function DraftClassCard({ year, metrics }: DraftClassCardProps) {
  const {
    totalPicks,
    coreStarterCount,
    starterWhenHealthyCount,
    significantContributorCount,
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
        <dt>Depth</dt>
        <dd>{depthCount}</dd>
        <dt>Non contributors</dt>
        <dd>{nonContributorCount}</dd>
      </dl>
      <div className="draft-class-card__retained">
        <span>Retained</span>
        <span>{retentionCount}</span>
      </div>
    </article>
  );
}
