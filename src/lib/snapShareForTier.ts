import type { Season } from '../types';

/**
 * Snap share used for role classification (Core / SWH / SC / Depth).
 * Prefers season cumulative load share when present; falls back to average
 * active-game share for older JSON without `cumulativeSnapShare`.
 *
 * Load is capped at **Avg snap** so it never implies a larger season role than
 * typical per-game usage (full-season + injury math can otherwise exceed it).
 */
export function snapShareForRoleTier(s: Season): number {
  const load = s.cumulativeSnapShare ?? s.snapShare;
  if (s.snapShare > 0 && load > s.snapShare) {
    return s.snapShare;
  }
  return load;
}
