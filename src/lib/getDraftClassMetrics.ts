import type { DraftClass } from '../types';
import { isDraftPickRetainedLatest } from './draftPickLatestSeason';
import { getPlayerRole } from './getPlayerRole';

export interface DraftClassMetrics {
  totalPicks: number;
  /** Picks with no `seasons` rows yet (e.g. current-year draft before NFL data exists). */
  awaitingDataCount: number;
  coreStarterCount: number;
  starterWhenHealthyCount: number;
  significantContributorCount: number;
  contributorRoleCount: number;
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

  let awaitingDataCount = 0;
  let coreStarterCount = 0;
  let starterWhenHealthyCount = 0;
  let significantContributorCount = 0;
  let contributorRoleCount = 0;
  let depthCount = 0;
  let nonContributorCount = 0;
  let contributorCount = 0;
  let retentionCount = 0;

  const draftingTeamOnly = options?.draftingTeamOnly === true;
  for (const pick of picks) {
    if (pick.seasons.length === 0) {
      awaitingDataCount += 1;
      continue;
    }
    const role = getPlayerRole(pick, { draftingTeamOnly });
    switch (role) {
      case 'core_starter':
        coreStarterCount += 1;
        contributorCount += 1;
        break;
      case 'starter_when_healthy':
        starterWhenHealthyCount += 1;
        contributorCount += 1;
        break;
      case 'significant_contributor':
        significantContributorCount += 1;
        contributorCount += 1;
        break;
      case 'contributor':
        contributorRoleCount += 1;
        contributorCount += 1;
        break;
      case 'depth':
        depthCount += 1;
        contributorCount += 1;
        break;
      case 'non_contributor':
        nonContributorCount += 1;
        break;
    }

    if (isDraftPickRetainedLatest(pick)) retentionCount += 1;
  }

  const scoredPickCount = totalPicks - awaitingDataCount;

  return {
    totalPicks,
    awaitingDataCount,
    coreStarterCount,
    starterWhenHealthyCount,
    significantContributorCount,
    contributorRoleCount,
    depthCount,
    nonContributorCount,
    contributorCount,
    retentionCount,
    coreStarterRate:
      scoredPickCount > 0 ? coreStarterCount / scoredPickCount : 0,
    contributorRate:
      scoredPickCount > 0 ? contributorCount / scoredPickCount : 0,
    retentionRate: scoredPickCount > 0 ? retentionCount / scoredPickCount : 0,
  };
}
