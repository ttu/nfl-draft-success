/**
 * Per-game snap share used when aggregating season snapShare from nflverse
 * snap_counts (see docs/calculations.md). Kickers/punters/long snappers need
 * special-teams pct in the max; positional players do not, or ST-only games
 * would read like high "snap share" without meaningful offense/defense play.
 */
export function isSpecialTeamsSpecialistPosition(
  positionGroup: string | undefined,
  position: string | undefined,
): boolean {
  const pg = (positionGroup ?? '').trim();
  if (pg === 'SPEC') return true;
  const p = (position ?? '').trim().toUpperCase();
  return p === 'K' || p === 'P' || p === 'LS';
}

/**
 * Single-game contribution share (0–1) toward season-average snapShare.
 */
export function perGameSnapShareForRole(
  offensePct: number,
  defensePct: number,
  stPct: number,
  positionGroup: string | undefined,
  position: string | undefined,
): number {
  if (isSpecialTeamsSpecialistPosition(positionGroup, position)) {
    return Math.max(offensePct, defensePct, stPct);
  }
  return Math.max(offensePct, defensePct);
}
