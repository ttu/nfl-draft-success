/**
 * Weeks a player spent on a reserve list, from nflverse weekly rosters.
 * Used by scripts/update-data.ts; see docs/calculations.md.
 *
 * This is the direct measurement of an injury the weekly injury report cannot
 * make. A player placed on IR leaves the 53-man roster and the report with it,
 * so the worst injuries are exactly the ones `injuryReportWeeks` scores as
 * zero. The roster feed still carries him, marked reserve, every week he is out.
 */

/** The fields of an nflverse weekly-roster row this module reads. */
export interface ReserveRosterRow {
  gsis_id?: string;
  status?: string;
  status_description_abbr?: string;
  game_type?: string;
  week?: string;
}

/**
 * Roster statuses that mean "not available, and not by choice of the coach".
 *
 * `RSR` is easy to miss and matters: Tyler Eifert's 2014 and Alec Ogletree's
 * 2015 season-ending injuries are filed under it rather than `RES`.
 */
export const RESERVE_STATUSES: readonly string[] = ['RES', 'RSR', 'PUP', 'NON'];

/**
 * Reserve codes that are not injuries. Both are COVID-19 reserve.
 *
 * Each is confined to the two seasons the NFL ran a COVID-19 reserve list, and
 * appears zero times in any other season:
 *
 * - `R62`: 701 rows in 2020, none in 2021 or any other year.
 * - `R59`: 305 rows in 2020 and 725 in 2021, none in 2019, 2022, 2023 or 2025.
 *
 * For `R59` the stint lengths confirm what the year-confinement suggests. The
 * median stint is a single week, and 90% of 2020's and 98% of 2021's run two
 * weeks or shorter. The injured-reserve minimum over those seasons was three
 * games, so a one-week reserve stint cannot be injured reserve — it is the
 * shape of a COVID isolation period. Counting `R59` as injury pushed 2021's
 * reserve coverage to 30.6% of eligible player-seasons against a 13–18%
 * baseline in every non-COVID year. That 30.6% is the *pre-fix* figure,
 * measured with `R59` still counted as injury.
 *
 * A known, accepted limitation remains. Excluding `R59` brought 2021 down to
 * 18.7% of eligible player-seasons — still above the 13.2–18.4% band every
 * non-COVID year occupies. The likely cause is residual 2021 COVID reserve
 * filed under `R01`, the same code as legitimate injured reserve, which no
 * distribution test can separate; it is parked as a documented limitation
 * rather than chased with a heuristic that would also drop real injuries.
 *
 * nflverse publishes no code dictionary (`dictionary_rosters.csv` describes the
 * column only as "a code corresponding to a particular NFL status"), so both
 * identifications are inference from the distribution rather than documented
 * fact — recorded as such so a future reader can overturn either with better
 * evidence.
 *
 * Excluding them is only possible because 2020 and 2021 are seasons where the
 * code column is populated at all; see FIRST_RESERVE_SEASON.
 */
export const NON_INJURY_RESERVE_CODES: readonly string[] = ['R62', 'R59'];

/**
 * Distinct reserve weeks per `gsis_id` for one season's roster rows.
 *
 * The week *set* is what callers need, not its size: the excusal intersects
 * these weeks with the weeks the player actually missed (see
 * `./absenceWeeks`), so which weeks they are decides how many games get
 * forgiven. `reserveWeeks` on a Season is just `.size` of this.
 *
 * Weeks are a set for the same reason `accumulateInjuryReports` (in `scripts/update-data.ts`) uses one: a
 * player can appear more than once in a week without being out twice.
 *
 * In the shipped data the count never exceeds the regular-season game count:
 * the maximum is exactly 16 in 2016–2019 and exactly 17 in 2020 onwards, so a
 * bye week evidently produces no reserve row at all. That is what the current
 * feed shows rather than a guarantee about it, so
 * `injuryAdjustedFullSeasonDenominator` still caps the excusal at games
 * actually missed — a cheap safeguard that today is simply a no-op.
 */
export function accumulateReserveWeeks(
  rows: ReserveRosterRow[],
): Map<string, Set<number>> {
  const weeks = new Map<string, Set<number>>();

  for (const row of rows) {
    const gsisId = (row.gsis_id ?? '').trim();
    if (!gsisId) continue;
    if (!RESERVE_STATUSES.includes(row.status ?? '')) continue;
    if (NON_INJURY_RESERVE_CODES.includes(row.status_description_abbr ?? ''))
      continue;
    // Preseason roster churn is not a season absence.
    const gameType = row.game_type ?? '';
    if (gameType !== 'REG' && gameType !== 'POST') continue;

    const week = parseInt(row.week ?? '', 10);
    if (!Number.isFinite(week) || week <= 0) continue;

    let set = weeks.get(gsisId);
    if (!set) {
      set = new Set();
      weeks.set(gsisId, set);
    }
    set.add(week);
  }

  return weeks;
}
