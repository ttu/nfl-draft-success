import type { DraftClass } from '../types';
import { getPlayerAverageScoreWeight, getPlayerRole } from './getPlayerRole';

export interface RollingDraftScore {
  score: number;
  totalPicks: number;
  coreStarterRate: number;
  retentionRate: number;
}

export interface GetRollingDraftScoreOptions {
  /** When true, roles based only on seasons with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Compute rolling draft score for a team over the loaded draft seasons
 * (whatever year range is in `draftClasses`, typically matching the app’s
 * selected season span).
 * Score = sum(per-pick average seasonal role weights) / total picks.
 */
export function getRollingDraftScore(
  draftClasses: DraftClass[],
  teamId: string,
  options?: GetRollingDraftScoreOptions,
): RollingDraftScore {
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
