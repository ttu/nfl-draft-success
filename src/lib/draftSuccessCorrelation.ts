import type { TeamSuccess } from './teamSuccess';

/** A team's draft-success score, as carried in the pre-computed rankings. */
export interface ScoreEntry {
  teamId: string;
  score: number;
}

/** One team joined across the draft score and its real on-field outcomes. */
export interface CorrelationRow extends TeamSuccess {
  score: number;
  /** Percentile of this team's draft score among all joined teams (0–100). */
  scorePercentile: number;
  /** Percentile of this team's win rate among all joined teams (0–100). */
  winPctPercentile: number;
}

/** "made / of" — of the highest-scoring teams, how many were regular playoff teams. */
export interface TopIndexPlayoffRatio {
  made: number;
  of: number;
}

export interface CorrelationResult {
  /** One row per team present in both inputs, highest draft score first. */
  rows: CorrelationRow[];
  /** Pearson r between draft score and regular-season win rate. */
  pearsonR: number;
  topIndexPlayoffRatio: TopIndexPlayoffRatio;
}

export interface BuildCorrelationOptions {
  /** How many of the top-scoring teams the playoff ratio considers (default 5). */
  topN?: number;
  /** Playoff appearances a top team needs to count as a "regular" one (default 3). */
  playoffThreshold?: number;
}

/**
 * Join pre-computed draft scores to real team outcomes, one row per team in
 * both inputs, and derive the league-wide correlation figures the methodology
 * and team-detail views report. Teams missing from either side are dropped, so
 * the percentiles and correlation only ever compare like with like.
 */
export function buildCorrelation(
  scores: ScoreEntry[],
  success: TeamSuccess[],
  options?: BuildCorrelationOptions,
): CorrelationResult {
  const topN = options?.topN ?? 5;
  const playoffThreshold = options?.playoffThreshold ?? 3;

  const successById = new Map(success.map((s) => [s.teamId, s]));
  const joined = scores
    .map((s) => ({ score: s.score, outcome: successById.get(s.teamId) }))
    .filter(
      (j): j is { score: number; outcome: TeamSuccess } => j.outcome != null,
    );

  const scoreValues = joined.map((j) => j.score);
  const winPctValues = joined.map((j) => j.outcome.winPct);

  const rows: CorrelationRow[] = joined
    .map((j) => ({
      ...j.outcome,
      score: j.score,
      scorePercentile: percentileRank(scoreValues, j.score),
      winPctPercentile: percentileRank(winPctValues, j.outcome.winPct),
    }))
    .sort((a, b) => b.score - a.score);

  const topTeams = rows.slice(0, topN);
  const topIndexPlayoffRatio: TopIndexPlayoffRatio = {
    made: topTeams.filter((r) => r.playoffApps >= playoffThreshold).length,
    of: topTeams.length,
  };

  return {
    rows,
    pearsonR: pearson(scoreValues, winPctValues),
    topIndexPlayoffRatio,
  };
}

/**
 * A one-line, plain-language read on a single team's row: whether its drafting
 * is running ahead of its record, the other way round, or roughly in step. The
 * gap is between the draft-score and win-rate percentiles, so a team is only
 * ever compared with the rest of the league, not against an absolute bar.
 */
export function teamStory(row: CorrelationRow): string {
  const gap = row.scorePercentile - row.winPctPercentile;
  if (gap > 15) {
    return 'This team is drafting better than its record shows — the wins have not caught up yet.';
  }
  if (gap < -15) {
    return 'This team is winning beyond what its draft returns alone would predict — coaching, health and veterans are carrying weight.';
  }
  return 'Drafting and winning are tracking closely for this team.';
}

export type CorrelationStrength = 'no' | 'weak' | 'moderate' | 'strong';
export type CorrelationDirection = 'positive' | 'negative';

/**
 * Band a correlation coefficient into a plain-language strength and direction,
 * so the methodology copy describes whatever the current window's real `r`
 * turns out to be — instead of asserting a fixed narrative. Magnitude bands
 * follow the usual weak/moderate/strong rule of thumb.
 */
export function classifyCorrelation(r: number): {
  strength: CorrelationStrength;
  direction: CorrelationDirection;
} {
  const abs = Math.abs(r);
  let strength: CorrelationStrength = 'no';
  if (abs >= 0.5) strength = 'strong';
  else if (abs >= 0.3) strength = 'moderate';
  else if (abs >= 0.1) strength = 'weak';
  return { strength, direction: r < 0 ? 'negative' : 'positive' };
}

/**
 * Pearson correlation coefficient between two equal-length series. Returns 0
 * when either series has no variance (a flat line has no linear relationship to
 * measure) or when the inputs are empty or mismatched.
 */
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
}

/**
 * Where `value` sits within `values`, as the percentage of entries at or below
 * it (0–100, rounded). The maximum entry is the 100th percentile. Returns 0 for
 * an empty set.
 */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  const atOrBelow = values.filter((v) => v <= value).length;
  return Math.round((atOrBelow / values.length) * 100);
}
