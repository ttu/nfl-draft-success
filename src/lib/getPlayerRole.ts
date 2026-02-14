import type { DraftPick, Role } from '../types';
import { classifyRole } from './classifyRole';

const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

function roleWeight(r: Role): number {
  return ROLE_ORDER.indexOf(r);
}

export interface GetPlayerRoleOptions {
  /** When true, only consider seasons when player was with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Get player's highest achieved role across seasons.
 * @param draftingTeamOnly - When true, only seasons where retained (primary team = drafting team) are used
 */
export function getPlayerRole(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): Role {
  const seasons =
    options?.draftingTeamOnly === true
      ? pick.seasons.filter((s) => s.retained)
      : pick.seasons;

  if (seasons.length === 0) return 'non_contributor';

  // Most recent season with 0 games = free agent, cut, holdout → not a starter
  const sortedByYear = [...seasons].sort((a, b) => b.year - a.year);
  if (sortedByYear[0].gamesPlayed === 0) return 'non_contributor';

  let best: Role = 'non_contributor';
  for (const s of seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(s.snapShare, gamesPlayedShare);
    if (roleWeight(role) > roleWeight(best)) best = role;
  }
  return best;
}
