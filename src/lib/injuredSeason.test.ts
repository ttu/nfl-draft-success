import { describe, expect, it } from 'vitest';
import { isInjuredOutSeason } from './injuredSeason';
import type { Season } from '../types';

const season = (o: Partial<Season>): Season => ({
  year: 2020,
  gamesPlayed: 0,
  teamGames: 16,
  snapShare: 0,
  retained: true,
  ...o,
});

describe('isInjuredOutSeason', () => {
  it('is true for a season on reserve with no games played', () => {
    expect(isInjuredOutSeason(season({ reserveWeeks: 16 }))).toBe(true);
  });

  it('is true for a partial stint that still yielded no games', () => {
    // Two weeks on IR and then released. He played nothing either way, and the
    // label claims nothing about how the year ended. Accepted deliberately —
    // the alternative is a tolerance constant with no principled value.
    expect(isInjuredOutSeason(season({ reserveWeeks: 2 }))).toBe(true);
  });

  it('is false once he played at all', () => {
    expect(
      isInjuredOutSeason(season({ reserveWeeks: 11, gamesPlayed: 5 })),
    ).toBe(false);
  });

  it('is false for an upcoming season with no games to miss', () => {
    expect(isInjuredOutSeason(season({ teamGames: 0, reserveWeeks: 0 }))).toBe(
      false,
    );
  });

  it('is false for legacy JSON with no reserveWeeks', () => {
    expect(isInjuredOutSeason(season({}))).toBe(false);
  });
});
