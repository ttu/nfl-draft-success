import { describe, it, expect } from 'vitest';
import type { DraftClass } from '../types';
import { makeDraftClass, makePick } from '../test/factories';
import {
  collectDraftPositions,
  filterPicksByPosition,
  groupPicksByDraftYear,
  resolveCanonicalPosition,
} from './positionDraft';

const dc2020: DraftClass = makeDraftClass({
  year: 2020,
  picks: [
    makePick({ playerName: 'A', position: 'QB', teamId: 'CIN' }),
    makePick({
      playerName: 'B',
      position: 'de',
      round: 2,
      overallPick: 33,
      teamId: 'WAS',
    }),
  ],
});

const dc2021: DraftClass = makeDraftClass({
  year: 2021,
  picks: [makePick({ playerName: 'C', position: 'QB', overallPick: 5 })],
});

describe('collectDraftPositions', () => {
  it('returns sorted unique positions with stable casing from first occurrence', () => {
    expect(collectDraftPositions([])).toEqual([]);
    expect(collectDraftPositions([dc2020])).toEqual(['DE', 'QB']);
    expect(collectDraftPositions([dc2021, dc2020])).toEqual(['DE', 'QB']);
  });

  it('merges T and OT into one OT entry via normalizeDraftPosition', () => {
    const otPick = makePick({
      playerName: 'OT',
      position: 'OT',
      teamId: 'DAL',
    });
    const tPick = makePick({
      playerName: 'T',
      position: 'T',
      round: 2,
      overallPick: 40,
      teamId: 'GB',
    });
    const dc = makeDraftClass({ year: 2024, picks: [otPick, tPick] });
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
    const tPick = makePick({
      playerName: 'Lineman',
      position: 'T',
      overallPick: 10,
      teamId: 'NYG',
    });
    const dc = makeDraftClass({ year: 2019, picks: [tPick] });
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
