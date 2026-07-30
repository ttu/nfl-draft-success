import { describe, it, expect } from 'vitest';
import {
  isPlayedSeason,
  isUnplayedSeason,
  playedSeasons,
  latestPlayedSeason,
} from './seasonPlayed';
import { makePick, makeSeason } from '../test/factories';

const unplayed = (year: number, overrides = {}) =>
  makeSeason({
    year,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

describe('isPlayedSeason / isUnplayedSeason', () => {
  it('treats a normal season as played', () => {
    expect(isPlayedSeason(makeSeason({ year: 2025 }))).toBe(true);
    expect(isUnplayedSeason(makeSeason({ year: 2025 }))).toBe(false);
  });

  it('treats a zero-team-games row as unplayed', () => {
    expect(isPlayedSeason(unplayed(2026))).toBe(false);
    expect(isUnplayedSeason(unplayed(2026))).toBe(true);
  });

  it('still counts a season the player missed entirely as played', () => {
    // Injured all year: the season happened, he just was not in it. This must
    // keep scoring as a zero, which is exactly what an unplayed row must not.
    const missedYear = makeSeason({ year: 2025, gamesPlayed: 0, snapShare: 0 });
    expect(isPlayedSeason(missedYear)).toBe(true);
  });
});

describe('playedSeasons', () => {
  it('drops unplayed rows', () => {
    const pick = makePick({
      seasons: [makeSeason({ year: 2024 }), unplayed(2026)],
    });
    expect(playedSeasons(pick).map((s) => s.year)).toEqual([2024]);
  });

  it('returns every season when none are unplayed', () => {
    const pick = makePick({
      seasons: [makeSeason({ year: 2024 }), makeSeason({ year: 2025 })],
    });
    expect(playedSeasons(pick)).toHaveLength(2);
  });
});

describe('latestPlayedSeason', () => {
  it('ignores an unplayed row when picking the newest season', () => {
    const pick = makePick({
      seasons: [makeSeason({ year: 2024 }), unplayed(2026)],
    });
    expect(latestPlayedSeason(pick)?.year).toBe(2024);
  });

  it('is undefined when nothing has been played', () => {
    expect(
      latestPlayedSeason(makePick({ seasons: [unplayed(2026)] })),
    ).toBeUndefined();
    expect(latestPlayedSeason(makePick({ seasons: [] }))).toBeUndefined();
  });
});
