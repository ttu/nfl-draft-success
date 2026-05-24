import type { DraftPick, Role, Season } from '../types';
import { classifyRole } from './classifyRole';
import { snapShareForRoleTier } from './snapShareForTier';
import { isStrongerRole } from './roleDisplay';

export interface TeamStint {
  team: string;
  role: Role;
}

/** Most recent season by year, or `undefined` if the pick has none. */
export function getLatestSeason(pick: DraftPick): Season | undefined {
  return [...pick.seasons].sort((a, b) => b.year - a.year)[0];
}

/** True when the player is no longer with their drafting team (latest season). */
export function isDeparted(pick: DraftPick): boolean {
  return getLatestSeason(pick)?.retained === false;
}

/** Team abbreviation the player is currently on (only set when departed). */
export function getCurrentTeam(pick: DraftPick): string | undefined {
  return getLatestSeason(pick)?.currentTeam;
}

/** Team a season was played for: drafting team if retained, otherwise currentTeam or 'FA'. */
export function getSeasonTeamAbbreviation(
  season: Season,
  pick: DraftPick,
): string {
  if (season.retained) return pick.teamId;
  return season.currentTeam ?? 'FA';
}

/** True when the season represents a year the player was a free agent. */
export function isFreeAgentSeason(season: Season, pick: DraftPick): boolean {
  return getSeasonTeamAbbreviation(season, pick) === 'FA';
}

/**
 * Career broken into chronological stints (consecutive same-team seasons),
 * with each stint's best (strongest) role across those seasons.
 * Stint[0] is always the drafting team (or 'FA' if no real first season).
 */
export function getTeamJourney(pick: DraftPick): TeamStint[] {
  const sortedSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);
  const stints: { team: string; seasons: Season[] }[] = [];
  for (const season of sortedSeasons) {
    const team = season.retained ? pick.teamId : (season.currentTeam ?? 'FA');
    const last = stints[stints.length - 1];
    if (last && last.team === team) {
      last.seasons.push(season);
    } else {
      stints.push({ team, seasons: [season] });
    }
  }
  return stints.map(({ team, seasons }) => {
    let bestRole: Role = 'non_contributor';
    for (const s of seasons) {
      const gps = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
      const role = classifyRole(
        snapShareForRoleTier(s, pick.position),
        gps,
        s.gamesPlayed,
        pick.position,
      );
      if (isStrongerRole(role, bestRole)) bestRole = role;
    }
    return { team, role: bestRole };
  });
}

/**
 * The team journey shown after the drafting-team stint. If the player has
 * never left the drafting team, returns a single placeholder FA stint so the
 * UI can still indicate departure absence.
 */
export function getJourneyAfterDraft(pick: DraftPick): TeamStint[] {
  if (pick.seasons.length === 0) return [];
  const tail = getTeamJourney(pick).slice(1);
  return tail.length > 0
    ? tail
    : [{ team: 'FA', role: 'non_contributor' as Role }];
}

/**
 * Collapse a trailing run of items satisfying `isFa` down to its first item,
 * preserving everything before the run. No-op if the run has 0 or 1 items.
 */
export function collapseTrailingFaRun<T>(
  items: T[],
  isFa: (item: T) => boolean,
): T[] {
  const n = items.length;
  if (n < 2) return items;
  let i = n - 1;
  while (i >= 0 && isFa(items[i])) i -= 1;
  const runStart = i + 1;
  const runLen = n - runStart;
  if (runLen <= 1) return items;
  return items.slice(0, runStart + 1);
}
