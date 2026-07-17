import { describe, it, expect } from 'vitest';
import { getSeasonScore } from './getSeasonScore';
import { getPositionBaseline } from './positionBaseline';
import type { Season } from '../types';

const season = (overrides: Partial<Season> = {}): Season => ({
  year: 2023,
  gamesPlayed: 16,
  teamGames: 17,
  snapShare: 0.9,
  retained: true,
  ...overrides,
});

// `ZZ` is an unknown position → baseline 1.0, so these tests exercise the
// 0.7/0.3 formula in isolation without any position adjustment.
describe('getSeasonScore', () => {
  it('combines snap share (0.7) and availability (0.3) on a 0–100 scale', () => {
    // 0.7·0.9 + 0.3·(16/17) = 0.63 + 0.2824 ≈ 0.9124 → ~91.2
    expect(getSeasonScore(season(), 'ZZ')).toBeCloseTo(91.24, 1);
  });

  it('returns 0 when there is neither snap share nor games played', () => {
    expect(getSeasonScore(season({ snapShare: 0, gamesPlayed: 0 }), 'ZZ')).toBe(
      0,
    );
  });

  it('treats a zero-game team season as zero availability without dividing by zero', () => {
    const score = getSeasonScore(
      season({ snapShare: 0.5, gamesPlayed: 0, teamGames: 0 }),
      'ZZ',
    );
    // 0.7·0.5 + 0.3·0 = 0.35 → 35
    expect(score).toBeCloseTo(35, 5);
  });

  it('clamps snap share above 1 so the score never exceeds 100', () => {
    const score = getSeasonScore(
      season({ snapShare: 1.5, gamesPlayed: 17, teamGames: 17 }),
      'ZZ',
    );
    expect(score).toBe(100);
  });

  it('position-adjusts the snap term: a full-time RB scores like a full-time OL', () => {
    // A RB at his position baseline plays a full-time role; his snap term
    // should normalize to ~1.0 rather than being penalized for rotating.
    const rbBaseline = getPositionBaseline('RB');
    const score = getSeasonScore(
      season({
        snapShare: rbBaseline,
        cumulativeSnapShare: rbBaseline,
        gamesPlayed: 17,
        teamGames: 17,
      }),
      'RB',
    );
    expect(score).toBe(100);
  });
});
