import type { Role } from '../types';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';

/** Scrimmage roles: tier bands match offense/defense usage curves. */
const SC_THRESHOLD_DEFAULT = 0.35;
/**
 * K/P/LS: per-game share is max(off%, def%, st%); full-time specialists often
 * land in the low-mid 30% range vs team snaps, so the 35% bar mislabels them.
 */
const SC_THRESHOLD_SPECIALIST = 0.32;

/**
 * Classify player role from effective tier share and games played share.
 * First argument is `snapShareForRoleTier(season, position)` — stored season
 * load when present (non-specialists), else `snapShare` for legacy JSON;
 * kickers/punters/long snappers use `snapShare`.
 * gamesPlayedShare = gamesPlayed / teamGames. First match wins.
 *
 * Between 10% and 35% load: **Depth** (10–20%) vs **Contributor** (20–35%) splits
 * limited / gadget usage from clear rotation snaps (specialists use a lower SC
 * floor; see `SC_THRESHOLD_SPECIALIST`).
 */
export function classifyRole(
  cumulativeSnapShare: number,
  gamesPlayedShare: number,
  _gamesPlayed: number,
  position?: string,
): Role {
  const scThreshold = isSpecialTeamsSpecialistPosition(undefined, position)
    ? SC_THRESHOLD_SPECIALIST
    : SC_THRESHOLD_DEFAULT;

  if (cumulativeSnapShare >= 0.65) {
    if (gamesPlayedShare >= 0.5) return 'core_starter';
    return 'starter_when_healthy';
  }
  if (cumulativeSnapShare >= scThreshold) {
    return 'significant_contributor';
  }
  if (cumulativeSnapShare >= 0.2) return 'contributor';
  if (cumulativeSnapShare >= 0.1) return 'depth';
  return 'non_contributor';
}
