import { describe, it, expect } from 'vitest';
import {
  fitDraftSlotCurve,
  expectedScore,
  expectedScoreForPick,
  getPlayerDraftSkill,
  type DraftSlotPoint,
} from './draftSlotBaseline';
import { getPlayerDraftScore } from './getPlayerRole';
import type { DraftPick, Season } from '../types';

/** Sample a true expectation curve at every pick, `perPick` times over. */
function samplePicks(
  trueCurve: (overallPick: number) => number,
  lastPick = 260,
  perPick = 2,
): DraftSlotPoint[] {
  const points: DraftSlotPoint[] = [];
  for (let overallPick = 1; overallPick <= lastPick; overallPick++) {
    for (let i = 0; i < perPick; i++) {
      points.push({ overallPick, score: trueCurve(overallPick) });
    }
  }
  return points;
}

/**
 * Flat across the top of round 1, then falling — the shape real draft data has,
 * and the one a single log-linear line provably cannot follow.
 */
const FLAT_TOPPED = (overallPick: number) =>
  overallPick <= 12 ? 85 : 85 - 25 * (Math.log(overallPick) - Math.log(12));

describe('fitDraftSlotCurve', () => {
  it('follows a flat-topped curve that a log-linear fit could not', () => {
    const curve = fitDraftSlotCurve(samplePicks(FLAT_TOPPED));

    // A straight line in log space would have to overshoot the top of the
    // draft to reach the tail; the smoother tracks the plateau instead. Points
    // near the kink at pick 12 pool a little of the decline, so allow ~1 point.
    for (const overallPick of [2, 5, 10, 100, 250]) {
      expect(expectedScore(curve, overallPick)).toBeGreaterThan(
        FLAT_TOPPED(overallPick) - 1.5,
      );
      expect(expectedScore(curve, overallPick)).toBeLessThan(
        FLAT_TOPPED(overallPick) + 1.5,
      );
    }
  });

  it('never expects a later pick to outscore an earlier one', () => {
    // Noise that locally reverses the trend must not produce a rising curve.
    const noisy = samplePicks((overallPick) =>
      overallPick >= 6 && overallPick <= 10 ? 95 : FLAT_TOPPED(overallPick),
    );

    const curve = fitDraftSlotCurve(noisy);

    for (let overallPick = 2; overallPick <= 260; overallPick++) {
      expect(expectedScore(curve, overallPick)).toBeLessThanOrEqual(
        expectedScore(curve, overallPick - 1) + 1e-9,
      );
    }
  });

  it('keeps every knot on the 0–100 score scale', () => {
    const curve = fitDraftSlotCurve(
      samplePicks((overallPick) => (overallPick <= 5 ? 100 : 0)),
    );

    for (const knot of curve.knots) {
      expect(knot.expected).toBeGreaterThanOrEqual(0);
      expect(knot.expected).toBeLessThanOrEqual(100);
    }
  });

  it('spans exactly the observed pick range', () => {
    const curve = fitDraftSlotCurve([
      { overallPick: 12, score: 80 },
      { overallPick: 60, score: 60 },
      { overallPick: 140, score: 30 },
    ]);

    expect(curve.knots[0].overallPick).toBe(12);
    expect(curve.knots[curve.knots.length - 1].overallPick).toBe(140);
  });

  it('degrades to a flat curve when every pick shares one slot', () => {
    const curve = fitDraftSlotCurve([
      { overallPick: 7, score: 40 },
      { overallPick: 7, score: 60 },
    ]);

    expect(expectedScore(curve, 7)).toBeCloseTo(50, 6);
    expect(expectedScore(curve, 200)).toBeCloseTo(50, 6);
  });

  it('returns an empty curve for no points', () => {
    expect(fitDraftSlotCurve([]).knots).toEqual([]);
  });
});

describe('expectedScore', () => {
  const curve = {
    knots: [
      { overallPick: 10, expected: 80 },
      { overallPick: 100, expected: 40 },
    ],
  };

  it('reads a knot value exactly', () => {
    expect(expectedScore(curve, 10)).toBeCloseTo(80, 6);
    expect(expectedScore(curve, 100)).toBeCloseTo(40, 6);
  });

  it('interpolates linearly in log-pick space between knots', () => {
    // Geometric midpoint of 10 and 100 is 31.6…, halfway in ln space.
    expect(expectedScore(curve, Math.sqrt(10 * 100))).toBeCloseTo(60, 6);
  });

  it('holds the end knots flat outside the fitted range', () => {
    expect(expectedScore(curve, 1)).toBeCloseTo(80, 6);
    expect(expectedScore(curve, 300)).toBeCloseTo(40, 6);
  });

  it('expects nothing from an empty curve', () => {
    expect(expectedScore({ knots: [] }, 5)).toBe(0);
  });
});

function season(overrides: Partial<Season> = {}): Season {
  return {
    year: 2019,
    gamesPlayed: 16,
    teamGames: 16,
    snapShare: 0.9,
    retained: true,
    ...overrides,
  };
}

function pick(overallPick: number, seasons: Season[]): DraftPick {
  return {
    playerId: `p${overallPick}`,
    playerName: `Player ${overallPick}`,
    position: 'WR',
    round: Math.ceil(overallPick / 32),
    overallPick,
    teamId: 'KC',
    seasons,
  };
}

describe('expectedScoreForPick (shipped curve)', () => {
  it('expects earlier picks to score higher than later picks', () => {
    expect(expectedScoreForPick(1)).toBeGreaterThan(expectedScoreForPick(200));
  });

  it('stays within the 0–100 scale', () => {
    expect(expectedScoreForPick(1)).toBeLessThanOrEqual(100);
    expect(expectedScoreForPick(260)).toBeGreaterThanOrEqual(0);
  });

  it('leaves the top of the draft room to beat its slot', () => {
    // The old clamped log fit expected a perfect 100 from picks 1–5, so those
    // slots could never post a positive over slot no matter how well they hit.
    for (const overallPick of [1, 2, 3, 4, 5]) {
      expect(expectedScoreForPick(overallPick)).toBeLessThan(95);
    }
  });
});

describe('getPlayerDraftSkill', () => {
  it('is strongly positive for a late pick who plays like a starter (a steal)', () => {
    const steal = pick(220, [season({ snapShare: 0.9 })]);
    expect(getPlayerDraftSkill(steal)).toBeGreaterThan(20);
  });

  it('is strongly negative for an early pick who barely plays (a reach)', () => {
    const reach = pick(3, [season({ snapShare: 0.1 })]);
    expect(getPlayerDraftSkill(reach)).toBeLessThan(-20);
  });

  it('is positive for a top-5 pick who plays like a full-time starter', () => {
    const hit = pick(3, [season({ snapShare: 0.95 })]);
    expect(getPlayerDraftSkill(hit)).toBeGreaterThan(0);
  });

  it('equals the pick score minus the slot expectation', () => {
    const p = pick(64, [season({ snapShare: 0.6 })]);
    const skill = getPlayerDraftSkill(p);
    expect(skill).toBeCloseTo(
      getPlayerDraftScore(p) - expectedScoreForPick(64),
      6,
    );
  });
});
