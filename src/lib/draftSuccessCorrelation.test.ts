import { describe, it, expect } from 'vitest';
import {
  pearson,
  percentileRank,
  buildCorrelation,
  teamStory,
  classifyCorrelation,
  type ScoreEntry,
} from './draftSuccessCorrelation';
import type { TeamSuccess } from './teamSuccess';

function success(
  teamId: string,
  winPct: number,
  playoffApps = 0,
  sbApps = 0,
  sbWins = 0,
): TeamSuccess {
  return {
    teamId,
    seasons: 5,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct,
    playoffApps,
    sbApps,
    sbWins,
  };
}

describe('pearson', () => {
  it('is +1 for a perfectly increasing relationship', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
  });

  it('is -1 for a perfectly decreasing relationship', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
  });

  it('is 0 when one series is flat (no variance)', () => {
    expect(pearson([1, 2, 3], [5, 5, 5])).toBe(0);
  });
});

describe('percentileRank', () => {
  it('is 100 for the maximum value', () => {
    expect(percentileRank([10, 20, 30, 40], 40)).toBe(100);
  });

  it('reflects the share of values at or below the given value', () => {
    // 3 of 4 values (10, 20, 30) are ≤ 30 → 75th percentile.
    expect(percentileRank([10, 20, 30, 40], 30)).toBe(75);
  });
});

describe('buildCorrelation', () => {
  const scores: ScoreEntry[] = [
    { teamId: 'AAA', score: 80, overSlot: 12 },
    { teamId: 'BBB', score: 60, overSlot: 4 },
    { teamId: 'CCC', score: 40, overSlot: -4 },
    { teamId: 'DDD', score: 20, overSlot: -12 },
  ];
  const successes: TeamSuccess[] = [
    success('AAA', 0.8, 5, 1, 1),
    success('BBB', 0.6, 3),
    success('CCC', 0.4, 1),
    success('DDD', 0.2, 0),
  ];

  it('joins teams present in both inputs and sorts by over slot descending', () => {
    const result = buildCorrelation(scores, successes);
    expect(result.rows.map((r) => r.teamId)).toEqual([
      'AAA',
      'BBB',
      'CCC',
      'DDD',
    ]);
  });

  it('drops teams missing from either input', () => {
    const result = buildCorrelation(
      [...scores, { teamId: 'ZZZ', score: 99, overSlot: 30 }],
      successes,
    );
    expect(result.rows.map((r) => r.teamId)).not.toContain('ZZZ');
  });

  it('carries per-team score, over-slot and win-rate percentiles', () => {
    const top = buildCorrelation(scores, successes).rows[0];
    expect(top.scorePercentile).toBe(100);
    expect(top.overSlotPercentile).toBe(100);
    expect(top.winPctPercentile).toBe(100);
  });

  it('measures both the raw-score→win and over-slot→win correlations', () => {
    const result = buildCorrelation(scores, successes);
    expect(result.pearsonR).toBeCloseTo(1, 5); // raw score vs win
    expect(result.skillPearsonR).toBeCloseTo(1, 5); // over slot vs win
  });

  it('computes the two correlations independently', () => {
    // Raw score is flat (no signal) while over slot tracks winning perfectly.
    const flatRaw: ScoreEntry[] = [
      { teamId: 'AAA', score: 50, overSlot: 12 },
      { teamId: 'BBB', score: 50, overSlot: 4 },
      { teamId: 'CCC', score: 50, overSlot: -4 },
      { teamId: 'DDD', score: 50, overSlot: -12 },
    ];
    const result = buildCorrelation(flatRaw, successes);
    expect(result.pearsonR).toBe(0); // flat raw score → no linear relationship
    expect(result.skillPearsonR).toBeCloseTo(1, 5); // over slot still tracks wins
  });

  it('reports how many top-5 over-slot teams made the playoffs 3+ years', () => {
    const ratio = buildCorrelation(scores, successes).topIndexPlayoffRatio;
    // Of the 4 teams (fewer than 5), AAA (5) and BBB (3) clear the 3+ bar.
    expect(ratio).toEqual({ made: 2, of: 4 });
  });
});

describe('teamStory', () => {
  const row = (overSlotPct: number, winPctPct: number) => ({
    teamId: 'X',
    seasons: 5,
    score: 0,
    overSlot: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct: 0,
    playoffApps: 0,
    sbApps: 0,
    sbWins: 0,
    scorePercentile: 0,
    overSlotPercentile: overSlotPct,
    winPctPercentile: winPctPct,
  });

  it('says drafting outpaces winning when the over-slot percentile is well ahead', () => {
    expect(teamStory(row(90, 40))).toMatch(/draft/i);
    expect(teamStory(row(90, 40))).not.toEqual(teamStory(row(50, 50)));
  });

  it('says the two track closely when the percentiles are near each other', () => {
    expect(teamStory(row(91, 94))).toMatch(/closely/i);
  });

  it('says winning outpaces drafting when the win percentile is well ahead', () => {
    expect(teamStory(row(40, 90))).not.toEqual(teamStory(row(90, 40)));
    expect(teamStory(row(40, 90))).toMatch(/winning|record/i);
  });
});

describe('classifyCorrelation', () => {
  it('reads the sign as the direction', () => {
    expect(classifyCorrelation(-0.37).direction).toBe('negative');
    expect(classifyCorrelation(0.42).direction).toBe('positive');
  });

  it('bands the magnitude by absolute value', () => {
    expect(classifyCorrelation(0.05).strength).toBe('no');
    expect(classifyCorrelation(0.2).strength).toBe('weak');
    expect(classifyCorrelation(-0.37).strength).toBe('moderate');
    expect(classifyCorrelation(0.8).strength).toBe('strong');
  });
});
