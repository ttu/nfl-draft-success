import type { Role } from '../types';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';

/**
 * Core Starter / Starter-when-healthy floor on the (position-adjusted) tier
 * share. Exported so UI can show the concrete per-position snap threshold
 * (`CORE_TIER_THRESHOLD × positionBaseline`) without hardcoding it.
 */
export const CORE_TIER_THRESHOLD = 0.65;

/**
 * Significant Contributor floor for scrimmage roles: tier bands match
 * offense/defense usage curves. Exported (like {@link CORE_TIER_THRESHOLD}) so
 * UI can render concrete per-position thresholds without hardcoding them.
 */
export const SIGNIFICANT_TIER_THRESHOLD = 0.35;
/** Contributor floor (below Significant, above Depth). */
export const CONTRIBUTOR_TIER_THRESHOLD = 0.2;
/** Depth floor; below this a season is Non-Contributor. */
export const DEPTH_TIER_THRESHOLD = 0.1;
/**
 * K/P/LS: per-game share is max(off%, def%, st%); full-time specialists often
 * land in the low-mid 30% range vs team snaps, so the 35% bar mislabels them.
 * Exported so UI can render specialist thresholds (they are baseline-exempt).
 */
export const SIGNIFICANT_TIER_THRESHOLD_SPECIALIST = 0.32;

/**
 * Classify player role from effective tier share and games played share.
 * First argument is `snapShareForRoleTier(season, position)` — stored season
 * load when present (non-specialists), else `snapShare` for legacy JSON;
 * kickers/punters/long snappers use `snapShare`.
 * gamesPlayedShare = gamesPlayed / teamGames. First match wins.
 *
 * Between 10% and 35% load: **Depth** (10–20%) vs **Contributor** (20–35%) splits
 * limited / gadget usage from clear rotation snaps (specialists use a lower SC
 * floor; see `SIGNIFICANT_TIER_THRESHOLD_SPECIALIST`).
 */
export function classifyRole(
  cumulativeSnapShare: number,
  gamesPlayedShare: number,
  _gamesPlayed: number,
  position?: string,
): Role {
  const scThreshold = isSpecialTeamsSpecialistPosition(undefined, position)
    ? SIGNIFICANT_TIER_THRESHOLD_SPECIALIST
    : SIGNIFICANT_TIER_THRESHOLD;

  if (cumulativeSnapShare >= CORE_TIER_THRESHOLD) {
    if (gamesPlayedShare >= 0.5) return 'core_starter';
    return 'starter_when_healthy';
  }
  if (cumulativeSnapShare >= scThreshold) return 'significant_contributor';
  if (cumulativeSnapShare >= CONTRIBUTOR_TIER_THRESHOLD) return 'contributor';
  if (cumulativeSnapShare >= DEPTH_TIER_THRESHOLD) return 'depth';
  return 'non_contributor';
}
