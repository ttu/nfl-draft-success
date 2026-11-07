import seasonWindow from '../data/season-window.json';
import type { Acquisition, Season } from '../types';
import { acquisitionWindow } from './acquisition';
import {
  apprenticeSeasonCount,
  firstScoredYear,
  withoutApprenticeSeasons,
} from './apprenticeship';
import { getSeasonScore } from './getSeasonScore';
import { isPlayedSeason } from './seasonPlayed';
import { LATEST_COMPLETED_SEASON } from './seasonInProgress';

/**
 * Newest NFL season present in the dataset, written by `update-data.ts`.
 *
 * Statically imported rather than read from `public/data/data-meta.json`: that
 * file arrives via async fetch, and scoring must not race it. It also must not
 * be derived from the loaded draft classes — narrowing the year range to
 * 2018–2020 would drag this back to 2020 and silently make every mature class
 * look fully-windowed.
 */
export const LATEST_SEASON: number = seasonWindow.latestSeason;

/**
 * True when the drafting team no longer has the pick, judged by the absence of
 * a retained row in the newest season the pick has any record of.
 *
 * Normally that is {@link LATEST_SEASON}. It is the season after when the pick
 * carries an upcoming-season row: a player traded or released over the
 * offseason is gone now, and waiting for Week 1 to say so would score his old
 * team as though it still held him.
 *
 * Covers both ways a pick leaves: to another roster (a non-retained row), and
 * out of the league entirely (no row at all). Roster seasons spent injured
 * still carry a retained row, so time on IR does not read as departure.
 */
function hasDeparted(pick: Acquisition): boolean {
  const newest = pick.seasons.reduce(
    (year, s) => Math.max(year, s.year),
    LATEST_SEASON,
  );
  return !pick.seasons.some((s) => s.year === newest && s.retained);
}

/**
 * Denominator for a pick's draft score: the seasons it is fair to judge on.
 *
 * For a pick **still on the roster**, `min(elapsed, window)` keeps recent
 * classes honest — one drafted last year is measured against one season, not
 * five, because the rest have not happened. Without it every class inside the
 * window would read as a catastrophe. `elapsed` counts to the newest season
 * that has been *played out*, for the same reason: the season in progress has
 * not happened either, and charging a zero for it would read as a bust four
 * weeks into a year. A pick who *has* played it keeps it, because
 * `max(retained, …)` below floors the count at the seasons he was there for.
 *
 * For a pick that has **departed**, the rest of the window is already known to
 * be zero, so it is charged immediately. This does two things. It removes a
 * calendar artifact: otherwise two identical one-and-done busts score
 * differently for no reason but draft year, the more recent one flattered. And
 * it settles the score — under a clamped denominator a departed pick's score
 * keeps sliding downward each year (÷3, then ÷4, then ÷5) long after anything
 * can change, which is wrong for an outcome that is already final.
 *
 * `max(retained, …)` keeps long tenures from inflating: seven retained seasons
 * over a five-year window would score above the pick's own seasonal mean, which
 * would make outlasting the rookie deal worth more than playing well. Seasons
 * past the window can only help — see {@link bestScoredRun}.
 *
 * It also floors the result at `retained`, so a caller with at least one season
 * to divide can never divide by zero — including a class drafted after the
 * newest season in the data, where `elapsed` is 0.
 *
 * An apprenticeship (see `apprenticeship.ts`) moves the window's *start* to the
 * season the quarterback won the job and shortens its *length* by the seasons
 * he sat. Shortening rather than sliding, because the window models what the
 * rookie contract entitled the team to, and sitting on the bench does not
 * extend that entitlement — sliding would charge Jordan Love for 2026 and 2027,
 * years his rookie deal never covered.
 */
export function scoredSeasonCount(
  pick: Acquisition,
  retainedSeasonCount: number,
): number {
  const apprenticeSeasons = apprenticeSeasonCount(pick);
  // Can reach zero if the bench years exhausted the deal; the `retained` floor
  // below is what keeps the divisor usable.
  const window = Math.max(0, acquisitionWindow(pick) - apprenticeSeasons);
  const elapsed =
    LATEST_COMPLETED_SEASON - (pick.draftYear + apprenticeSeasons) + 1;
  const tracked = hasDeparted(pick) ? window : Math.min(elapsed, window);
  return Math.max(retainedSeasonCount, tracked);
}

/**
 * The drafting-team seasons a pick is scored on: his whole tenure, or only the
 * seasons inside his rookie window when that run alone scores higher.
 *
 * The draft is judged on what the rookie deal delivered. A pick who starred for
 * five years and then declined on the same roster would otherwise score below
 * one who starred for five and left, because the later seasons pull the mean
 * down — staying would be punished. Taking the better of the two keeps a late
 * peak worth counting without letting a late decline undo the draft.
 *
 * `retained` must already be the scored drafting-team seasons — played, no
 * apprenticeship — as `getFilteredSeasons` and {@link scoredWindowYears} pass.
 */
export function bestScoredRun(pick: Acquisition, retained: Season[]): Season[] {
  const windowEnd =
    firstScoredYear(pick) +
    Math.max(0, acquisitionWindow(pick) - apprenticeSeasonCount(pick));
  const inWindow = retained.filter((s) => s.year < windowEnd);
  // Nothing past the window, or a window the bench years used up: one run only.
  if (inWindow.length === retained.length || inWindow.length === 0)
    return retained;
  const score = (run: Season[]) =>
    run.reduce((sum, s) => sum + getSeasonScore(s, pick.position), 0) /
    scoredSeasonCount(pick, run.length);
  return score(inWindow) > score(retained) ? inWindow : retained;
}

/**
 * The calendar years a pick's drafting-team score is divided across, oldest
 * first: {@link firstScoredYear} through the end of {@link scoredSeasonCount}.
 *
 * Exists for display. The career table shows one row per season the player
 * actually had, so a pick whose seasons stop early — released, or out of the
 * league — renders three rows above a headline divided by five, and the
 * arithmetic looks broken to anyone who checks it. Rendering the missing years
 * as explicit zero rows makes the denominator visible, which is the argument
 * the score is making.
 */
export function scoredWindowYears(pick: Acquisition): number[] {
  const from = firstScoredYear(pick);
  const retained = withoutApprenticeSeasons(pick, pick.seasons).filter(
    (s) => s.retained && isPlayedSeason(s),
  );
  if (retained.length === 0) return [];
  const count = scoredSeasonCount(pick, bestScoredRun(pick, retained).length);
  return Array.from({ length: count }, (_, i) => from + i);
}
