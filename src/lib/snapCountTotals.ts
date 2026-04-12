/**
 * Helpers for cumulative (season load) snap share from nflverse snap_counts rows.
 * Used by scripts/update-data.ts; see docs/calculations.md §1.1–1.2.
 */

const PCT_EPS = 1e-9;

/** Team offensive + defensive snap capacity for one game (derived from any player row). */
export function teamScrimmagePlaysFromRow(
  offenseSnaps: number,
  offensePct: number,
  defenseSnaps: number,
  defensePct: number,
): number {
  const teamOff = offensePct > PCT_EPS ? offenseSnaps / offensePct : 0;
  const teamDef = defensePct > PCT_EPS ? defenseSnaps / defensePct : 0;
  return teamOff + teamDef;
}

/** Team special-teams snap capacity for one game. */
export function teamStPlaysFromRow(stSnaps: number, stPct: number): number {
  return stPct > PCT_EPS ? stSnaps / stPct : 0;
}

/**
 * Player snap numerator for cumulative share (matches role rules: ST included only for K/P/LS).
 */
export function playerSnapsForCumulativeLoad(
  offenseSnaps: number,
  defenseSnaps: number,
  stSnaps: number,
  isSpecialTeamsSpecialist: boolean,
): number {
  if (isSpecialTeamsSpecialist) {
    return offenseSnaps + defenseSnaps + stSnaps;
  }
  return offenseSnaps + defenseSnaps;
}

/**
 * Team snap denominator for one game for cumulative load share.
 * Specialists use offense + defense + ST capacity; others use scrimmage only.
 */
export function teamDenominatorForCumulativeLoad(
  offenseSnaps: number,
  offensePct: number,
  defenseSnaps: number,
  defensePct: number,
  stSnaps: number,
  stPct: number,
  isSpecialTeamsSpecialist: boolean,
): number {
  const scrim = teamScrimmagePlaysFromRow(
    offenseSnaps,
    offensePct,
    defenseSnaps,
    defensePct,
  );
  if (isSpecialTeamsSpecialist) {
    return scrim + teamStPlaysFromRow(stSnaps, stPct);
  }
  return scrim;
}
