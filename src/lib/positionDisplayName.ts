/**
 * Human-readable NFL position labels for draft `position` codes in our data.
 * Unknown codes fall back to the uppercase abbreviation.
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
  /** Draft JSON uses `S`; upstream CSV may still say SAF — treat both as safety */
  S: 'Safety',
  SAF: 'Safety',
  K: 'Kicker',
  P: 'Punter',
  LS: 'Long snapper',
};

export function getPositionDisplayName(positionCode: string): string {
  const key = positionCode.trim().toUpperCase();
  if (!key) return positionCode;
  return POSITION_LABELS[key] ?? key;
}
