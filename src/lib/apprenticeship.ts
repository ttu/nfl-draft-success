import type { DraftPick, Role, Season } from '../types';
import { classifyRole } from './classifyRole';
import { playedSeasons } from './seasonPlayed';
import { snapShareForRoleTier } from './snapShareForTier';

/**
 * Positions where sitting early in a career is a development path rather than a
 * verdict on the pick.
 *
 * Quarterback only, because quarterback is the position where exactly one
 * player takes the snaps. Everywhere else a rookie who barely plays is usually
 * a rookie the team misjudged — run position-agnostic against the 2018–2025
 * classes this rule fires on 115 picks and erases the quiet rookie year of
 * ordinary starters like Daniel Faalele and Luke Wattenberg.
 *
 * A constant rather than an inline check so widening the rule later is one line
 * plus a review of what it would newly forgive.
 */
export const APPRENTICESHIP_POSITIONS: readonly string[] = ['QB'];

/** Barely on the field: the seasons an apprenticeship is made of. */
const BENCH_ROLES: readonly Role[] = ['non_contributor', 'depth'];

/** Holding the job: the payoff that makes those bench seasons an investment. */
const STARTER_ROLES: readonly Role[] = ['core_starter', 'starter_when_healthy'];

function seasonRole(season: Season, position: string): Role {
  const gamesPlayedShare =
    season.teamGames > 0 ? season.gamesPlayed / season.teamGames : 0;
  return classifyRole(
    snapShareForRoleTier(season, position),
    gamesPlayedShare,
    position,
  );
}

/**
 * Seasons a quarterback spent learning on the drafting team's bench before he
 * won the job — the leading run from his draft year in which he was retained
 * and classified `non_contributor` or `depth`.
 *
 * Returns zero unless a later retained season reaches starter level. That
 * condition is the whole design. Jordan Love's first three seasons and Kyle
 * Trask's first three seasons are indistinguishable in the data — both are
 * retained quarterbacks taking no meaningful snaps — and only what came
 * afterwards separates them. So sitting is treated as neither good nor bad in
 * itself: it is an investment, and the score reflects whether it paid.
 *
 * Three constraints keep the rule from over-forgiving:
 *
 * - **Leading only.** A starter benched in year three for playing badly and
 *   restored in year four keeps those years against him.
 * - **Retained only.** Sitting on another club's bench was not this team's
 *   apprenticeship.
 * - **Payoff with the drafting team.** This app scores what the drafting team
 *   got. Malik Willis breaking out in Green Bay does nothing for Tennessee's
 *   third-rounder; Tennessee traded him and took the loss.
 *
 * Known limitation: this cannot tell sitting-to-learn from sitting-injured.
 * J.J. McCarthy, who missed his rookie year with a knee injury and then won the
 * job, qualifies. That follows from keying on outcome, and is accepted rather
 * than overlooked.
 */
export function apprenticeSeasonCount(pick: DraftPick): number {
  if (!APPRENTICESHIP_POSITIONS.includes(pick.position)) return 0;

  const seasons = [...playedSeasons(pick)].sort((a, b) => a.year - b.year);

  let count = 0;
  while (
    count < seasons.length &&
    // Consecutive from the draft year: a year out of the league breaks the run.
    seasons[count].year === pick.draftYear + count &&
    seasons[count].retained &&
    BENCH_ROLES.includes(seasonRole(seasons[count], pick.position))
  ) {
    count += 1;
  }
  if (count === 0) return 0;

  const vindicated = seasons
    .slice(count)
    .some(
      (s) => s.retained && STARTER_ROLES.includes(seasonRole(s, pick.position)),
    );
  return vindicated ? count : 0;
}

/**
 * The first season a pick is judged on: his draft year, or the year his
 * apprenticeship ended. The rookie-contract window is measured from here.
 */
export function firstScoredYear(pick: DraftPick): number {
  return pick.draftYear + apprenticeSeasonCount(pick);
}

/**
 * `seasons` with a vindicated quarterback's bench years removed.
 *
 * Returns the input untouched when there was no apprenticeship, rather than
 * filtering on `year >= draftYear` unconditionally. The two are equivalent on
 * real data — nobody plays before he is drafted — but not on fixtures, and a
 * filter that quietly drops seasons from every pick in the league is far more
 * than this rule is entitled to do.
 */
export function withoutApprenticeSeasons(
  pick: DraftPick,
  seasons: Season[],
): Season[] {
  const count = apprenticeSeasonCount(pick);
  if (count === 0) return seasons;
  const from = pick.draftYear + count;
  return seasons.filter((s) => s.year >= from);
}
