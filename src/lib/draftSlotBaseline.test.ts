import { describe, it, expect } from 'vitest';
import {
  fitDraftSlotBaseline,
  expectedScore,
  expectedScoreForPick,
  getPlayerDraftSkill,
} from './draftSlotBaseline';
import { getPlayerDraftScore } from './getPlayerRole';
import type { DraftPick, Season } from '../types';

describe('fitDraftSlotBaseline', () => {
  it('recovers the coefficients of a clean log-linear relationship', () => {
    // score = 120 - 20·ln(pick), sampled at several picks.
    const a = 120;
    const b = -20;
    const points = [1, 5, 16, 32, 64, 100, 200, 256].map((overallPick) => ({
      overallPick,
      score: a + b * Math.log(overallPick),
    }));

    const fit = fitDraftSlotBaseline(points);

    expect(fit.a).toBeCloseTo(a, 6);
    expect(fit.b).toBeCloseTo(b, 6);
  });

  it('produces a decreasing curve for real (noisy) draft data', () => {
    // Early picks tend to score higher, but with scatter.
    const points = [
      { overallPick: 1, score: 90 },
      { overallPick: 2, score: 55 },
      { overallPick: 10, score: 70 },
      { overallPick: 40, score: 50 },
      { overallPick: 80, score: 45 },
      { overallPick: 150, score: 20 },
      { overallPick: 240, score: 35 },
    ];

    const fit = fitDraftSlotBaseline(points);

    expect(fit.b).toBeLessThan(0);
    expect(expectedScore(fit, 5)).toBeGreaterThan(expectedScore(fit, 200));
  });
});

describe('expectedScore', () => {
  const fit = { a: 90, b: -20 };

  it('evaluates a + b·ln(pick)', () => {
    expect(expectedScore(fit, 1)).toBeCloseTo(90, 6); // ln(1) = 0
    expect(expectedScore(fit, Math.E)).toBeCloseTo(70, 6); // ln(e) = 1
  });

  it('clamps to the 0–100 score scale', () => {
    // Steep intercept would put pick 1 above 100 without clamping.
    expect(expectedScore({ a: 130, b: -20 }, 1)).toBe(100);
    // Deep picks could go negative without clamping.
    expect(expectedScore({ a: 20, b: -20 }, 300)).toBe(0);
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

  it('equals the pick score minus the slot expectation', () => {
    const p = pick(64, [season({ snapShare: 0.6 })]);
    const skill = getPlayerDraftSkill(p);
    expect(skill).toBeCloseTo(
      getPlayerDraftScore(p) - expectedScoreForPick(64),
      6,
    );
  });
});
