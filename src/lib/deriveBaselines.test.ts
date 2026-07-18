import { describe, it, expect } from 'vitest';
import { deriveBaselinesFromClasses, percentile } from './deriveBaselines';
import { getPositionBaseline, BASELINE_FLOOR } from './positionBaseline';
import type { DraftClass, DraftPick, Season } from '../types';

function season(over: Partial<Season> = {}): Season {
  return {
    year: 2023,
    gamesPlayed: 17,
    teamGames: 17,
    snapShare: 0.6,
    retained: true,
    ...over,
  };
}

/** One pick carrying `count` identical qualifying seasons at `snapShare`. */
function pickWithSeasons(
  position: string,
  count: number,
  over: Partial<Season> = {},
): DraftPick {
  return {
    playerId: `${position}-1`,
    playerName: `${position} Player`,
    position,
    round: 1,
    overallPick: 1,
    teamId: 'KC',
    seasons: Array.from({ length: count }, (_, i) =>
      season({ year: 2000 + i, ...over }),
    ),
  };
}

function draftClass(picks: DraftPick[]): DraftClass {
  return { year: 2020, picks };
}

describe('percentile', () => {
  it('interpolates linearly between neighbouring samples', () => {
    expect(percentile([0, 10, 20, 30, 40], 0.5)).toBe(20);
    expect(percentile([0, 1], 0.9)).toBeCloseTo(0.9, 10);
  });
});

describe('deriveBaselinesFromClasses', () => {
  it('derives a baseline from RAW snap share, not the position-adjusted one', () => {
    // Regression: derivation used to read shares through snapShareForRoleTier,
    // which divides by the very baselines this script writes. Deriving from
    // already-adjusted data drove every position to ~1.0 in a single run and
    // silently disabled position adjustment. RB has a baseline well below 1, so
    // the two readings are far apart and the bug is unmistakable here.
    expect(getPositionBaseline('RB')).toBeLessThan(0.9);

    const { baselines } = deriveBaselinesFromClasses([
      draftClass([pickWithSeasons('RB', 30, { snapShare: 0.6 })]),
    ]);

    expect(baselines.RB).toBe(0.6);
  });

  it('is idempotent — a second run reproduces the same baselines', () => {
    const classes = [
      draftClass([pickWithSeasons('RB', 30, { snapShare: 0.6 })]),
    ];

    const first = deriveBaselinesFromClasses(classes).baselines;
    const second = deriveBaselinesFromClasses(classes).baselines;

    expect(second).toEqual(first);
  });

  it('prefers cumulative load, capped at average snap', () => {
    const { baselines } = deriveBaselinesFromClasses([
      draftClass([
        pickWithSeasons('RB', 30, { snapShare: 0.6, cumulativeSnapShare: 0.5 }),
      ]),
    ]);

    expect(baselines.RB).toBe(0.5);
  });

  it('ignores seasons below the availability bar', () => {
    // 30 full seasons at 0.6 plus 30 half-missed seasons at 0.2: the low
    // seasons describe injury absence, not the size of the role.
    const { baselines } = deriveBaselinesFromClasses([
      draftClass([
        pickWithSeasons('RB', 30, { snapShare: 0.6 }),
        {
          ...pickWithSeasons('RB', 30, { snapShare: 0.2 }),
          playerId: 'RB-2',
          seasons: Array.from({ length: 30 }, (_, i) =>
            season({ year: 2000 + i, snapShare: 0.2, gamesPlayed: 4 }),
          ),
        },
      ]),
    ]);

    expect(baselines.RB).toBe(0.6);
  });

  it('skips positions with too few qualifying seasons', () => {
    const { baselines, skipped } = deriveBaselinesFromClasses([
      draftClass([pickWithSeasons('RB', 5)]),
    ]);

    expect(baselines.RB).toBeUndefined();
    expect(skipped).toEqual(['RB (n=5)']);
  });

  it('excludes kickers, punters and long snappers entirely', () => {
    const { baselines, skipped } = deriveBaselinesFromClasses([
      draftClass([pickWithSeasons('K', 30), pickWithSeasons('P', 30)]),
    ]);

    expect(baselines).toEqual({});
    expect(skipped).toEqual([]);
  });

  it('floors implausibly low samples', () => {
    const { baselines } = deriveBaselinesFromClasses([
      draftClass([pickWithSeasons('RB', 30, { snapShare: 0.05 })]),
    ]);

    expect(baselines.RB).toBe(BASELINE_FLOOR);
  });
});
