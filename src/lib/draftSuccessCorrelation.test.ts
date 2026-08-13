import { describe, it, expect } from 'vitest';
import {
  pearson,
  percentileRank,
  buildCorrelation,
  teamStory,
  classifyCorrelation,
  pearsonInterval,
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
  const row = (
    overSlotPct: number,
    winPctPct: number,
    postseason: { playoffApps?: number; sbApps?: number; sbWins?: number } = {},
  ) => ({
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
    ...postseason,
    scorePercentile: 0,
    overSlotPercentile: overSlotPct,
    winPctPercentile: winPctPct,
  });

  /** The gap read, which always leads the story. */
  const gapBeat = (...args: Parameters<typeof row>) =>
    teamStory(row(...args))[0];

  it('says drafting outpaces winning when the over-slot percentile is well ahead', () => {
    expect(gapBeat(90, 40)).toMatch(/draft/i);
    expect(gapBeat(90, 40)).not.toEqual(gapBeat(50, 50));
  });

  it('says the two track closely when the percentiles are near each other', () => {
    expect(gapBeat(91, 94)).toMatch(/closely/i);
  });

  it('says winning outpaces drafting when the win percentile is well ahead', () => {
    expect(gapBeat(40, 90)).not.toEqual(gapBeat(90, 40));
    expect(gapBeat(40, 90)).toMatch(/winning|record/i);
  });

  describe('postseason beat', () => {
    it('follows the gap read', () => {
      expect(teamStory(row(50, 50, { playoffApps: 4 }))).toHaveLength(2);
    });

    it('cites playoff appearances against the seasons in the window', () => {
      expect(teamStory(row(50, 50, { playoffApps: 4 }))[1]).toContain(
        '4 of those 5 seasons',
      );
    });

    it('distinguishes frequent, occasional and rare postseasons', () => {
      const shapes = [4, 2, 0].map((playoffApps) =>
        teamStory(row(50, 50, { playoffApps }))[1].replace(/\d+/g, '#'),
      );
      expect(new Set(shapes).size).toBe(3);
    });

    it('does not call an even split less often than not', () => {
      const half = teamStory({ ...row(50, 50), seasons: 4, playoffApps: 2 })[1];
      expect(half).not.toMatch(/less often than not/i);
      const under = teamStory({
        ...row(50, 50),
        seasons: 4,
        playoffApps: 1,
      })[1];
      expect(under).toMatch(/less often than not/i);
    });

    it('adds a Super Bowl clause only when the team reached one', () => {
      expect(teamStory(row(50, 50, { playoffApps: 4 }))[1]).not.toMatch(
        /Super Bowl/i,
      );
      expect(
        teamStory(row(50, 50, { playoffApps: 4, sbApps: 2, sbWins: 1 }))[1],
      ).toMatch(/Super Bowl/i);
    });

    it('separates reaching a Super Bowl from winning one', () => {
      const lost = teamStory(row(50, 50, { playoffApps: 4, sbApps: 1 }))[1];
      const won = teamStory(
        row(50, 50, { playoffApps: 4, sbApps: 1, sbWins: 1 }),
      )[1];
      expect(lost).not.toEqual(won);
    });

    it('does not claim the draft caused the record', () => {
      const story = teamStory(
        row(90, 40, { playoffApps: 4, sbApps: 1, sbWins: 1 }),
      ).join(' ');
      expect(story).not.toMatch(/because|thanks to|driven by|the result of/i);
    });

    it('is omitted when the window holds no played seasons', () => {
      expect(teamStory({ ...row(50, 50), seasons: 0 })).toHaveLength(1);
    });
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

  /**
   * The bands are large-sample rules of thumb. There are 32 teams, where the
   * 95% interval on r is roughly ±0.35, so "weak" was being printed for values
   * the data cannot separate from zero — the raw-score r of 0.227 among them.
   */
  it('reports no relationship when the interval spans zero', () => {
    // r = 0.227, n = 32: the shipped raw-score figure. CI ≈ [-0.13, 0.53].
    expect(classifyCorrelation(0.227, 32).strength).toBe('no');
    // The same r on a sample large enough to resolve it is a real weak signal.
    expect(classifyCorrelation(0.227, 400).strength).toBe('weak');
  });

  it('keeps the magnitude band once the interval clears zero', () => {
    // r = 0.467, n = 32: over slot. CI ≈ [0.14, 0.70] — excludes zero.
    expect(classifyCorrelation(0.467, 32).strength).toBe('moderate');
    expect(classifyCorrelation(0.467, 32).direction).toBe('positive');
  });

  it('falls back to the magnitude band when no sample size is given', () => {
    expect(classifyCorrelation(0.2).strength).toBe('weak');
  });
});

describe('pearsonInterval', () => {
  it('brackets the estimate', () => {
    const ci = pearsonInterval(0.467, 32);
    expect(ci).not.toBeNull();
    expect(ci!.lo).toBeLessThan(0.467);
    expect(ci!.hi).toBeGreaterThan(0.467);
  });

  it('matches the Fisher z interval for the shipped figures', () => {
    expect(pearsonInterval(0.467, 32)!.lo).toBeCloseTo(0.14, 1);
    expect(pearsonInterval(0.467, 32)!.hi).toBeCloseTo(0.7, 1);
    expect(pearsonInterval(0.227, 32)!.lo).toBeCloseTo(-0.13, 1);
    expect(pearsonInterval(0.227, 32)!.hi).toBeCloseTo(0.53, 1);
  });

  it('narrows as the sample grows', () => {
    const small = pearsonInterval(0.4, 20)!;
    const large = pearsonInterval(0.4, 500)!;
    expect(large.hi - large.lo).toBeLessThan(small.hi - small.lo);
  });

  it('returns null where the transform is undefined', () => {
    // n < 4 leaves no degrees of freedom; |r| = 1 sends the transform to ±∞.
    expect(pearsonInterval(0.5, 3)).toBeNull();
    expect(pearsonInterval(1, 32)).toBeNull();
    expect(pearsonInterval(-1, 32)).toBeNull();
  });
});
