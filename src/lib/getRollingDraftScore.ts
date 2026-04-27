import type { DraftClass } from '../types';
import {
  getPlayerAverageScoreWeight,
  getPlayerRole,
  pickHasSeasonSnapData,
} from './getPlayerRole';

export interface RollingDraftScore {
  score: number;
  /** Team picks in the loaded draft span (includes picks with no season rows yet). */
  totalPicks: number;
  /** Picks with at least one season row in the data (excludes only classes with no `seasons` yet). */
  scoredPickCount: number;
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
  let scoredPickCount = 0;
  let weightSum = 0;
  let coreStarterCount = 0;
  let retentionCount = 0;

  const draftingTeamOnly = options?.draftingTeamOnly === true;
  for (const draft of draftClasses) {
    const picks = draft.picks.filter((p) => p.teamId === teamId);
    for (const pick of picks) {
      totalPicks += 1;
      const opts = { draftingTeamOnly };
      if (!pickHasSeasonSnapData(pick)) continue;
      scoredPickCount += 1;
      weightSum += getPlayerAverageScoreWeight(pick, opts);
      if (getPlayerRole(pick, opts) === 'core_starter') coreStarterCount += 1;

      const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
      if (latestSeason?.retained) retentionCount += 1;
    }
  }

  return {
    score: scoredPickCount > 0 ? weightSum / scoredPickCount : 0,
    totalPicks,
    scoredPickCount,
    coreStarterRate:
      scoredPickCount > 0 ? coreStarterCount / scoredPickCount : 0,
    retentionRate: scoredPickCount > 0 ? retentionCount / scoredPickCount : 0,
  };
}
