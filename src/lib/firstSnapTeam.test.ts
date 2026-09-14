import { describe, it, expect } from 'vitest';
import { firstSnapTeam, type SnapDataIndex } from './firstSnapTeam';

/** A snap index holding one player, from `season -> primary team` pairs. */
function indexFor(pfrId: string, seasons: [number, string][]): SnapDataIndex {
  return new Map([
    [pfrId, new Map(seasons.map(([s, t]) => [s, { primaryTeam: t }]))],
  ]);
}

describe('firstSnapTeam', () => {
  it('returns null for a player with no snaps at all', () => {
    expect(
      firstSnapTeam('Nobod00', indexFor('Playe00', [[2020, 'DEN']])),
    ).toBeNull();
  });

  it('returns null when every season he appears in is snapless', () => {
    expect(
      firstSnapTeam('Playe00', indexFor('Playe00', [[2020, '']])),
    ).toBeNull();
  });

  it('walks past a snapless season to the first one he actually played', () => {
    expect(
      firstSnapTeam(
        'Playe00',
        indexFor('Playe00', [
          [2020, ''],
          [2021, 'DEN'],
        ]),
      ),
    ).toEqual({ teamId: 'DEN', season: 2021 });
  });

  it('takes the earliest season, however the seasons were inserted', () => {
    // Load order follows the CSV releases, and a Map iterates in insertion
    // order — so the ascending sort is what makes "first" mean earliest.
    expect(
      firstSnapTeam(
        'Playe00',
        indexFor('Playe00', [
          [2022, 'KC'],
          [2019, 'DEN'],
          [2021, 'BUF'],
        ]),
      ),
    ).toEqual({ teamId: 'DEN', season: 2019 });
  });

  it('credits the debut season to one franchise, the one with the most snaps', () => {
    // `primaryTeam` is already the most-snaps team for that season, so a player
    // split across two rosters belongs to the one that actually played him.
    expect(
      firstSnapTeam('Playe00', indexFor('Playe00', [[2021, 'BUF']])),
    ).toEqual({ teamId: 'BUF', season: 2021 });
  });

  it('normalizes a relocated franchise to its modern code', () => {
    expect(
      firstSnapTeam('Playe00', indexFor('Playe00', [[2015, 'SD']])),
    ).toEqual({ teamId: 'LAC', season: 2015 });
    expect(
      firstSnapTeam('Playe00', indexFor('Playe00', [[2018, 'OAK']])),
    ).toEqual({ teamId: 'LV', season: 2018 });
  });
});
