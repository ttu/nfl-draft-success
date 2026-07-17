import { describe, it, expect } from 'vitest';
import { snapShareForRoleTier } from './snapShareForTier';
import { getPositionBaseline } from './positionBaseline';
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

/** Position-adjusted expectation: raw tier share divided by its baseline. */
function normalized(raw: number, position: string): number {
  return Math.min(raw / getPositionBaseline(position), 1);
}

describe('snapShareForRoleTier', () => {
  it('uses cumulativeSnapShare when set, then position-adjusts it', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.6, cumulativeSnapShare: 0.12 }),
        'WR',
      ),
    ).toBeCloseTo(normalized(0.12, 'WR'), 10);
  });

  it('falls back to snapShare when cumulative is absent, then adjusts', () => {
    expect(
      snapShareForRoleTier(baseSeason({ snapShare: 0.55 }), 'WR'),
    ).toBeCloseTo(normalized(0.55, 'WR'), 10);
  });

  it('caps load at average snap before adjusting when cumulative exceeds it', () => {
    // Raw tier input is capped at 0.81 (avg), then divided by the WR baseline.
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.81, cumulativeSnapShare: 0.826 }),
        'WR',
      ),
    ).toBeCloseTo(normalized(0.81, 'WR'), 10);
  });

  it('rescales a full-time RB workload up to ~1.0', () => {
    // A running back at his position baseline is a full-time starter.
    const rbBaseline = getPositionBaseline('RB');
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: rbBaseline, cumulativeSnapShare: rbBaseline }),
        'RB',
      ),
    ).toBeCloseTo(1, 10);
  });

  it('leaves interior OL essentially unchanged (baseline ~1.0)', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.65, cumulativeSnapShare: 0.65 }),
        'C',
      ),
    ).toBeCloseTo(0.65, 2);
  });

  it('does not position-adjust kickers/punters/LS', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.4, cumulativeSnapShare: 0.094 }),
        'K',
      ),
    ).toBe(0.4);
  });

  it('caps kicker tier input at avg snap without rescaling', () => {
    expect(
      snapShareForRoleTier(
        baseSeason({ snapShare: 0.81, cumulativeSnapShare: 0.826 }),
        'K',
      ),
    ).toBe(0.81);
  });

  it('does not position-adjust unknown positions', () => {
    expect(snapShareForRoleTier(baseSeason({ snapShare: 0.55 }), 'ZZ')).toBe(
      0.55,
    );
  });
});
