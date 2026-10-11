import { describe, it, expect } from 'vitest';
import { hasCompletedSeason, isSeasonComplete } from './seasonInProgress';
import type { Acquisition } from '../types';

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

describe('hasCompletedSeason', () => {
  const pick = (seasons: { year: number; teamGames: number }[]) =>
    ({
      seasons: seasons.map((s) => ({
        ...s,
        gamesPlayed: 1,
        snapShare: 0.5,
        cumulativeSnapShare: 0.5,
        retained: true,
      })),
    }) as Acquisition;

  it('is true for a player who has played out a season', () => {
    expect(
      hasCompletedSeason(pick([{ year: 2025, teamGames: 17 }]), games),
    ).toBe(true);
  });

  it('is false when every season he has played is still being played', () => {
    // A class four weeks into its first season has produced no evidence that
    // has finished arriving.
    expect(
      hasCompletedSeason(pick([{ year: 2026, teamGames: 4 }]), games),
    ).toBe(false);
  });

  it('ignores the unplayed roster-snapshot row', () => {
    expect(
      hasCompletedSeason(pick([{ year: 2027, teamGames: 0 }]), games),
    ).toBe(false);
  });
});
