import type { Season } from '../types';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';
import { normalizeSnapShareForPosition } from './positionBaseline';

/**
 * Snap share used for role classification (Core / SWH / SC / Depth) and the
 * season score. Prefers season cumulative load share when present; falls back to
 * average active-game share for older JSON without `cumulativeSnapShare`.
 *
 * Load is capped at **Avg snap** so it never implies a larger season role than
 * typical per-game usage (full-season + injury math can otherwise exceed it).
 *
 * The raw share is then **position-adjusted**: divided by the position's
 * full-time-starter baseline (see `positionBaseline.ts`) so that a lead running
 * back (~65% of snaps) and a starting tackle (~100%) both read as full-time.
 * Specialists and unknown positions have a baseline of 1, i.e. no rescaling.
 *
 * **Kickers, punters, long snappers:** Cumulative load is player snaps ÷ the
 * team’s full scrimmage + ST capacity, so even full-time specialists stay in
 * the ~10% range. Tier thresholds match **avg** in-game role share (`snapShare`);
 * use that for classification instead of cumulative load. They are exempt from
 * baseline normalization for the same reason.
 */
export function snapShareForRoleTier(s: Season, position?: string): number {
  const raw = rawSnapShareForRoleTier(s, position);
  if (isSpecialTeamsSpecialistPosition(undefined, position)) return raw;
  return normalizeSnapShareForPosition(raw, position);
}

/**
 * The same season load reading **before** position adjustment: cumulative load
 * preferred, capped at avg snap, specialists taking avg share directly.
 *
 * This is what baseline derivation must consume. Deriving from the normalized
 * reading is self-referential — it divides by the baselines it is about to
 * overwrite, so a position's p90 lands on its own p90 (i.e. 1.0) and position
 * adjustment silently turns into a no-op. See `deriveBaselines.ts`.
 */
export function rawSnapShareForRoleTier(s: Season, position?: string): number {
  const load = s.cumulativeSnapShare ?? s.snapShare;
  if (isSpecialTeamsSpecialistPosition(undefined, position)) {
    return s.snapShare > 0 ? s.snapShare : load;
  }
  return s.snapShare > 0 && load > s.snapShare ? s.snapShare : load;
}

/** Stored season load (vs full team capacity) for tables; specialists’ role tiers use `snapShareForRoleTier` instead. */
export function seasonLoadDisplayShare(s: Season): number {
  return s.cumulativeSnapShare ?? s.snapShare;
}
