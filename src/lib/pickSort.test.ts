import { describe, it, expect } from 'vitest';
import {
  sortPicksByOverall,
  allPicksAwaitingSeasonData,
  shouldHidePositionYearBanner,
} from './pickSort';
import type { DraftPick } from '../types';

const pick = (
  overallPick: number,
  seasons: DraftPick['seasons'] = [],
): DraftPick => ({
  playerId: `p${overallPick}`,
  playerName: 'X',
  position: 'WR',
  round: 1,
  overallPick,
  teamId: 'KC',
  seasons,
});

describe('sortPicksByOverall', () => {
  it('sorts ascending by overall pick', () => {
    const sorted = sortPicksByOverall([pick(5), pick(1), pick(3)]);
    expect(sorted.map((p) => p.overallPick)).toEqual([1, 3, 5]);
  });
  it('does not mutate the input array', () => {
    const input = [pick(5), pick(1)];
    sortPicksByOverall(input);
    expect(input.map((p) => p.overallPick)).toEqual([5, 1]);
  });
});

describe('allPicksAwaitingSeasonData', () => {
  it('returns true for empty array', () => {
    expect(allPicksAwaitingSeasonData([])).toBe(true);
  });
  it('returns true when no picks have seasons', () => {
    expect(allPicksAwaitingSeasonData([pick(1), pick(2)])).toBe(true);
  });
  it('returns false if any pick has a season', () => {
    expect(
      allPicksAwaitingSeasonData([
        pick(1),
        pick(2, [
          {
            year: 2023,
            gamesPlayed: 1,
            teamGames: 17,
            snapShare: 0.1,
            retained: true,
          },
        ]),
      ]),
    ).toBe(false);
  });
});

describe('shouldHidePositionYearBanner', () => {
  it('hides banner for a single-year range with a single matching group', () => {
    expect(
      shouldHidePositionYearBanner({
        yearFrom: 2023,
        yearTo: 2023,
        groupCount: 1,
        groupYear: 2023,
      }),
    ).toBe(true);
  });
  it('keeps banner for multi-year range', () => {
    expect(
      shouldHidePositionYearBanner({
        yearFrom: 2020,
        yearTo: 2023,
        groupCount: 1,
        groupYear: 2023,
      }),
    ).toBe(false);
  });
  it('keeps banner when multiple groups exist', () => {
    expect(
      shouldHidePositionYearBanner({
        yearFrom: 2023,
        yearTo: 2023,
        groupCount: 2,
        groupYear: 2023,
      }),
    ).toBe(false);
  });
});
