import type { DraftClass, DraftPick, Team } from '../types';
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
  /** Highest-scoring round 4+ picks (best first), the best late-round value. */
  steals: PlayerHighlight[];
  /** Lowest-scoring round-1 picks (worst first), the biggest early-round misses. */
  busts: PlayerHighlight[];
  /** Team that produced the most core starters. */
  mostCoreStarters: TeamHighlight | null;
}

/**
 * Scan every scored pick across the loaded draft classes for three
 * human-interest highlights: the top round-4-or-later steals, the top round-1
 * busts, and the team that produced the most core starters. Only picks with
 * season data ({@link pickHasSeasonSnapData}) are eligible. The steals/busts
 * lists hold up to {@link HIGHLIGHT_LIST_MAX} players and are empty when no
 * eligible pick exists; `mostCoreStarters` is `null` when no team has one.
 */
export function getLeagueHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetPlayerRoleOptions,
): LeagueHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const stealCandidates: PlayerHighlight[] = [];
  const bustCandidates: PlayerHighlight[] = [];

  // Per-team core-starter tallies for the volume leader (with rate tie-break).
  const coreCount = new Map<string, number>();
  const scoredCount = new Map<string, number>();

  for (const draft of draftClasses) {
    for (const pick of draft.picks) {
      if (!pickHasSeasonSnapData(pick)) continue;

      const candidate: PlayerHighlight = {
        pick,
        team: teamById.get(pick.teamId),
        draftYear: draft.year,
        score: getPlayerDraftScore(pick, options),
      };

      if (pick.round >= 4) stealCandidates.push(candidate);
      if (pick.round === 1) bustCandidates.push(candidate);

      scoredCount.set(pick.teamId, (scoredCount.get(pick.teamId) ?? 0) + 1);
      if (getPlayerRole(pick, options) === 'core_starter') {
        coreCount.set(pick.teamId, (coreCount.get(pick.teamId) ?? 0) + 1);
      }
    }
  }

  return {
    steals: stealCandidates.sort(compareSteal).slice(0, HIGHLIGHT_LIST_MAX),
    busts: bustCandidates.sort(compareBust).slice(0, HIGHLIGHT_LIST_MAX),
    mostCoreStarters: pickCoreLeader(coreCount, scoredCount, teamById),
  };
}

/** Ranks steals best first: higher score, then later round, then later pick. */
function compareSteal(a: PlayerHighlight, b: PlayerHighlight): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.pick.round !== b.pick.round) return b.pick.round - a.pick.round;
  return b.pick.overallPick - a.pick.overallPick;
}

/** Ranks busts worst first: lower score, then earlier overall pick. */
function compareBust(a: PlayerHighlight, b: PlayerHighlight): number {
  if (a.score !== b.score) return a.score - b.score;
  return a.pick.overallPick - b.pick.overallPick;
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
