import type { DraftClass, DraftPick, Team } from '../types';
import { isBustExcluded } from './bustExclusions';
import { getPlayerDraftSkill } from './draftSlotBaseline';
import {
  getPlayerDraftScore,
  getPlayerRole,
  pickHasSeasonSnapData,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/** A single-player highlight (steal or bust) with its resolved team and score. */
export interface PlayerHighlight {
  pick: DraftPick;
  team: Team | undefined;
  /** Draft year the pick belongs to. */
  draftYear: number;
  /** 0–100 player draft score. */
  score: number;
  /** Score above the draft slot's expectation; drives the ranking. */
  overSlot: number;
}

/** A team-level highlight (most core starters produced). */
export interface TeamHighlight {
  teamId: string;
  team: Team | undefined;
  count: number;
}

/** How many players each ranked list (steals, busts) shows before expanding. */
export const HIGHLIGHT_LIST_SIZE = 3;

/** Full length of each ranked list once expanded (the top-20 view). */
export const HIGHLIGHT_LIST_MAX = 20;

/** Human-interest highlights across the loaded draft window. */
export interface LeagueHighlights {
  /** Picks most above their draft slot's expectation, best first. */
  steals: PlayerHighlight[];
  /** Picks furthest below their draft slot's expectation, worst first. */
  busts: PlayerHighlight[];
  /** Team that produced the most core starters. */
  mostCoreStarters: TeamHighlight | null;
}

/**
 * Scan every scored pick across the loaded draft classes for three
 * human-interest highlights: the biggest steals, the biggest busts, and the
 * team that produced the most core starters. Only picks with season data
 * ({@link pickHasSeasonSnapData}) are eligible.
 *
 * Steals and busts are ranked by *over slot* rather than raw score, so no round
 * filter is needed: the slot expectation already caps how far an early pick can
 * exceed it (a top-5 pick has ~9 points of headroom) and how far a late pick can
 * fall short (a seventh-rounder has ~17 points of downside). Empirically the top
 * 20 over slot are all round 4+ and the bottom 20 all rounds 1–3. Ranking this
 * way also sorts *within* those groups honestly — a sixth-rounder scoring 94
 * outranks a fourth-rounder scoring 98, which raw score got backwards.
 *
 * Busts additionally skip picks whose career ended outside football (see
 * {@link isBustExcluded}); the list backfills past them. Steals and the
 * core-starter tally still count every pick.
 *
 * Both lists draw from one pool and hold up to {@link HIGHLIGHT_LIST_MAX}
 * players, so a window with fewer picks than that can list one player on both
 * sides; real windows carry hundreds. `mostCoreStarters` is `null` when no team
 * has one.
 */
export function getLeagueHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetPlayerRoleOptions,
): LeagueHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const candidates: PlayerHighlight[] = [];

  // Per-team core-starter tallies for the volume leader (with rate tie-break).
  const coreCount = new Map<string, number>();
  const scoredCount = new Map<string, number>();

  for (const draft of draftClasses) {
    for (const pick of draft.picks) {
      if (!pickHasSeasonSnapData(pick)) continue;

      candidates.push({
        pick,
        team: teamById.get(pick.teamId),
        draftYear: draft.year,
        score: getPlayerDraftScore(pick, options),
        overSlot: getPlayerDraftSkill(pick, options),
      });

      scoredCount.set(pick.teamId, (scoredCount.get(pick.teamId) ?? 0) + 1);
      if (getPlayerRole(pick, options) === 'core_starter') {
        coreCount.set(pick.teamId, (coreCount.get(pick.teamId) ?? 0) + 1);
      }
    }
  }

  return {
    steals: [...candidates].sort(compareSteal).slice(0, HIGHLIGHT_LIST_MAX),
    busts: candidates
      .filter((c) => !isBustExcluded(c.pick.playerId))
      .sort(compareBust)
      .slice(0, HIGHLIGHT_LIST_MAX),
    mostCoreStarters: pickCoreLeader(coreCount, scoredCount, teamById),
  };
}

/**
 * Ranks steals best first: higher over slot, then the later pick (the same
 * surplus from a later slot is the better find), then higher raw score.
 */
function compareSteal(a: PlayerHighlight, b: PlayerHighlight): number {
  if (a.overSlot !== b.overSlot) return b.overSlot - a.overSlot;
  if (a.pick.overallPick !== b.pick.overallPick)
    return b.pick.overallPick - a.pick.overallPick;
  return b.score - a.score;
}

/**
 * Ranks busts worst first: lower over slot, then the earlier pick (the same
 * shortfall from an earlier slot cost more), then lower raw score.
 */
function compareBust(a: PlayerHighlight, b: PlayerHighlight): number {
  if (a.overSlot !== b.overSlot) return a.overSlot - b.overSlot;
  if (a.pick.overallPick !== b.pick.overallPick)
    return a.pick.overallPick - b.pick.overallPick;
  return a.score - b.score;
}

/** Team with the most core starters; ties broken by higher core rate. */
function pickCoreLeader(
  coreCount: Map<string, number>,
  scoredCount: Map<string, number>,
  teamById: Map<string, Team>,
): TeamHighlight | null {
  let leader: { teamId: string; count: number; rate: number } | null = null;
  for (const [teamId, count] of coreCount) {
    if (count === 0) continue;
    const rate = count / (scoredCount.get(teamId) ?? count);
    if (
      leader === null ||
      count > leader.count ||
      (count === leader.count && rate > leader.rate)
    ) {
      leader = { teamId, count, rate };
    }
  }
  if (leader === null) return null;
  return {
    teamId: leader.teamId,
    team: teamById.get(leader.teamId),
    count: leader.count,
  };
}
