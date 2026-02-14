import type { DraftClassMetrics } from '../lib/getDraftClassMetrics';

export interface DraftClassCardProps {
  year: number;
  metrics: DraftClassMetrics;
}

export function DraftClassCard({ year, metrics }: DraftClassCardProps) {
  const { totalPicks, coreStarterCount, contributorCount, retentionCount } =
    metrics;

  return (
    <article aria-labelledby={`draft-${year}-title`}>
      <h3 id={`draft-${year}-title`}>Draft {year}</h3>
      <dl>
        <dt>Picks</dt>
        <dd>{totalPicks}</dd>
        <dt>Core starters</dt>
        <dd>{coreStarterCount}</dd>
        <dt>Contributors</dt>
        <dd>{contributorCount}</dd>
        <dt>Retained</dt>
        <dd>{retentionCount}</dd>
      </dl>
    </article>
  );
}
