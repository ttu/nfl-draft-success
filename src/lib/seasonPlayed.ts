import type { DraftPick, Season } from '../types';

/**
 * Whether a season row describes football that has actually been played.
 *
 * A pick can carry a row for the upcoming season so that a trade or release
 * over the offseason is visible before Week 1. That row has `teamGames === 0`
 * and exists purely to say where the player stands — see {@link Season.teamGames}.
 *
 * The distinction matters because zero is otherwise a meaningful score: a
 * player who spent a real season injured also has no games and no snaps, and
 * that *should* count against his pick. Only the absence of a season to play
 * makes zero meaningless, and `teamGames` is the field that separates them.
 */
export function isPlayedSeason(season: Season): boolean {
  return season.teamGames > 0;
}

/** Inverse of {@link isPlayedSeason}, for readability at call sites. */
export function isUnplayedSeason(season: Season): boolean {
  return !isPlayedSeason(season);
}

/** A pick's seasons with any upcoming-season row removed. */
export function playedSeasons(pick: DraftPick): Season[] {
  return pick.seasons.filter(isPlayedSeason);
}

/** Newest season the pick actually played, or `undefined` if there is none. */
export function latestPlayedSeason(pick: DraftPick): Season | undefined {
  return playedSeasons(pick).sort((a, b) => b.year - a.year)[0];
}
