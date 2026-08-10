import type { DraftClass, DraftPick, Season, Team } from '../types';
import type { RankedPlayer } from './careerShapeHighlights';
import { activeCareerSeasons, seasonRole } from './careerShapeHighlights';
import { getSeasonScore } from './getSeasonScore';
import { isAtLeastRole } from './roleDisplay';

/** A team row in the retention ranking. */
export interface TeamRateHighlight {
  teamId: string;
  team: Team | undefined;
  kept: number;
  keepers: number;
  rate: number;
}

/** The two retention lists. */
export interface RetentionHighlights {
  gotAway: RankedPlayer[];
  keptTheBand: TeamRateHighlight[];
}

/**
 * Starter-grade seasons a player needs elsewhere before leaving counts as a
 * loss. Doing it twice rules out both a one-year fluke and a rise that only
 * reaches rotation snaps.
 */
export const MIN_POST_EXIT_STARTER_SEASONS = 2;

/** How many entries each retention list holds. */
export const RETENTION_LIST_MAX = 20;

/**
 * Keepers a team needs before its retention rate means anything. Below this a
 * thin sample tops the list on two players.
 */
export const MIN_KEEPERS = 5;

/** Rows in the team retention ranking, matching the `TeamLeader` lists. */
const KEPT_THE_BAND_LIST_MAX = 5;

/** The pick-identifying half of a {@link RankedPlayer}, shared by every list. */
type RankedPlayerBase = Pick<RankedPlayer, 'pick' | 'team' | 'draftYear'>;

function meanScore(seasons: Season[], position: string): number {
  if (seasons.length === 0) return 0;
  return (
    seasons.reduce((sum, s) => sum + getSeasonScore(s, position), 0) /
    seasons.length
  );
}

/**
 * Where the player is now, from the newest season row that names a team —
 * **including an unplayed one**. A roster snapshot is the most accurate answer
 * precisely because it is not a result; it is read for this label only and
 * never scored.
 *
 * Returns undefined when no row names one, so the caller can drop the clause
 * rather than print a placeholder where a team should be.
 */
function currentTeamOf(pick: DraftPick): string | undefined {
  return [...pick.seasons]
    .sort((a, b) => b.year - a.year)
    .find((s) => s.currentTeam !== undefined)?.currentTeam;
}

/**
 * The rise a pick found after leaving, credited to the team that let him go.
 *
 * He must have played for the drafting team at all — a pick traded before he
 * ever suited up was never the drafting team's to keep — and must have reached
 * starter grade elsewhere more than once.
 */
function gotAwayRow(
  base: RankedPlayerBase,
  played: Season[],
): RankedPlayer | null {
  const pick = base.pick;
  const retained = played.filter((s) => s.retained);
  const postExit = played.filter((s) => !s.retained);
  if (retained.length === 0) return null;

  const starterSeasons = postExit.filter((s) =>
    isAtLeastRole(seasonRole(s, pick.position), 'significant_contributor'),
  );
  if (starterSeasons.length < MIN_POST_EXIT_STARTER_SEASONS) return null;

  const before = meanScore(retained, pick.position);
  const after = meanScore(postExit, pick.position);
  const rise = after - before;
  if (rise <= 0) return null;

  const destination = currentTeamOf(pick);
  const move = `${Math.round(before)} → ${Math.round(after)}`;

  return {
    ...base,
    value: rise,
    headline: `+${Math.round(rise)}`,
    detail: destination === undefined ? move : `${move} with ${destination}`,
  };
}

/**
 * Per-team counts behind the retention rate.
 *
 * Keepers only. A plain retention rate rewards a team for hanging onto picks
 * nobody else wanted and punishes one that cuts its misses quickly, which
 * inverts the thing the list claims to measure. A keeper who retired with the
 * drafting team counts as kept — never letting him go is the purest form of
 * keeping him, and the data carries no "still in the league" flag anyway.
 */
interface KeeperTally {
  keepers: Map<string, number>;
  kept: Map<string, number>;
}

/**
 * Whether the pick's career reads as one worth keeping: most of the seasons he
 * actually played were starter-grade.
 *
 * Deliberately not `getPlayerRole`. That averages over every played season, and
 * a career that ended early carries a row for each remaining year in the window
 * — so a two-year starter who left the league rates as a contributor and drops
 * out of the keeper pool entirely. The engine's behaviour is app-wide and not
 * this feature's to change; the fix here is to ask the question of the seasons
 * he was actually around for.
 */
function isKeeper(pick: DraftPick): boolean {
  const seasons = activeCareerSeasons(pick);
  if (seasons.length === 0) return false;
  const starterSeasons = seasons.filter((s) =>
    isAtLeastRole(seasonRole(s, pick.position), 'significant_contributor'),
  ).length;
  return starterSeasons * 2 >= seasons.length;
}

function bump(counts: Map<string, number>, teamId: string): void {
  counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
}

/** Add one pick to the drafting team's keeper counts, if he is a keeper at all. */
function tallyKeeper(tally: KeeperTally, pick: DraftPick): void {
  if (!isKeeper(pick)) return;
  bump(tally.keepers, pick.teamId);
  // The last season he took a snap in, not the last row he has. Rows continue
  // for every year in the window after a career ends, and their `retained` flag
  // describes nobody. See `activeCareerSeasons`.
  const lastPlayed = activeCareerSeasons(pick).at(-1);
  if (lastPlayed?.retained === true) {
    bump(tally.kept, pick.teamId);
  }
}

/** Teams with enough keepers to rank, best retention rate first. */
function rankKeptTheBand(
  tally: KeeperTally,
  teamById: Map<string, Team>,
): TeamRateHighlight[] {
  const keptTheBand: TeamRateHighlight[] = [];
  for (const [teamId, count] of tally.keepers) {
    if (count < MIN_KEEPERS) continue;
    const kept = tally.kept.get(teamId) ?? 0;
    keptTheBand.push({
      teamId,
      team: teamById.get(teamId),
      kept,
      keepers: count,
      rate: kept / count,
    });
  }
  keptTheBand.sort((a, b) => b.rate - a.rate || b.kept - a.kept);
  return keptTheBand;
}

/**
 * Career highlights about who left and who stayed.
 *
 * **Takes no `GetPlayerRoleOptions` by design.** Elsewhere `draftingTeamOnly`
 * asks what a team got from a pick; here the seasons after he left are the
 * entire subject, so the option has nowhere to go and cannot be threaded in by
 * mistake.
 */
export function getRetentionHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
): RetentionHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const gotAway: RankedPlayer[] = [];
  const tally: KeeperTally = { keepers: new Map(), kept: new Map() };

  for (const draft of draftClasses) {
    for (const pick of draft.picks) {
      const base = {
        pick,
        team: teamById.get(pick.teamId),
        draftYear: draft.year,
      };
      const played = activeCareerSeasons(pick);

      tallyKeeper(tally, pick);

      const row = gotAwayRow(base, played);
      if (row !== null) gotAway.push(row);
    }
  }

  gotAway.sort((a, b) => b.value - a.value);

  return {
    gotAway: gotAway.slice(0, RETENTION_LIST_MAX),
    keptTheBand: rankKeptTheBand(tally, teamById).slice(
      0,
      KEPT_THE_BAND_LIST_MAX,
    ),
  };
}
