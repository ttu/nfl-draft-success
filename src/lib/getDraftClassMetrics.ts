import type { DraftClass } from '../types';
import { getPlayerRole } from './getPlayerRole';

export interface DraftClassMetrics {
  totalPicks: number;
  coreStarterCount: number;
  starterWhenHealthyCount: number;
  contributorCount: number;
  retentionCount: number;
  coreStarterRate: number;
  contributorRate: number;
  retentionRate: number;
}

/**
 * Compute draft class metrics for a team's picks in a given draft year.
 */
export function getDraftClassMetrics(
  draft: DraftClass,
  teamId: string,
): DraftClassMetrics {
  const picks = draft.picks.filter((p) => p.teamId === teamId);
  const totalPicks = picks.length;

  let coreStarterCount = 0;
  let starterWhenHealthyCount = 0;
  let contributorCount = 0;
  let retentionCount = 0;

  for (const pick of picks) {
    const role = getPlayerRole(pick);
    if (role === 'core_starter') coreStarterCount += 1;
    if (role === 'starter_when_healthy') starterWhenHealthyCount += 1;
    if (
      role === 'core_starter' ||
      role === 'starter_when_healthy' ||
      role === 'significant_contributor' ||
      role === 'depth'
    ) {
      contributorCount += 1;
    }

    const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
    const retained = latestSeason?.retained ?? false;
    if (retained) retentionCount += 1;
  }

  return {
    totalPicks,
    coreStarterCount,
    starterWhenHealthyCount,
    contributorCount,
    retentionCount,
    coreStarterRate: totalPicks > 0 ? coreStarterCount / totalPicks : 0,
    contributorRate: totalPicks > 0 ? contributorCount / totalPicks : 0,
    retentionRate: totalPicks > 0 ? retentionCount / totalPicks : 0,
  };
}
