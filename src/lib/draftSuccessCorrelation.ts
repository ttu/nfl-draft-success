import type { TeamSuccess } from './teamSuccess';

/** A team's draft scores, as carried in the pre-computed rankings. */
export interface ScoreEntry {
  teamId: string;
  /** Raw draft-success score (how much the team's picks played, 0–100). */
  score: number;
  /** Over slot: draft value above what each pick's slot predicted (skill). */
  overSlot: number;
}

/** One team joined across the draft scores and its real on-field outcomes. */
export interface CorrelationRow extends TeamSuccess {
  score: number;
  overSlot: number;
  /** Percentile of this team's raw draft score among all joined teams (0–100). */
  scorePercentile: number;
  /** Percentile of this team's over slot among all joined teams (0–100). */
  overSlotPercentile: number;
  /** Percentile of this team's win rate among all joined teams (0–100). */
  winPctPercentile: number;
}

/** "made / of" — of the highest-scoring teams, how many were regular playoff teams. */
export interface TopIndexPlayoffRatio {
  made: number;
  of: number;
}

export interface CorrelationResult {
  /** One row per team present in both inputs, highest over slot first. */
  rows: CorrelationRow[];
  /** Pearson r between raw draft score and regular-season win rate (the contrast). */
  pearsonR: number;
  /** Pearson r between over slot and regular-season win rate (the headline). */
  skillPearsonR: number;
  /** Teams in both inputs — the n behind both coefficients, and their intervals. */
  teamCount: number;
  /** 95% interval on {@link pearsonR}; null when it cannot be computed. */
  pearsonInterval: CorrelationInterval | null;
  /** 95% interval on {@link skillPearsonR}; null when it cannot be computed. */
  skillPearsonInterval: CorrelationInterval | null;
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
    .map((s) => ({
      score: s.score,
      overSlot: s.overSlot,
      outcome: successById.get(s.teamId),
    }))
    .filter(
      (j): j is { score: number; overSlot: number; outcome: TeamSuccess } =>
        j.outcome != null,
    );

  const scoreValues = joined.map((j) => j.score);
  const overSlotValues = joined.map((j) => j.overSlot);
  const winPctValues = joined.map((j) => j.outcome.winPct);

  const rows: CorrelationRow[] = joined
    .map((j) => ({
      ...j.outcome,
      score: j.score,
      overSlot: j.overSlot,
      scorePercentile: percentileRank(scoreValues, j.score),
      overSlotPercentile: percentileRank(overSlotValues, j.overSlot),
      winPctPercentile: percentileRank(winPctValues, j.outcome.winPct),
    }))
    // Over slot is the headline drafting-skill signal, so rank by it.
    .sort((a, b) => b.overSlot - a.overSlot);

  const topTeams = rows.slice(0, topN);
  const topIndexPlayoffRatio: TopIndexPlayoffRatio = {
    made: topTeams.filter((r) => r.playoffApps >= playoffThreshold).length,
    of: topTeams.length,
  };

  const pearsonR = pearson(scoreValues, winPctValues);
  const skillPearsonR = pearson(overSlotValues, winPctValues);
  const teamCount = joined.length;

  return {
    rows,
    pearsonR,
    skillPearsonR,
    teamCount,
    pearsonInterval: pearsonInterval(pearsonR, teamCount),
    skillPearsonInterval: pearsonInterval(skillPearsonR, teamCount),
    topIndexPlayoffRatio,
  };
}

/**
 * Whether a team's drafting runs ahead of its record, the other way round, or
 * roughly in step. The gap is between the over-slot (drafting-skill) and
 * win-rate percentiles, so a team is only ever compared with the rest of the
 * league, not against an absolute bar.
 */
function gapBeat(row: CorrelationRow): string {
  const gap = row.overSlotPercentile - row.winPctPercentile;
  if (gap > 15) {
    return 'This team is drafting better than its record shows — the wins have not caught up yet.';
  }
  if (gap < -15) {
    return 'This team is winning beyond what its draft returns alone would predict — coaching, health and veterans are carrying weight.';
  }
  return 'Drafting and winning are tracking closely for this team.';
}

