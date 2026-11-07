import type { Acquisition, DraftClass, DraftPick, Role } from '../types';
import {
  getPlayerDraftScore,
  getPlayerRole,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/** A same-position classmate ranked against the target pick by draft score. */
export interface CohortMember {
  pick: DraftPick;
  /** Draft score (drafting-team lens), the same number the player page headlines. */
  score: number;
  role: Role;
}

export interface PositionCohort {
  /** Same-position classmates, sorted by draft score descending, capped at the limit. */
  members: CohortMember[];
  /** 1-based rank of the target pick within `members`; 0 when it is not shown. */
  rank: number;
}

/**
 * Builds the "this position's class, ranked by draft score" cohort for a player detail
 * view: every same-position pick from the target's draft year, ranked by draft
 * score and capped at `limit`, plus the target's 1-based rank within that list
 * (0 when the target sits outside the capped list).
 *
 * `pick` is typed `Acquisition` rather than `DraftPick` so an undrafted free
 * agent's detail view can call this too — the classmates it lists are always
 * drafted picks (`draftClasses` holds nothing else), only `pick.position` and
 * `pick.playerId` are read from the target, and a free agent's `playerId`
 * simply never matches one of them, leaving `rank` at 0.
 */
export function getPositionCohort(
  draftClasses: DraftClass[],
  draftYear: number,
  pick: Acquisition,
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
      // Always the drafting-team score: it is the number the player hero shows
      // as "Draft score", so a row never disagrees with the page it links to.
      score: getPlayerDraftScore(p, { draftingTeamOnly: true }),
      role: getPlayerRole(p, options),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const rank = members.findIndex((m) => m.pick.playerId === pick.playerId) + 1;

  return { members, rank };
}
