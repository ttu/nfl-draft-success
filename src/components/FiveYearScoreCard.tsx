import type { FiveYearScore } from '../lib/getFiveYearScore';

export interface FiveYearScoreCardProps {
  score: FiveYearScore;
  yearCount: number;
}

export function FiveYearScoreCard({
  score,
  yearCount,
}: FiveYearScoreCardProps) {
  const { score: value, totalPicks, coreStarterRate, retentionRate } = score;
  const title = `${yearCount}-Year Draft Score`;

  return (
    <article aria-labelledby="draft-score-title">
      <h3 id="draft-score-title">{title}</h3>
      <dl>
        <dt>Score</dt>
        <dd>{value.toFixed(2)}</dd>
        <dt>Core Starter %</dt>
        <dd>{(coreStarterRate * 100).toFixed(1)}%</dd>
        <dt>Retention %</dt>
        <dd>{(retentionRate * 100).toFixed(1)}%</dd>
        <dt>Total picks</dt>
        <dd>{totalPicks}</dd>
      </dl>
    </article>
  );
}
