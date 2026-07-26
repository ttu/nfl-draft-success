import { describe, it, expect } from 'vitest';
import {
  BUST_EXCLUSIONS,
  BUST_EXCLUSION_REASONS,
  isBustExcluded,
} from './bustExclusions';

describe('isBustExcluded', () => {
  it('excludes a listed player', () => {
    expect(isBustExcluded(BUST_EXCLUSIONS[0].playerId)).toBe(true);
  });

  it('does not exclude an unlisted player', () => {
    expect(isBustExcluded('NotARealId00')).toBe(false);
  });

  it('does not exclude on an empty id', () => {
    expect(isBustExcluded('')).toBe(false);
  });
});

describe('BUST_EXCLUSIONS', () => {
  it('carries a known reason and a human-readable detail for every entry', () => {
    for (const entry of BUST_EXCLUSIONS) {
      expect(BUST_EXCLUSION_REASONS).toContain(entry.reason);
      expect(entry.detail.length).toBeGreaterThan(0);
      expect(entry.playerName.length).toBeGreaterThan(0);
    }
  });

  it('lists each player at most once', () => {
    const ids = BUST_EXCLUSIONS.map((e) => e.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
