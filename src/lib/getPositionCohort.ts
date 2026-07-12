import type { DraftClass, DraftPick, Role } from '../types';
import { getPlayerRole, type GetPlayerRoleOptions } from './getPlayerRole';

/** A same-position classmate ranked against the target pick by career load. */
export interface CohortMember {
  pick: DraftPick;
  /** Mean season load (cumulative snap share) across all seasons, 0–1. */
  load: number;
  role: Role;
}

export interface PositionCohort {
  /** Same-position classmates, sorted by load descending, capped at the limit. */
  members: CohortMember[];
  /** 1-based rank of the target pick within `members`; 0 when it is not shown. */
  rank: number;
}

/**
 * Mean season load for a pick — the average of each season's cumulative snap
 * share (falling back to that season's snap share when cumulative is absent).
 * Unlike the draft score this is not `draftingTeamOnly`-filtered: it summarizes
 * a player's on-field volume across their whole career for cohort comparison.
 */
export function avgLoad(pick: DraftPick): number {
  if (pick.seasons.length === 0) return 0;
  const total = pick.seasons.reduce(
    (a, s) => a + (s.cumulativeSnapShare ?? s.snapShare ?? 0),
    0,
  );
  return total / pick.seasons.length;
}

/**
 * Builds the "this position's class, ranked by load" cohort for a player detail
 * view: every same-position pick from the target's draft year, ranked by career
 * load and capped at `limit`, plus the target's 1-based rank within that list
 * (0 when the target sits outside the capped list).
 */
export function getPositionCohort(
  draftClasses: DraftClass[],
  draftYear: number,
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
  limit = 8,
): PositionCohort {
  const classmates =
    draftClasses
      .find((dc) => dc.year === draftYear)
      ?.picks.filter((p) => p.position === pick.position) ?? [];

  const members = classmates
    .map((p) => ({
      pick: p,
      load: avgLoad(p),
      role: getPlayerRole(p, options),
    }))
    .sort((a, b) => b.load - a.load)
    .slice(0, limit);

  const rank = members.findIndex((m) => m.pick.playerId === pick.playerId) + 1;

  return { members, rank };
}
