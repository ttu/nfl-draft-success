import { describe, it, expect } from 'vitest';
import { hasNoScoredPicks } from './rollingScoreDisplay';

describe('hasNoScoredPicks', () => {
  it('returns true when total > 0 and scored = 0', () => {
    expect(hasNoScoredPicks(5, 0)).toBe(true);
  });
  it('returns false when total is 0', () => {
    expect(hasNoScoredPicks(0, 0)).toBe(false);
  });
  it('returns false when at least one pick is scored', () => {
    expect(hasNoScoredPicks(5, 1)).toBe(false);
  });
});
