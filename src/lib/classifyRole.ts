import type { Role } from '../types';

/**
 * Classify player role from cumulative snap share and games played share.
 * `cumulativeSnapShare` is the effective value from `snapShareForRoleTier` —
 * stored season load when present, else `snapShare` for legacy JSON.
 * gamesPlayedShare = gamesPlayed / teamGames. First match wins.
 *
 * Significant contributor requires at least two games played: one active game can
 * show a high average-game share without representing a real season-long role.
 */
export function classifyRole(
  cumulativeSnapShare: number,
  gamesPlayedShare: number,
  gamesPlayed: number,
): Role {
  if (cumulativeSnapShare >= 0.65) {
    if (gamesPlayedShare >= 0.5) return 'core_starter';
    return 'starter_when_healthy';
  }
  if (cumulativeSnapShare >= 0.35) {
    if (gamesPlayed >= 2) return 'significant_contributor';
    if (cumulativeSnapShare >= 0.1) return 'depth';
    return 'non_contributor';
  }
  if (cumulativeSnapShare >= 0.1) return 'depth';
  return 'non_contributor';
}
