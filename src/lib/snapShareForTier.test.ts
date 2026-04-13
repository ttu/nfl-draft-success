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
  it('uses cumulativeSnapShare when set (non-specialists)', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.6, cumulativeSnapShare: 0.12 }),
        'WR',
      ),
    ).toBe(0.12);
  });

  it('uses avg snap share for kickers/punters/LS when cumulative load understates role', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.4, cumulativeSnapShare: 0.094 }),
        'K',
      ),
    ).toBe(0.4);
  });

  it('falls back to snapShare when cumulative is absent', () => {
    expect(snapShareForRoleTier(baseSeason({ snapShare: 0.55 }), 'WR')).toBe(
      0.55,
    );
  });

  it('caps load at average snap when cumulative would exceed it', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.81, cumulativeSnapShare: 0.826 }),
        'WR',
      ),
    ).toBe(0.81);
  });

  it('caps kicker tier input when cumulative would exceed avg snap', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.81, cumulativeSnapShare: 0.826 }),
        'K',
      ),
    ).toBe(0.81);
  });
});
