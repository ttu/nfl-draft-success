import type { DraftClass } from '../types';
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
 * Every team ranked by the mean career score of the tracked draftees on its
 * roster right now — the same figure each team's own roster page shows.
 *
 * Players are counted against the team they are on today, not the one that
 * drafted them, so a trade moves the credit with the player.
 *
 * Teams with no scored player rank last, keeping their score `undefined`
 * rather than 0: a roster of rookies who have not played is an unknown, and a
 * zero would file it below rosters that are genuinely bad.
 */
export function getRosterRankings(draftClasses: DraftClass[]): RosterRanking[] {
  const byTeam = new Map<string, Pick<RosterEntry, 'score'>[]>();
  for (const team of TEAMS) byTeam.set(team.id, []);

  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      const teamId = getCurrentTeamForPick(pick);
      if (teamId === undefined) continue;
      const entries = byTeam.get(teamId);
      if (entries === undefined) continue;
      const played = playedSeasons(pick).length;
      entries.push({
        score: played > 0 ? getPlayerDraftScore(pick) : undefined,
      });
    }
  }

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
