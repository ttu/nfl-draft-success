import seasonWindow from '../data/season-window.json';

/**
 * The draft classes this site actually ships, written by `update-data.ts` from
 * the classes it generated.
 *
 * Statically imported for the same reason as `LATEST_SEASON` in
 * `./rookieWindow`: the year selector renders before any fetch resolves, so the
 * bounds cannot come from `public/data/`. Recorded rather than derived — the
 * newest class is *not* `latestSeason + 1` once the season is under way (in
 * December 2026 the newest played season is 2026, but the newest draft is still
 * 2026), and the floor is a curation decision, not a fact about the feed.
 *
 * `draftYearBounds.test.ts` holds these to the files in `public/data/`.
 */
export const DRAFT_YEAR_BOUNDS: { min: number; max: number } = {
  min: seasonWindow.firstDraftYear,
  max: seasonWindow.latestDraftYear,
};
