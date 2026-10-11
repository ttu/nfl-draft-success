import teamGamesData from '../data/team-games.json';
import type { TeamGamesData } from '../types';
import { LATEST_SEASON } from './rookieWindow';
import type { TeamGamesBySeason } from './trailingSeasons';

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
  games: TeamGamesBySeason = gamesBySeason,
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
  return !isSeasonComplete(LATEST_SEASON);
}
