import { describe, it, expect } from 'vitest';
import {
  getLatestSeasonForPick,
  isDraftPickRetainedLatest,
  isDraftPickRetainedForRoster,
} from './draftPickLatestSeason';

function pickWithSeasons(seasons: Array<{ year: number; retained: boolean }>) {
  return {
    playerId: 'x',
    playerName: 'X',
    position: 'QB',
    round: 1,
    overallPick: 1,
    teamId: 'KC',
    seasons: seasons.map((s) => ({
      year: s.year,
      gamesPlayed: 1,
      teamGames: 17,
      snapShare: 0.5,
      retained: s.retained,
    })),
  };
}

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
