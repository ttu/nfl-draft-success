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
