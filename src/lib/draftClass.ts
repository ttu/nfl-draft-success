import type { DraftClass, DraftPick } from '../types';

/**
 * A class as it exists before stamping: exactly `DraftClass`, minus the
 * `draftYear` that does not appear in `draft-{year}.json`.
 *
 * `DraftClass` is assignable to this, so already-stamped classes pass through
 * unchanged. Tests build class literals in this shape and stamp them, which
 * keeps fixtures free of a redundant per-pick year *and* runs them through the
 * same path production uses.
 */
export interface RawDraftClass {
  year: number;
  picks: Omit<DraftPick, 'draftYear'>[];
}

/**
 * Stamps each pick in a freshly-parsed class with its `draftYear`.
 *
 * `draft-{year}.json` carries the year once, on the class, but scoring needs it
 * per pick: {@link getPlayerDraftScore} divides by the rookie-contract window,
 * which requires knowing how many seasons have elapsed since the pick was made.
 * It receives a `DraftPick` and nothing else.
 *
 * The year is taken from `cls.year` rather than from any pick payload, so a
 * stale or hand-edited `draftYear` in the JSON cannot survive a load.
 *
 * `pick.seasons[0].year` would give the same answer today — `update-data.ts`
 * emits a row per elapsed season, including zero-game ones, so first rows line
 * up with draft years across every pick in the dataset. It is deliberately not
 * used. That alignment is a property of the current emit behaviour, not a
 * guarantee; if a refresh ever stopped emitting empty rows, a pick who missed
 * his rookie year would be measured against a *shorter* window and score
 * *higher* for having missed it. Silent, backwards, and invisible from outside
 * the scoring function.
 *
 * Mutates in place and returns the same object: called once per class at load,
 * before anything caches or scores, and copying ~260 picks per class earns
 * nothing. See the memo note in {@link getPlayerRole} — picks are immutable
 * *once loaded*, and this runs before that point.
 *
 * Every path that parses draft JSON into a `DraftClass` must call this:
 * `loadData` for the app, and each `scripts/` generator that reads the files
 * directly. A missed call leaves `draftYear` undefined and scores that class
 * `NaN`. (`generate-sitemap.ts` is exempt — it parses into its own narrow shape
 * and never scores.)
 */
export function stampDraftYear(cls: RawDraftClass): DraftClass {
  const stamped = cls as DraftClass;
  for (const pick of stamped.picks) {
    pick.draftYear = stamped.year;
  }
  return stamped;
}
