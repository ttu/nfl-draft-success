import type { DraftPick, Season } from '../types';

/** Most recent season row by calendar year (draft year through present). */
export function getLatestSeasonForPick(pick: DraftPick): Season | undefined {
  if (pick.seasons.length === 0) return undefined;
  return [...pick.seasons].sort((a, b) => b.year - a.year)[0];
}

/**
 * True when the latest season row indicates the player is still with the drafting team.
 * False if there are no seasons, or the latest row has `retained: false`.
 */
export function isDraftPickRetainedLatest(pick: DraftPick): boolean {
  const latest = getLatestSeasonForPick(pick);
  return latest?.retained === true;
}

/**
 * For hiding departed players: keep picks with no season rows yet (still unknown),
 * or whose latest season is retained.
 */
export function isDraftPickRetainedForRoster(pick: DraftPick): boolean {
  if (pick.seasons.length === 0) return true;
  return isDraftPickRetainedLatest(pick);
}
