import { describe, it, expect } from 'vitest';
import type { DraftClass } from '../types';
import {
  collectDraftPositions,
  filterPicksByPosition,
  groupPicksByDraftYear,
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
