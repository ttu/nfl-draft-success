import teamGamesData from '../data/team-games.json';
import seasonWindow from '../data/season-window.json';
import type { Acquisition, TeamGamesData } from '../types';
import { isPlayedSeason } from './seasonPlayed';

/**
 * The shape of the game-count table this module reads. Declared structurally
 * rather than imported from `./trailingSeasons`, which reads this module back.
 */
type GamesBySeason = TeamGamesData['gamesBySeason'];

const { gamesBySeason } = teamGamesData as TeamGamesData;

/**
 * Fewest games a franchise plays in a finished regular season.
 *
 * 17 since 2021 and 16 before it; the lower bound is what makes the test work
 * across both eras, and no in-progress season reaches it until the final
 * weeks — by which point `max`, the deepest run any franchise has made, is
 * well past it.
 */
const COMPLETE_SEASON_GAMES = 16;

/**
 * Whether `year` has been played out, judged by the game counts
 * `update-data.ts` writes into `src/data/team-games.json`.
 *
 * A season in progress shows a `max` of however many weeks have been played —
 * 5 in October — while a finished one is at least a full regular season and
 * usually more, since `max` includes the deepest playoff run.
 *
 * A season with no entry is not complete: the table covers every season anyone
 * has played, so its absence means this one has not started.
 */
export function isSeasonComplete(
  year: number,
  games: GamesBySeason = gamesBySeason,
): boolean {
  const season = games[String(year)];
  return season !== undefined && season.max >= COMPLETE_SEASON_GAMES;
}

/**
 * Whether the newest season in the data is still being played.
 *
 * `update-data.ts` stamps its roster snapshot `LATEST_SEASON + 1` year-round —
 * the slot for "after everything played", not a claim about the calendar (see
 * `buildRosterSnapshotSeason`). That reads as a forecast of next season only
 * in the offseason. Mid-season the snapshot is just today's roster, and the
 * in-progress season row already carries it, so anything that would render the
 * slot as a season of its own has to know the difference.
 */
export function isLatestSeasonInProgress(): boolean {
  return !isSeasonComplete(seasonWindow.latestSeason);
}

/**
 * Newest season that has been played out — `LATEST_SEASON` in the offseason,
 * the year before it once the next one kicks off.
 *
 * The horizon for anything that asks how much football a player has had the
 * chance to play. `LATEST_SEASON` itself is the newest season with *any* data,
 * which from September onward is a season four weeks old.
 *
 * Reads `season-window.json` rather than `./rookieWindow`'s `LATEST_SEASON`,
 * which is the same number from the same file: that module reads this one, and
 * importing it back would close the circle.
 */
export const LATEST_COMPLETED_SEASON: number = isSeasonComplete(
  seasonWindow.latestSeason,
)
  ? seasonWindow.latestSeason
  : seasonWindow.latestSeason - 1;

/**
 * Whether the player has at least one season that has been played out.
 *
 * The gate for any list that ranks careers against each other. A pick four
 * weeks into his first season has a score, a role and an over-slot number, all
 * arithmetically correct and none of them an outcome yet — and ranked beside a
 * decade of finished careers they read as one. The unplayed roster-snapshot
 * row does not count, for the same reason it never counts as a season.
 */
export function hasCompletedSeason(
  pick: Acquisition,
  games: GamesBySeason = gamesBySeason,
): boolean {
  return pick.seasons.some(
    (s) => isPlayedSeason(s) && isSeasonComplete(s.year, games),
  );
}
