import type { FreeAgent, FreeAgentClass } from '../types';
import {
  getPlayerDraftScore,
  getPlayerRole,
  pickHasSeasonSnapData,
  type GetPlayerRoleOptions,
} from './getPlayerRole';
import { getAcquisitionOverSlot } from './overSlot';
import { isDraftPickRetainedLatest } from './draftPickLatestSeason';

/**
 * A team's undrafted free-agent record over the loaded classes.
 *
 * Reported beside the rolling draft score, never merged into it: the draft
 * number and every ranking derived from it keep their existing meaning, and a
 * team that develops undrafted players gets credit on its own axis.
 */
export interface FreeAgentScore {
  score: number;
  /** Mean score above the undrafted cohort's own expectation. */
  skillScore: number;
  totalFreeAgents: number;
  scoredCount: number;
  coreStarterRate: number;
  coreStarterCount: number;
  retentionRate: number;
  retainedCount: number;
}

/** One team's free agents across `classes`, in class order. */
export function getTeamFreeAgents(
  classes: FreeAgentClass[],
  teamId: string,
): FreeAgent[] {
  const out: FreeAgent[] = [];
  for (const cls of classes) {
    for (const fa of cls.freeAgents) {
      if (fa.teamId === teamId) out.push(fa);
    }
  }
  return out;
}

export function getFreeAgentScore(
  classes: FreeAgentClass[],
  teamId: string,
  options?: GetPlayerRoleOptions,
): FreeAgentScore {
  const opts = { draftingTeamOnly: options?.draftingTeamOnly === true };
  const all = getTeamFreeAgents(classes, teamId);
  const scored = all.filter(pickHasSeasonSnapData);

  let scoreSum = 0;
  let skillSum = 0;
  let coreStarterCount = 0;
  let retainedCount = 0;
  for (const fa of scored) {
    scoreSum += getPlayerDraftScore(fa, opts);
    skillSum += getAcquisitionOverSlot(fa, opts);
    if (getPlayerRole(fa, opts) === 'core_starter') coreStarterCount += 1;
    if (isDraftPickRetainedLatest(fa)) retainedCount += 1;
  }

  const scoredCount = scored.length;
  return {
    score: scoredCount > 0 ? scoreSum / scoredCount : 0,
    skillScore: scoredCount > 0 ? skillSum / scoredCount : 0,
    totalFreeAgents: all.length,
    scoredCount,
    coreStarterRate: scoredCount > 0 ? coreStarterCount / scoredCount : 0,
    coreStarterCount,
    retentionRate: scoredCount > 0 ? retainedCount / scoredCount : 0,
    retainedCount,
  };
}
