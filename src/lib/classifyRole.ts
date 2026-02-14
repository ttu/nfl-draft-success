import type { Role } from '../types';

/**
 * Classify player role from a single season's snap share and games played share.
 * gamesPlayedShare = gamesPlayed / teamGames
 * First match wins.
 */
export function classifyRole(
  snapShare: number,
  gamesPlayedShare: number,
): Role {
  if (snapShare >= 0.65) {
    if (gamesPlayedShare >= 0.5) return 'core_starter';
    return 'starter_when_healthy';
  }
  if (snapShare >= 0.35) return 'significant_contributor';
  if (snapShare >= 0.1) return 'depth';
  return 'non_contributor';
}
