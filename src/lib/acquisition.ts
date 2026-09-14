import type { Acquisition, DraftPick } from '../types';

/**
 * Seasons an undrafted rookie contract entitles his team to.
 *
 * Three, not four. Judging a free agent over a late pick's four-year window
 * would charge him a season he was never owed — the same reasoning that gives
 * rounds 2–7 four years instead of a first-rounder's five.
 */
export const FA_WINDOW = 3;
/** Rookie deal for a first-round pick: four years plus the fifth-year option. */
const FIRST_ROUND_WINDOW = 5;
/** Rookie deal for rounds 2–7: four years, no option. */
const LATE_ROUND_WINDOW = 4;

/**
 * True when the acquisition was drafted.
 *
 * Discriminates on the presence of `round` rather than a stored `kind` tag, so
 * the existing `draft-{year}.json` files need no migration and a free agent
 * record stays exactly the fields it has.
 */
export function isDraftPick(a: Acquisition): a is DraftPick {
  return 'round' in a;
}

/**
 * How many seasons this acquisition's rookie contract entitles its team to.
 *
 * Round-dependent because the CBA is: only first-rounders carry a fifth-year
 * option. Scoring every pick against five years would charge a third-rounder
 * who played all four of his years and left in free agency with a missing
 * season he was never owed — penalising a successful outcome, and compounding
 * a bias against late rounds that over slot exists to correct.
 *
 * The round constants live here rather than in `rookieWindow.ts` so that module
 * can delegate to this one without a cycle: `rookieWindow.ts` already imports
 * scoring helpers, and this module must stay a leaf.
 */
export function acquisitionWindow(a: Acquisition): number {
  if (!isDraftPick(a)) return FA_WINDOW;
  return a.round === 1 ? FIRST_ROUND_WINDOW : LATE_ROUND_WINDOW;
}
