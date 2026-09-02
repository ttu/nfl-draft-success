/**
 * Games a player lost to a documented injury, from week sets rather than
 * counts. Used by scripts/update-data.ts; see docs/calculations.md.
 */

/** Inputs to {@link excusedAbsenceGames}. */
export interface ExcusedAbsenceOptions {
  /** Team weeks the player did not appear in — already rest-adjusted by the caller. */
  missedWeeks: Iterable<number>;
  /** Weeks the player appeared on the weekly injury report. */
  injuryWeeks?: Iterable<number>;
  /** Weeks the player was on a reserve list (see {@link ./reserveWeeks}). */
  reserveWeeks?: Iterable<number>;
}

/**
 * `| missedWeeks ∩ (injuryWeeks ∪ reserveWeeks) |` — the weeks he was both
 * absent and documented as hurt.
 *
 * Two different questions are being asked, which is why the two set operations
 * differ. The union answers *was he hurt in this week*: the injury report and
 * the reserve list are two feeds onto one condition, and a player placed on
 * injured reserve is removed from the report, so they describe consecutive
 * halves of a single absence rather than competing estimates of it. Ronnie
 * Stanley 2021 is the shape: injury-report weeks {1,2,3,4,5,6}, reserve weeks
 * {7,9,10,…,18} (week 8 is the bye), zero overlap. Taking the larger count saw
 * 11 of the 16 games he lost; the union sees all of them. Across the 2,189
 * seasons since 2016 carrying both signals, 1,793 — 81.9% — are disjoint like
 * this. That figure cannot be checked against this repo: it comes from the
 * per-week rows of the nflverse `injuries_{season}.csv` and
 * `roster_weekly_{season}.csv` releases, whereas `public/data/*.json` stores
 * only week *counts*.
 *
 * The intersection with `missedWeeks` answers the other question: *did that
 * week cost a game*. Being on the injury report does not mean sitting out —
 * players are listed and then play — so `injuryReportWeeks` is a count of weeks
 * spent on the report, not a measure of absence, and the report alone excused
 * games that were never missed for injury. Intersecting with the weeks actually
 * missed is what removes that error.
 *
 * Two properties fall out for free. A bye week is not in the team's week set,
 * so it can never reach `missedWeeks` and can never be forgiven, however long
 * the reserve stint spanning it runs. And forgiveness is monotone in evidence:
 * adding a documented week can only grow the union, never shrink it, and no
 * undocumented week is ever forgiven. The result cannot exceed the games
 * missed, because it is a subset of them.
 */
export function excusedAbsenceGames(options: ExcusedAbsenceOptions): number {
  const { missedWeeks, injuryWeeks, reserveWeeks } = options;
  const documented = new Set<number>(injuryWeeks ?? []);
  for (const week of reserveWeeks ?? []) documented.add(week);
  if (documented.size === 0) return 0;

  const excused = new Set<number>();
  for (const week of missedWeeks) {
    if (documented.has(week)) excused.add(week);
  }
  return excused.size;
}
