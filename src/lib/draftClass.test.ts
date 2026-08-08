import { describe, it, expect } from 'vitest';
import type { DraftPick } from '../types';
import { stampDraftYear, type RawDraftClass } from './draftClass';

/** A raw pick as it arrives from `draft-{year}.json` — no `draftYear` yet. */
const rawPick = (playerId: string): Omit<DraftPick, 'draftYear'> => ({
  playerId,
  playerName: playerId,
  position: 'WR',
  round: 1,
  overallPick: 1,
  teamId: 'KC',
  seasons: [],
});

const rawClass = (year: number, ids: string[]): RawDraftClass => ({
  year,
  picks: ids.map(rawPick),
});

describe('stampDraftYear', () => {
  it('stamps every pick with the class year', () => {
    const cls = stampDraftYear(rawClass(2019, ['a', 'b', 'c']));

    expect(cls.picks.map((p) => p.draftYear)).toEqual([2019, 2019, 2019]);
  });

  it('returns the same class object so callers can stamp in place', () => {
    const cls = rawClass(2021, ['a']);

    expect(stampDraftYear(cls)).toBe(cls);
  });

  it('handles a class with no picks', () => {
    expect(stampDraftYear(rawClass(2025, [])).picks).toEqual([]);
  });

  it('overwrites a stale draftYear rather than trusting the payload', () => {
    const cls = rawClass(2020, ['a']);
    (cls.picks[0] as DraftPick).draftYear = 1999;

    expect(stampDraftYear(cls).picks[0].draftYear).toBe(2020);
  });
});

describe('stampDraftYear rest games', () => {
  /** A pick whose team rested him through its clinched finale. */
  const restedPick = (): Omit<DraftPick, 'draftYear'> => ({
    ...rawPick('rested'),
    seasons: [
      {
        year: 2023,
        gamesPlayed: 19,
        teamGames: 20,
        snapShare: 0.9,
        cumulativeSnapShare: 0.5,
        loadDenominator: 2000,
        retained: true,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 100,
        },
      },
    ],
  });

  it('subtracts the rest game on ingest, so no consumer has to remember', () => {
    const cls = stampDraftYear({ year: 2022, picks: [restedPick()] });

    const season = cls.picks[0].seasons[0];
    expect(season.teamGames).toBe(19);
    expect(season.gamesPlayed).toBe(19);
    expect(season.cumulativeSnapShare).toBeCloseTo(1000 / 1900, 10);
  });

  it('leaves seasons without a rest game untouched', () => {
    const cls = stampDraftYear({
      year: 2022,
      picks: [
        {
          ...rawPick('normal'),
          seasons: [
            {
              year: 2023,
              gamesPlayed: 17,
              teamGames: 17,
              snapShare: 0.8,
              retained: true,
            },
          ],
        },
      ],
    });

    expect(cls.picks[0].seasons[0].teamGames).toBe(17);
  });
});
