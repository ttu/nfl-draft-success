import type { Acquisition, Season } from '../types';
import { isUnplayedSeason } from './seasonPlayed';

/** Most recent season row by calendar year (draft year through present). */
export function getLatestSeasonForPick(pick: Acquisition): Season | undefined {
  if (pick.seasons.length === 0) return undefined;
  return [...pick.seasons].sort((a, b) => b.year - a.year)[0];
}

/**
 * True when the player is on his drafting team's roster **now**.
 *
 * Read from the roster snapshot — the unplayed row (`teamGames === 0`, see
 * `./seasonPlayed`) that `update-data.ts` writes for every player on a roster.
 * Its absence is the statement that he is on nobody's, which is the same way
 * `getCurrentTeamForPick` reads it.
 *
 * Not from the newest *played* row, which is a fact about the season it
 * describes and not about today. A pick who finished last season with his
 * drafting team and went unsigned over the winter has a final row saying
 * `retained: true`, and reading that as "still here" keeps 87 departed players
 * on their old rosters until the next season finishes.
 *
 * The one cost: a refresh that found no roster release at all ships no
 * snapshot rows for anyone, and every pick then reads as departed. That case
 * is detectable — {@link hasRosterSnapshot} in `./currentRoster` exists for
 * it — and is the same blind spot every other consumer of the snapshot has.
 */
export function isDraftPickRetainedLatest(pick: Acquisition): boolean {
  return pick.seasons.find(isUnplayedSeason)?.retained === true;
}

/**
 * For hiding departed players: keep picks with no season rows yet (still unknown),
 * or whose latest season is retained.
 */
export function isDraftPickRetainedForRoster(pick: Acquisition): boolean {
  if (pick.seasons.length === 0) return true;
  return isDraftPickRetainedLatest(pick);
}
