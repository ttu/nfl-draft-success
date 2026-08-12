import type { DraftClass, DraftPick, Role } from '../types';
import { getPlayerRole, type GetPlayerRoleOptions } from './getPlayerRole';
import { playedSeasons } from './seasonPlayed';

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
 *
 * Follows the same lens as the role chip shown beside it. This used to be
 * career-wide regardless, which put a career number next to a drafting-team
 * verdict: Wyatt Teller read `82 · DEPTH`, the 82 earned over six Pro Bowl
 * seasons in Cleveland and the Depth earned in Buffalo, who drafted him and
 * moved him after a year for nothing much. Both true, and contradictory in one
 * row. The app credits a pick to the team that drafted it, so the load does too.
 */
export function avgLoad(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): number {
  const played = playedSeasons(pick);
  const seasons =
    options?.draftingTeamOnly === true
      ? played.filter((s) => s.retained)
      : played;
  if (seasons.length === 0) return 0;
  const total = seasons.reduce(
    (a, s) => a + (s.cumulativeSnapShare ?? s.snapShare ?? 0),
    0,
  );
  return total / seasons.length;
}

/**
 * Builds the "this position's class, ranked by load" cohort for a player detail
 * view: every same-position pick from the target's draft year, ranked by load
 * on the caller's lens and capped at `limit`, plus the target's 1-based rank within that list
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
      load: avgLoad(p, options),
      role: getPlayerRole(p, options),
    }))
    .sort((a, b) => b.load - a.load)
    .slice(0, limit);

  const rank = members.findIndex((m) => m.pick.playerId === pick.playerId) + 1;

  return { members, rank };
}
