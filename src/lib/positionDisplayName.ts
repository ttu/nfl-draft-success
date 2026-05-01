/**
 * Human-readable NFL position labels for draft `position` codes in our data.
 * Expects canonical codes from JSON / routing (see {@link normalizeDraftPosition}
 * for upstream aliases). Unknown codes fall back to the uppercase abbreviation.
 */
const POSITION_LABELS: Record<string, string> = {
  QB: 'Quarterback',
  RB: 'Running back',
  FB: 'Fullback',
  WR: 'Wide receiver',
  TE: 'Tight end',
  OT: 'Offensive tackle',
  G: 'Guard',
  C: 'Center',
  OL: 'Offensive line',
  IOL: 'Interior offensive line',
  DL: 'Defensive line',
  DE: 'Defensive end',
  DT: 'Defensive tackle',
  NT: 'Nose tackle',
  LB: 'Linebacker',
  ILB: 'Inside linebacker',
  MLB: 'Middle linebacker',
  OLB: 'Outside linebacker',
  EDGE: 'Edge rusher',
  CB: 'Cornerback',
  DB: 'Defensive back',
  NB: 'Nickel back',
  FS: 'Free safety',
  SS: 'Strong safety',
  S: 'Safety',
  K: 'Kicker',
  P: 'Punter',
  LS: 'Long snapper',
};

export function getPositionDisplayName(positionCode: string): string {
  const trimmed = positionCode.trim();
  if (!trimmed) return positionCode;
  const key = trimmed.toUpperCase();
  return POSITION_LABELS[key] ?? key;
}
