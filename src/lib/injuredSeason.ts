import type { Season } from '../types';

/**
 * A season the player spent on reserve without ever taking the field.
 *
 * Scored zero and counted in full — `src/lib/seasonPlayed.ts` states why, and
 * that decision is untouched here. This exists only so the Role column can say
 * *injured* rather than *non-contributor*, which is a verdict on a player who
 * was never given the chance to earn one.
 *
 * The predicate is deliberately just "was he on reserve at all". The tighter
 * `reserveWeeks >= teamGames` would demand an exact match between a week count
 * and a game count for a player who missed everything, and getting that
 * agreement right for every roster shape means inventing a tolerance constant.
 * `> 0` needs none, but it can over-label: a player who spent two weeks on
 * reserve and was then released still has those two reserve weeks on record,
 * so with zero games played he reads as injured too. That is accepted, not
 * overlooked — he played no games either way, and the label makes no claim
 * about how the season ended. (In the current data `reserveWeeks` tops out at the
 * regular-season game count — 16 through 2019, 17 after — so bye weeks do not
 * appear to inflate it, but nothing here depends on that holding.)
 */
export function isInjuredOutSeason(season: Season): boolean {
  return (
    season.gamesPlayed === 0 &&
    season.teamGames > 0 &&
    (season.reserveWeeks ?? 0) > 0
  );
}
