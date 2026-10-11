import { describe, it, expect } from 'vitest';
import {
  getLatestSeasonForPick,
  isDraftPickRetainedLatest,
  isDraftPickRetainedForRoster,
} from './draftPickLatestSeason';
import { makePick, makeSeason } from '../test/factories';

/**
 * `departed` adds the roster snapshot row — the unplayed row saying where the
 * player stands today. Left off entirely, the pick is on no roster at all.
 */
const pickWithSeasons = (
  seasons: Array<{ year: number; retained: boolean }>,
  departed?: boolean,
) =>
  makePick({
    playerId: 'x',
    playerName: 'X',
    position: 'QB',
    seasons: [
      ...seasons.map(({ year, retained }) =>
        makeSeason({ year, gamesPlayed: 1, snapShare: 0.5, retained }),
      ),
      ...(departed === undefined
        ? []
        : [
            makeSeason({
              year: 2027,
              gamesPlayed: 0,
              teamGames: 0,
              snapShare: 0,
              retained: !departed,
            }),
          ]),
    ],
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

  it('isDraftPickRetainedLatest reads the roster snapshot', () => {
    expect(isDraftPickRetainedLatest(pickWithSeasons([]))).toBe(false);
    expect(
      isDraftPickRetainedLatest(
        pickWithSeasons([{ year: 2024, retained: true }], false),
      ),
    ).toBe(true);
    expect(
      isDraftPickRetainedLatest(
        pickWithSeasons([{ year: 2024, retained: true }], true),
      ),
    ).toBe(false);
  });

  it('isDraftPickRetainedLatest reads a last played season as no evidence', () => {
    // He finished 2024 with the drafting team and is on nobody's roster now.
    // The row says what was true that season, not what is true today.
    expect(
      isDraftPickRetainedLatest(
        pickWithSeasons([{ year: 2024, retained: true }]),
      ),
    ).toBe(false);
  });

  it('isDraftPickRetainedForRoster treats no seasons as still on roster', () => {
    expect(isDraftPickRetainedForRoster(pickWithSeasons([]))).toBe(true);
    expect(
      isDraftPickRetainedForRoster(
        pickWithSeasons([{ year: 2024, retained: true }], true),
      ),
    ).toBe(false);
  });
});
