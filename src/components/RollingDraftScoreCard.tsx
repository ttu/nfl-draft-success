import type { RollingDraftScore } from '../lib/getRollingDraftScore';

export interface TeamRanking {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

export interface RollingDraftScoreCardProps {
  score: RollingDraftScore;
  yearCount: number;
  rank?: {
    rank: number;
    total: number;
    rankings: TeamRanking[];
  } | null;
  onShowRankings?: () => void;
}

function seasonsLabel(count: number): string {
  return `${count} season${count === 1 ? '' : 's'}`;
}

export function RollingDraftScoreCard({
  score,
  yearCount,
  rank,
  onShowRankings,
}: RollingDraftScoreCardProps) {
  const { score: value, totalPicks, coreStarterRate, retentionRate } = score;

  const metaId = 'draft-score-meta';

  return (
    <article aria-labelledby="draft-score-title" aria-describedby={metaId}>
      <h3 id="draft-score-title">Rolling draft score</h3>
      <p id={metaId} className="draft-score__meta">
        {seasonsLabel(yearCount)}
      </p>
      <dl>
        <dt>Score</dt>
        <dd className="draft-score__value">
          <span className="draft-score__number">{value.toFixed(2)}</span>
          {rank && rank.rank > 0 && (
            <button
              type="button"
              className="draft-score__rank"
              onClick={() =>
                onShowRankings && rank.rankings?.length
                  ? onShowRankings()
                  : undefined
              }
              aria-label={`Rank ${rank.rank} of ${rank.total} NFL teams. Click to view full rankings`}
              disabled={!onShowRankings || !rank.rankings?.length}
            >
              (Rank {rank.rank} of {rank.total})
            </button>
          )}
        </dd>
        <dt>Core Starter %</dt>
        <dd>{(coreStarterRate * 100).toFixed(1)}%</dd>
        <dt>Retention %</dt>
        <dd>{(retentionRate * 100).toFixed(1)}%</dd>
        <dt className="app-score__total-label">Total picks</dt>
        <dd className="app-score__total-value">{totalPicks}</dd>
      </dl>
    </article>
  );
}
