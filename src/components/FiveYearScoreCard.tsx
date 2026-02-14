import type { FiveYearScore } from '../lib/getFiveYearScore';

export interface TeamRanking {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

export interface FiveYearScoreCardProps {
  score: FiveYearScore;
  yearCount: number;
  rank?: {
    rank: number;
    total: number;
    rankings: TeamRanking[];
  } | null;
  onShowRankings?: () => void;
}

export function FiveYearScoreCard({
  score,
  yearCount,
  rank,
  onShowRankings,
}: FiveYearScoreCardProps) {
  const { score: value, totalPicks, coreStarterRate, retentionRate } = score;
  const title = `${yearCount}-Year Draft Score`;

  return (
    <article aria-labelledby="draft-score-title">
      <h3 id="draft-score-title">{title}</h3>
      <dl>
        <dt>Score</dt>
        <dd>
          {value.toFixed(2)}
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
              {' '}
              (Rank {rank.rank} of {rank.total})
            </button>
          )}
        </dd>
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
