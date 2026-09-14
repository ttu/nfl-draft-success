import type { Acquisition, DraftClass, FreeAgentClass } from '../types';
import { TEAMS } from '../data/teams';
import {
  getCurrentTeamForPick,
  rosterMeanScore,
  type RosterEntry,
} from './currentRoster';
import { getPlayerDraftScore } from './getPlayerRole';
import { playedSeasons } from './seasonPlayed';

/** One team's line on the league-wide current-roster board. */
export interface RosterRanking {
  teamId: string;
  teamName: string;
  /** Mean career score of his rostered draftees, or undefined when none scored. */
  score: number | undefined;
  /** Tracked draftees on the roster, scored or not. */
  players: number;
  /** 1-based position in the board. */
  rank: number;
}

/**
 * Every team ranked by the mean career score of the tracked players on its
 * roster right now — the same figure each team's own roster page shows, and
 * built from the same two populations so the two can never disagree about what
 * a roster is.
 *
 * Players are counted against the team they are on today, not the one that
 * acquired them, so a trade or a signing moves the credit with the player.
 *
 * This is the one board in the app whose numbers include undrafted players.
 * The draft rankings measure what a team's *picks* returned and stay picks-only
 * by design; this one measures the roster a team actually fields.
 *
 * Teams with no scored player rank last, keeping their score `undefined`
 * rather than 0: a roster of rookies who have not played is an unknown, and a
 * zero would file it below rosters that are genuinely bad.
 */
export function getRosterRankings(
  draftClasses: DraftClass[],
  freeAgentClasses: FreeAgentClass[],
): RosterRanking[] {
  const byTeam = new Map<string, Pick<RosterEntry, 'score'>[]>();
  for (const team of TEAMS) byTeam.set(team.id, []);

  const add = (pick: Acquisition) => {
    const teamId = getCurrentTeamForPick(pick);
    if (teamId === undefined) return;
    const entries = byTeam.get(teamId);
    if (entries === undefined) return;
    const played = playedSeasons(pick).length;
    entries.push({
      score: played > 0 ? getPlayerDraftScore(pick) : undefined,
    });
  };

  for (const dc of draftClasses) for (const pick of dc.picks) add(pick);
  for (const fc of freeAgentClasses)
    for (const player of fc.freeAgents) add(player);

  return TEAMS.map((team) => {
    const entries = byTeam.get(team.id) ?? [];
    return {
      teamId: team.id,
      teamName: team.name,
      score: rosterMeanScore(entries),
      players: entries.length,
    };
  })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
