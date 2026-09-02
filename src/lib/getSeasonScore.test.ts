import { describe, it, expect } from 'vitest';
import { getSeasonScore } from './getSeasonScore';
import { getPositionBaseline } from './positionBaseline';
import { classifyRole } from './classifyRole';
import { snapShareForRoleTier } from './snapShareForTier';
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

  it('scores a forgiven IR season on what he did when fit', () => {
    // Derwin James 2019: 11 weeks on IR, back for the last 5 at a 0.992 share.
    //
    // This pins the spec's headline arithmetic — 79.4 and `starter_when_healthy`
    // — downstream of forgiveness, and nothing more. `getSeasonScore` reads
    // `cumulativeSnapShare`; it never reads `reserveWeeks`, so the field below
    // is documentation of where that 0.992 came from, not an input. The test
    // would pass identically with the whole feature reverted. The behavioural
    // coverage — that reserve weeks are what lift the load share in the first
    // place — lives in `teamSeasonDenominator.test.ts`.
    const jamesInjured2019 = {
      year: 2019,
      gamesPlayed: 5,
      teamGames: 16,
      snapShare: 0.992,
      cumulativeSnapShare: 0.992,
      retained: true,
      reserveWeeks: 11,
    };
    expect(getSeasonScore(jamesInjured2019, 'S')).toBeCloseTo(79.4, 0);
    expect(
      classifyRole(snapShareForRoleTier(jamesInjured2019, 'S'), 5 / 16, 'S'),
    ).toBe('starter_when_healthy');
  });

  it('still scores a wholly missed reserve season 0.0', () => {
    // The other half of the spec's headline regression: James 2020, the year he
    // missed entirely. Forgiveness reopens the ratio for a player who played
    // *some* football; it never invents production for one who played none.
    // The team lost the season regardless of who was to blame, and the score
    // says so — deliberate, not an oversight.
    const jamesLost2020 = {
      year: 2020,
      gamesPlayed: 0,
      teamGames: 16,
      snapShare: 0,
      cumulativeSnapShare: 0,
      retained: true,
      reserveWeeks: 16,
    };
    expect(getSeasonScore(jamesLost2020, 'S')).toBeCloseTo(0, 5);
  });
});
