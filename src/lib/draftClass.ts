import type { DraftClass, DraftPick } from '../types';
import { withoutRestGame } from './restGame';
import { hydrateAcquisitionSeasons } from './trailingSeasons';

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
  /**
   * Season the pipeline wrote rows out to. Present only on generated files,
   * and its presence is what licenses {@link hydrateAcquisitionSeasons} to
   * rebuild the out-of-league rows the writer elided. Hand-built classes omit
   * it and are left exactly as given.
   */
  seasonsThrough?: number;
  picks: Omit<DraftPick, 'draftYear'>[];
}

/**
 * Prepares a freshly-parsed class for use: stamps each pick with its
 * `draftYear`, rebuilds the season rows the writer elided, and subtracts any
 * rested finale from what is left.
 *
 * All three belong here, at the single point every path parsing draft JSON
 * goes through, so role classification, season scores, cohort baselines and
 * the derivation scripts all see the same career without each having to
 * remember. See {@link ./restGame.withoutRestGame} and
 * {@link ./trailingSeasons.hydrateAcquisitionSeasons}.
 *
 * `draft-{year}.json` carries the year once, on the class, but scoring needs it
 * per pick: {@link getPlayerDraftScore} divides by the rookie-contract window,
 * which requires knowing how many seasons have elapsed since the pick was made.
 * It receives a `DraftPick` and nothing else.
 *
 * The year is taken from `cls.year` rather than from any pick payload, so a
 * stale or hand-edited `draftYear` in the JSON cannot survive a load.
 *
 * `pick.seasons[0].year` is deliberately not used, and the hazard it guards
 * against is no longer hypothetical. A pick measured against a *shorter*
 * window scores *higher* for the seasons he missed — silent, backwards, and
 * invisible from outside the scoring function. The files now genuinely omit
 * rows (every year after a career ends), so the only trustworthy source for
 * where a window opens is `cls.year`, which no refresh can shorten.
 *
 * The elided rows are put back below, before the pick reaches anything that
 * scores it, from the season horizon the class states. `src/data`'s
 * `shippedSeasonRows.test.ts` asserts that every shipped pick comes back
 * whole.
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
    pick.seasons = hydrateAcquisitionSeasons(
      pick.seasons,
      pick.teamId,
      stamped.year,
      stamped.seasonsThrough,
    ).map(withoutRestGame);
  }
  return stamped;
}
