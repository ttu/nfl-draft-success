import type { DraftPick, Role, Season } from '../types';
import { classifyRole } from './classifyRole';
import { snapShareForRoleTier } from './snapShareForTier';
import { isStrongerRole } from './roleDisplay';
import { isPlayedSeason } from './seasonPlayed';

export interface TeamStint {
  team: string;
  role: Role;
}

/** Most recent season by year, or `undefined` if the pick has none. */
export function getLatestSeason(pick: DraftPick): Season | undefined {
  return [...pick.seasons].sort((a, b) => b.year - a.year)[0];
}

/**
 * True when the player is no longer with their drafting team.
 *
 * Reads the newest season row of any kind, including one for a season not yet
 * played: a pick traded over the offseason has left, even though the season he
 * leaves for has not started.
 */
export function isDeparted(pick: DraftPick): boolean {
  return getLatestSeason(pick)?.retained === false;
}

/** Team abbreviation the player is currently on (only set when departed). */
export function getCurrentTeam(pick: DraftPick): string | undefined {
  return getLatestSeason(pick)?.currentTeam;
}

/**
 * Current-team indicator for the player hero: `null` when the player is still
 * with their drafting team, otherwise the team they are now on ('FA' when a
 * free agent).
 */
export function getCurrentTeamIndicator(pick: DraftPick): string | null {
  if (!isDeparted(pick)) return null;
  return getCurrentTeam(pick) ?? 'FA';
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
      // An upcoming season carries no evidence of a role, and its zeros would
      // classify a player who has not taken the field as a non-contributor.
      if (!isPlayedSeason(s)) continue;
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

/** A list split at the start of its trailing free-agent run. */
export interface TrailingFaRun<T> {
  /** Items to render one by one. */
  before: T[];
  /** The trailing run, to render as a single range. Empty unless it has 2+. */
  run: T[];
}

/**
 * Split a chronological list at the start of its trailing run of free-agent
 * items, so a caller can render the run as one range instead of one row each.
 *
 * Only a run that reaches the end of the career is folded up: an FA year
 * between two stints is a real gap between two clubs and earns its own row,
 * while a run at the end is a player who left and never came back — the second
 * and third identical rows of that say nothing the first did not.
 *
 * A run of one is left in `before`: there is nothing to collapse, and a range
 * row spanning a single year would be a worse version of the row it replaced.
 */
export function splitTrailingFaRun<T>(
  items: T[],
  isFa: (item: T) => boolean,
): TrailingFaRun<T> {
  let runStart = items.length;
  while (runStart > 0 && isFa(items[runStart - 1])) runStart -= 1;
  if (items.length - runStart < 2) return { before: items, run: [] };
  return { before: items.slice(0, runStart), run: items.slice(runStart) };
}
