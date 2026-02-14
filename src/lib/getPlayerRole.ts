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

/**
 * Get player's highest achieved role across all seasons.
 */
export function getPlayerRole(pick: DraftPick): Role {
  if (pick.seasons.length === 0) return 'non_contributor';

  let best: Role = 'non_contributor';
  for (const s of pick.seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(s.snapShare, gamesPlayedShare);
    if (roleWeight(role) > roleWeight(best)) best = role;
  }
  return best;
}
