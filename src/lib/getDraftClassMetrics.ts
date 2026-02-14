import type { DraftClass } from '../types';
import { getPlayerRole } from './getPlayerRole';

export interface DraftClassMetrics {
  totalPicks: number;
  coreStarterCount: number;
  starterWhenHealthyCount: number;
  significantContributorCount: number;
  depthCount: number;
  nonContributorCount: number;
  contributorCount: number;
  retentionCount: number;
  coreStarterRate: number;
  contributorRate: number;
  retentionRate: number;
}

export interface GetDraftClassMetricsOptions {
  /** When true, roles based only on seasons with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Compute draft class metrics for a team's picks in a given draft year.
 */
export function getDraftClassMetrics(
  draft: DraftClass,
  teamId: string,
  options?: GetDraftClassMetricsOptions,
): DraftClassMetrics {
  const picks = draft.picks.filter((p) => p.teamId === teamId);
  const totalPicks = picks.length;

  let coreStarterCount = 0;
  let starterWhenHealthyCount = 0;
  let significantContributorCount = 0;
  let depthCount = 0;
  let nonContributorCount = 0;
  let contributorCount = 0;
  let retentionCount = 0;

  const draftingTeamOnly = options?.draftingTeamOnly === true;
  for (const pick of picks) {
    const role = getPlayerRole(pick, { draftingTeamOnly });
    if (role === 'core_starter') coreStarterCount += 1;
    if (role === 'starter_when_healthy') starterWhenHealthyCount += 1;
    if (role === 'significant_contributor') significantContributorCount += 1;
    if (role === 'depth') depthCount += 1;
    if (role === 'non_contributor') nonContributorCount += 1;
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
    significantContributorCount,
    depthCount,
    nonContributorCount,
    contributorCount,
    retentionCount,
    coreStarterRate: totalPicks > 0 ? coreStarterCount / totalPicks : 0,
    contributorRate: totalPicks > 0 ? contributorCount / totalPicks : 0,
    retentionRate: totalPicks > 0 ? retentionCount / totalPicks : 0,
  };
}
