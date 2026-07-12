import type { DraftClass } from '../types';
import {
  getDraftClassMetrics,
  type GetDraftClassMetricsOptions,
} from './getDraftClassMetrics';

/** One year's point in the "score, year by year" trend for a team. */
export interface YearScore {
  year: number;
  /** Mean per-pick draft score for this class (0–100). */
  score: number;
  /** Whether the class has any picks with season data yet. */
  hasData: boolean;
}

/**
 * Per-class score for a team's "score, year by year" trend. Each draft class is
 * scored on its own as the mean continuous per-pick draft score of its scored
 * picks (0–100) — the same measure as the headline draft score, so the trend
 * decomposes the headline (which is the pick-weighted mean of these class
 * scores) year by year. Returned in ascending year order.
 */
export function getScoreByYear(
  draftClasses: DraftClass[],
  teamId: string,
  options?: GetDraftClassMetricsOptions,
): YearScore[] {
  return [...draftClasses]
    .sort((a, b) => a.year - b.year)
    .map((dc) => {
      const metrics = getDraftClassMetrics(dc, teamId, options);
      const scoredPickCount = metrics.totalPicks - metrics.awaitingDataCount;
      return {
        year: dc.year,
        score: metrics.draftScore,
        hasData: scoredPickCount > 0,
      };
    });
}
