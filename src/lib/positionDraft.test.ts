import { describe, it, expect } from 'vitest';
import type { DraftClass } from '../types';
import {
  collectDraftPositions,
  filterPicksByPosition,
  groupPicksByDraftYear,
  resolveCanonicalPosition,
} from './positionDraft';

const dc2020: DraftClass = {
  year: 2020,
  picks: [
    {
      playerId: 'a',
      playerName: 'A',
      position: 'QB',
      round: 1,
      overallPick: 1,
      teamId: 'CIN',
      seasons: [],
    },
    {
      playerId: 'b',
      playerName: 'B',
      position: 'de',
      round: 2,
      overallPick: 33,
      teamId: 'WAS',
      seasons: [],
    },
  ],
};

const dc2021: DraftClass = {
  year: 2021,
  picks: [
    {
      playerId: 'c',
      playerName: 'C',
      position: 'QB',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [],
    },
  ],
};

describe('collectDraftPositions', () => {
  it('returns sorted unique positions with stable casing from first occurrence', () => {
    expect(collectDraftPositions([])).toEqual([]);
    expect(collectDraftPositions([dc2020])).toEqual(['DE', 'QB']);
    expect(collectDraftPositions([dc2021, dc2020])).toEqual(['DE', 'QB']);
  });

  it('merges T and OT into one OT entry via normalizeDraftPosition', () => {
    const otPick = {
      playerId: 'ot',
      playerName: 'OT',
      position: 'OT',
      round: 1,
      overallPick: 1,
      teamId: 'DAL',
      seasons: [],
    };
    const tPick = {
      playerId: 't',
      playerName: 'T',
      position: 'T',
      round: 2,
      overallPick: 40,
      teamId: 'GB',
      seasons: [],
    };
    const dc: DraftClass = {
      year: 2024,
      picks: [otPick, tPick],
    };
    expect(collectDraftPositions([dc])).toEqual(['OT']);
  });
});

describe('filterPicksByPosition', () => {
  it('matches case-insensitively and sorts by year then overall pick', () => {
    expect(filterPicksByPosition([dc2020, dc2021], 'qb')).toEqual([
      { pick: dc2020.picks[0], draftYear: 2020 },
      { pick: dc2021.picks[0], draftYear: 2021 },
    ]);
  });

  it('returns empty when no match', () => {
    expect(filterPicksByPosition([dc2020], 'WR')).toEqual([]);
  });

  it('matches T when filtering by OT and vice versa', () => {
    const tPick = {
      playerId: 't',
      playerName: 'Lineman',
      position: 'T',
      round: 1,
      overallPick: 10,
      teamId: 'NYG',
      seasons: [],
    };
    const dc: DraftClass = { year: 2019, picks: [tPick] };
    expect(filterPicksByPosition([dc], 'OT')).toEqual([
      { pick: tPick, draftYear: 2019 },
    ]);
    expect(filterPicksByPosition([dc], 't')).toEqual([
      { pick: tPick, draftYear: 2019 },
    ]);
  });
});

describe('resolveCanonicalPosition', () => {
  it('resolves T to OT when OT is in the option list', () => {
    expect(resolveCanonicalPosition(['QB', 'OT'], 't')).toBe('OT');
    expect(resolveCanonicalPosition(['QB', 'OT'], 'OT')).toBe('OT');
  });
});

describe('groupPicksByDraftYear', () => {
  it('groups in ascending year order', () => {
    const flat = filterPicksByPosition([dc2020, dc2021], 'QB');
    expect(groupPicksByDraftYear(flat)).toEqual([
      { year: 2020, picks: [{ pick: dc2020.picks[0], draftYear: 2020 }] },
      { year: 2021, picks: [{ pick: dc2021.picks[0], draftYear: 2021 }] },
    ]);
  });
});
