import type { DraftClass, Team } from '../types';
import {
  getRollingDraftScore,
  type GetRollingDraftScoreOptions,
} from './getRollingDraftScore';

/** One row in the rolling-score leaderboard (matches UI `TeamRanking`). */
export interface RankedTeamRow {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

export interface TeamRankSummary {
  /** Selected team’s rank (1-based), or `0` if none selected or team not in list */
  rank: number;
  total: number;
  rankings: RankedTeamRow[];
}

/**
 * Build sorted rolling-draft rankings for all `teams` over `draftClasses`, and
 * the selected team’s rank. Returns `null` when there is no draft data.
 */
export function getTeamRankSummary(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  selectedTeam: string | null,
  options: GetRollingDraftScoreOptions,
): TeamRankSummary | null {
  if (draftClasses.length === 0) return null;

  const teamScores = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    score: getRollingDraftScore(draftClasses, t.id, options).score,
  }));
  teamScores.sort((a, b) => b.score - a.score);

  const rankings: RankedTeamRow[] = [];
  let rank = 1;
  let prevScore = Infinity;
  let selectedRank = 0;

  for (let i = 0; i < teamScores.length; i++) {
    if (teamScores[i].score < prevScore) rank = i + 1;
    prevScore = teamScores[i].score;
    rankings.push({
      ...teamScores[i],
      rank,
    });
    if (teamScores[i].teamId === selectedTeam) selectedRank = rank;
  }

  return {
    rank: selectedRank,
    total: teams.length,
    rankings,
  };
}
