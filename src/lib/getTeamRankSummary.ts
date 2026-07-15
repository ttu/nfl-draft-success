import type { DraftClass, Team } from '../types';
import {
  getRollingDraftScore,
  type GetRollingDraftScoreOptions,
} from './getRollingDraftScore';
import { getDraftClassMetrics } from './getDraftClassMetrics';

/** One row in the rolling-score leaderboard (matches UI `TeamRanking`). */
export interface RankedTeamRow {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
  /** Total team picks in the loaded draft span (includes awaiting-data picks). */
  picks: number;
  /** Share of scored picks classified as core starters (0–1). */
  coreRate: number;
  /** Share of scored picks still on roster (0–1). */
  retentionRate: number;
  /**
   * Per-draft-year class score (0–100), oldest → newest. Only years in which
   * the team has at least one scored pick are included, so the sparkline never
   * dips to zero for a class that is merely awaiting season data.
   */
  trend: number[];
  /**
   * Rank movement vs. the prior window (the same span minus its most recent
   * draft year). Positive = moved up. `undefined` when there is no prior window.
   */
  change?: number;
}

/** Competition ranking (ties share a rank) of `teams` by rolling score. */
function rankByScore(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options: GetRollingDraftScoreOptions,
): Map<string, number> {
  const scored = teams
    .map((t) => ({
      teamId: t.id,
      score: getRollingDraftScore(draftClasses, t.id, options).score,
    }))
    .sort((a, b) => b.score - a.score);

  const ranks = new Map<string, number>();
  let rank = 1;
  let prevScore = Infinity;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].score < prevScore) rank = i + 1;
    prevScore = scored[i].score;
    ranks.set(scored[i].teamId, rank);
  }
  return ranks;
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

  const yearsAsc = [...draftClasses].sort((a, b) => a.year - b.year);

  // Prior window: same span minus its most recent draft year, used for the YoY
  // rank delta. Empty when only one year is loaded (no comparison possible).
  const latestYear = Math.max(...draftClasses.map((d) => d.year));
  const priorClasses = draftClasses.filter((d) => d.year !== latestYear);
  const priorRanks =
    priorClasses.length > 0
      ? rankByScore(priorClasses, teams, options)
      : undefined;

  const teamRows = teams.map((t) => {
    const rolling = getRollingDraftScore(draftClasses, t.id, options);
    const trend: number[] = [];
    for (const draft of yearsAsc) {
      const m = getDraftClassMetrics(draft, t.id, options);
      if (m.totalPicks - m.awaitingDataCount > 0) trend.push(m.draftScore);
    }
    return {
      teamId: t.id,
      teamName: t.name,
      score: rolling.score,
      picks: rolling.totalPicks,
      coreRate: rolling.coreStarterRate,
      retentionRate: rolling.retentionRate,
      trend,
    };
  });
  teamRows.sort((a, b) => b.score - a.score);

  const rankings: RankedTeamRow[] = [];
  let rank = 1;
  let prevScore = Infinity;
  let selectedRank = 0;

  for (let i = 0; i < teamRows.length; i++) {
    if (teamRows[i].score < prevScore) rank = i + 1;
    prevScore = teamRows[i].score;
    const priorRank = priorRanks?.get(teamRows[i].teamId);
    rankings.push({
      ...teamRows[i],
      rank,
      change: priorRank != null ? priorRank - rank : undefined,
    });
    if (teamRows[i].teamId === selectedTeam) selectedRank = rank;
  }

  return {
    rank: selectedRank,
    total: teams.length,
    rankings,
  };
}
