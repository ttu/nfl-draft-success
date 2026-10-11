import { describe, it, expect } from 'vitest';
import { isSeasonComplete } from './seasonInProgress';

const games = {
  '2025': { max: 21, byTeam: { MIN: 17, KC: 21 } },
  '2026': { max: 5, byTeam: { MIN: 4, KC: 5 } },
};

describe('isSeasonComplete', () => {
  it('is true once every team has played a full regular season', () => {
    expect(isSeasonComplete(2025, games)).toBe(true);
  });

  it('is false while the season is still being played', () => {
    expect(isSeasonComplete(2026, games)).toBe(false);
  });

  it('is false for a season the table has never heard of', () => {
    // Nothing has been played, so nothing is complete.
    expect(isSeasonComplete(2027, games)).toBe(false);
  });

  it('counts the 16-game era as complete', () => {
    expect(
      isSeasonComplete(2019, { '2019': { max: 16, byTeam: { MIN: 16 } } }),
    ).toBe(true);
  });
});
