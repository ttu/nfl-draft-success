import { describe, it, expect } from 'vitest';
import {
  getLatestSeasonForPick,
  isDraftPickRetainedLatest,
  isDraftPickRetainedForRoster,
} from './draftPickLatestSeason';
import { makePick, makeSeason } from '../test/factories';

const pickWithSeasons = (seasons: Array<{ year: number; retained: boolean }>) =>
  makePick({
    playerId: 'x',
    playerName: 'X',
    position: 'QB',
    seasons: seasons.map(({ year, retained }) =>
      makeSeason({ year, gamesPlayed: 1, snapShare: 0.5, retained }),
    ),
  });

describe('draftPickLatestSeason', () => {
  it('getLatestSeasonForPick returns highest year', () => {
    const pick = pickWithSeasons([
      { year: 2023, retained: true },
      { year: 2025, retained: false },
      { year: 2024, retained: true },
    ]);
    expect(getLatestSeasonForPick(pick)?.year).toBe(2025);
  });

  it('getLatestSeasonForPick is undefined when no seasons', () => {
    expect(getLatestSeasonForPick(pickWithSeasons([]))).toBeUndefined();
  });

  it('isDraftPickRetainedLatest follows latest season row', () => {
    expect(isDraftPickRetainedLatest(pickWithSeasons([]))).toBe(false);
    expect(
      isDraftPickRetainedLatest(
        pickWithSeasons([
          { year: 2023, retained: true },
          { year: 2024, retained: false },
        ]),
      ),
    ).toBe(false);
    expect(
      isDraftPickRetainedLatest(
        pickWithSeasons([{ year: 2024, retained: true }]),
      ),
    ).toBe(true);
  });

  it('isDraftPickRetainedForRoster treats no seasons as still on roster', () => {
    expect(isDraftPickRetainedForRoster(pickWithSeasons([]))).toBe(true);
    expect(
      isDraftPickRetainedForRoster(
        pickWithSeasons([{ year: 2024, retained: false }]),
      ),
    ).toBe(false);
  });
});
