import { describe, it, expect } from 'vitest';
import { snapShareForRoleTier } from './snapShareForTier';
import type { Season } from '../types';

function baseSeason(over: Partial<Season> = {}): Season {
  return {
    year: 2023,
    gamesPlayed: 10,
    teamGames: 17,
    snapShare: 0.5,
    retained: true,
    ...over,
  };
}

describe('snapShareForRoleTier', () => {
  it('uses cumulativeSnapShare when set', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.6, cumulativeSnapShare: 0.12 }),
      ),
    ).toBe(0.12);
  });

  it('falls back to snapShare when cumulative is absent', () => {
    expect(snapShareForRoleTier(baseSeason({ snapShare: 0.55 }))).toBe(0.55);
  });

  it('caps load at average snap when cumulative would exceed it', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.81, cumulativeSnapShare: 0.826 }),
      ),
    ).toBe(0.81);
  });
});
