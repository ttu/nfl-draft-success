import type { Season } from '../types';
import { snapShareForRoleTier } from './snapShareForTier';

/** Draft-score weights: snap share is the heavier signal (see Info modal). */
const SNAP_WEIGHT = 0.7;
const AVAILABILITY_WEIGHT = 0.3;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Continuous single-season draft score on a 0–100 scale:
 *
 *   score(season) = clamp(0.7·snapShare + 0.3·availability, 0, 1) × 100
 *
 * where `snapShare` is the role-tier snap value (position-adjusted, so
 * specialists are handled like their role classification) and `availability`
 * is games played ÷ team games. This is the per-season term averaged by
 * {@link getPlayerDraftScore} to produce a pick's overall score, and is shown
 * per row in the player career table.
 */
export function getSeasonScore(season: Season, position: string): number {
  const snap = clamp01(snapShareForRoleTier(season, position));
  const availability =
    season.teamGames > 0 ? clamp01(season.gamesPlayed / season.teamGames) : 0;
  return clamp01(SNAP_WEIGHT * snap + AVAILABILITY_WEIGHT * availability) * 100;
}
