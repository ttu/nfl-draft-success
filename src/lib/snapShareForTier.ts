import type { Season } from '../types';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';

/**
 * Snap share used for role classification (Core / SWH / SC / Depth).
 * Prefers season cumulative load share when present; falls back to average
 * active-game share for older JSON without `cumulativeSnapShare`.
 *
 * Load is capped at **Avg snap** so it never implies a larger season role than
 * typical per-game usage (full-season + injury math can otherwise exceed it).
 *
 * **Kickers, punters, long snappers:** Cumulative load is player snaps ÷ the
 * team’s full scrimmage + ST capacity, so even full-time specialists stay in
 * the ~10% range. Tier thresholds match **avg** in-game role share (`snapShare`);
 * use that for classification instead of cumulative load.
 */
export function snapShareForRoleTier(s: Season, position?: string): number {
  const load = s.cumulativeSnapShare ?? s.snapShare;
  if (isSpecialTeamsSpecialistPosition(undefined, position)) {
    if (s.snapShare > 0 && load > s.snapShare) {
      return s.snapShare;
    }
    if (s.snapShare > 0) {
      return s.snapShare;
    }
    return load;
  }
  if (s.snapShare > 0 && load > s.snapShare) {
    return s.snapShare;
  }
  return load;
}

/** Stored season load (vs full team capacity) for tables; specialists’ role tiers use `snapShareForRoleTier` instead. */
export function seasonLoadDisplayShare(s: Season): number {
  return s.cumulativeSnapShare ?? s.snapShare;
}