/** How often the team played in January, banded frequent / occasional / never. */
function playoffsClause(playoffApps: number, seasons: number): string {
  if (playoffApps === 0) {
    return `It did not reach the postseason in any of those ${seasons} seasons`;
  }
  const counted = `It reached the postseason in ${playoffApps} of those ${seasons} seasons`;
  // Strictly fewer than half, so an even split never reads "less often than not".
  return playoffApps / seasons < 0.5
    ? `${counted}, less often than not`
    : counted;
}

/**
 * What the record actually produced in January. States the outcome and stops
 * there: it never attributes the postseason to the draft, because the
 * league-wide correlation in this dataset runs negative and the Methodology
 * view says so.
 */
function postseasonBeat(row: CorrelationRow): string | null {
  const { seasons, playoffApps, sbApps, sbWins } = row;
  if (seasons === 0) return null;

  const playoffs = playoffsClause(playoffApps, seasons);

  if (sbApps === 0) return `${playoffs}.`;
  // "reached … reaching" in one sentence, so the Super Bowl clause is phrased
  // as a count rather than repeating the verb.
  const trips =
    sbApps === 1 ? 'one Super Bowl trip' : `${sbApps} Super Bowl trips`;
  if (sbWins === 0) return `${playoffs}, with ${trips} and no title.`;
  const wins = sbWins === 1 ? 'one win' : `${sbWins} wins`;
  return `${playoffs}, with ${trips} and ${wins}.`;
}

/**
 * A plain-language read on a single team's row, one sentence per beat: how its
 * drafting compares with its record, then what that record produced.
 */
export function teamStory(row: CorrelationRow): string[] {
  return [gapBeat(row), postseasonBeat(row)].filter(
    (beat): beat is string => beat !== null,
  );
}

export type CorrelationStrength = 'no' | 'weak' | 'moderate' | 'strong';
export type CorrelationDirection = 'positive' | 'negative';

/** A correlation's 95% confidence interval. */
export interface CorrelationInterval {
  lo: number;
  hi: number;
}

/**
 * 95% confidence interval for a Pearson r, via the Fisher z transform.
 *
 * Returns null where the transform is undefined: fewer than four pairs leaves
 * no degrees of freedom, and |r| = 1 sends z to infinity.
 */
export function pearsonInterval(
  r: number,
  n: number,
): CorrelationInterval | null {
  if (!Number.isFinite(r) || n < 4 || Math.abs(r) >= 1) return null;
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  return { lo: Math.tanh(z - 1.96 * se), hi: Math.tanh(z + 1.96 * se) };
}

/**
 * Band a correlation coefficient into a plain-language strength and direction,
 * so the methodology copy describes whatever the current window's real `r`
 * turns out to be — instead of asserting a fixed narrative.
 *
 * Pass `n` wherever it is known. The magnitude bands are large-sample rules of
 * thumb, and this league has 32 teams: the 95% interval on r is roughly ±0.35
 * wide there, so the raw-score r of 0.227 was being described as a "weak"
 * relationship when the data cannot separate it from zero at all. When the
 * interval spans zero the strength is `no`, whatever the magnitude — the honest
 * reading of a coefficient that thirty-two points cannot resolve.
 */
export function classifyCorrelation(
  r: number,
  n?: number,
): {
  strength: CorrelationStrength;
  direction: CorrelationDirection;
} {
  const direction: CorrelationDirection = r < 0 ? 'negative' : 'positive';
  const interval = n === undefined ? null : pearsonInterval(r, n);
  if (interval && interval.lo <= 0 && interval.hi >= 0) {
    return { strength: 'no', direction };
  }
  const abs = Math.abs(r);
  let strength: CorrelationStrength = 'no';
  if (abs >= 0.5) strength = 'strong';
  else if (abs >= 0.3) strength = 'moderate';
  else if (abs >= 0.1) strength = 'weak';
  return { strength, direction };
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
