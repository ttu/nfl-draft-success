import type { DraftClass } from '../types';
import { getPlayerAverageScoreWeight, getPlayerRole } from './getPlayerRole';

export interface FiveYearScore {
  score: number;
  totalPicks: number;
  coreStarterRate: number;
  retentionRate: number;
}

export interface GetFiveYearScoreOptions {
  /** When true, roles based only on seasons with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Compute 5-year rolling draft score for a team.
 * Score = sum(per-pick average seasonal role weights) / total picks.
 */
export function getFiveYearScore(
  draftClasses: DraftClass[],
  teamId: string,
  options?: GetFiveYearScoreOptions,
): FiveYearScore {
  let totalPicks = 0;
  let weightSum = 0;
  let coreStarterCount = 0;
  let retentionCount = 0;

  const draftingTeamOnly = options?.draftingTeamOnly === true;
  for (const draft of draftClasses) {
    const picks = draft.picks.filter((p) => p.teamId === teamId);
    for (const pick of picks) {
      totalPicks += 1;
      const opts = { draftingTeamOnly };
      weightSum += getPlayerAverageScoreWeight(pick, opts);
      if (getPlayerRole(pick, opts) === 'core_starter') coreStarterCount += 1;

      const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
      if (latestSeason?.retained) retentionCount += 1;
    }
  }

  return {
    score: totalPicks > 0 ? weightSum / totalPicks : 0,
    totalPicks,
    coreStarterRate: totalPicks > 0 ? coreStarterCount / totalPicks : 0,
    retentionRate: totalPicks > 0 ? retentionCount / totalPicks : 0,
  };
}
