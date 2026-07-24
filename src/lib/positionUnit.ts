import { normalizeDraftPosition } from './normalizeDraftPosition';

/** Side of the ball a draft position belongs to. */
export type PositionUnit = 'offense' | 'defense' | 'special_teams';

// Offense is the fallback bucket: QB, RB, FB, WR, TE, OT, G, C, OL, IOL.
const DEFENSE = new Set([
  'DL',
  'DE',
  'DT',
  'NT',
  'LB',
  'ILB',
  'MLB',
  'OLB',
  'EDGE',
  'CB',
  'DB',
  'NB',
  'FS',
  'SS',
  'S',
]);
const SPECIAL_TEAMS = new Set(['K', 'P', 'LS']);

/**
 * Classify a draft `position` code by side of the ball. Applies
 * {@link normalizeDraftPosition} first so aliases (e.g. `T` → `OT`) resolve.
 * Unknown codes fall back to `offense` — none are expected in current data.
 */
export function getPositionUnit(position: string): PositionUnit {
  const code = normalizeDraftPosition(position);
  if (DEFENSE.has(code)) return 'defense';
  if (SPECIAL_TEAMS.has(code)) return 'special_teams';
  return 'offense';
}
