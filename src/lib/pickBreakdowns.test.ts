import { describe, it, expect } from 'vitest';
import { getUnitBreakdown, getPositionBreakdown } from './pickBreakdowns';
import type { DraftPick } from '../types';

function pick(position: string, overallPick = 1): DraftPick {
  return {
    playerId: `p-${position}-${overallPick}`,
    playerName: `Player ${overallPick}`,
    position,
    round: 1,
    overallPick,
    teamId: 'BUF',
    seasons: [],
  };
}

describe('getUnitBreakdown', () => {
  it('always returns the three units in offense/defense/special-teams order', () => {
    const rows = getUnitBreakdown([]);
    expect(rows.map((r) => r.unit)).toEqual([
      'offense',
      'defense',
      'special_teams',
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      'Offense',
      'Defense',
      'Special teams',
    ]);
    expect(rows.map((r) => r.count)).toEqual([0, 0, 0]);
  });

  it('counts picks into their units', () => {
    const rows = getUnitBreakdown([
      pick('WR', 1),
      pick('OT', 2),
      pick('CB', 3),
      pick('EDGE', 4),
      pick('P', 5),
    ]);
    expect(rows.find((r) => r.unit === 'offense')?.count).toBe(2);
    expect(rows.find((r) => r.unit === 'defense')?.count).toBe(2);
    expect(rows.find((r) => r.unit === 'special_teams')?.count).toBe(1);
  });
});

describe('getPositionBreakdown', () => {
  it('returns an empty list for no picks', () => {
    expect(getPositionBreakdown([])).toEqual([]);
  });

  it('counts picks per canonical position, normalizing aliases', () => {
    const rows = getPositionBreakdown([
      pick('WR', 1),
      pick('wr', 2),
      pick('T', 3), // alias -> OT
      pick('OT', 4),
    ]);
    expect(rows).toEqual([
      { position: 'OT', count: 2 },
      { position: 'WR', count: 2 },
    ]);
  });

  it('sorts by count descending, then position ascending', () => {
    const rows = getPositionBreakdown([
      pick('CB', 1),
      pick('CB', 2),
      pick('CB', 3),
      pick('WR', 4),
      pick('WR', 5),
      pick('S', 6),
    ]);
    expect(rows).toEqual([
      { position: 'CB', count: 3 },
      { position: 'WR', count: 2 },
      { position: 'S', count: 1 },
    ]);
  });

  it('ignores blank positions', () => {
    expect(getPositionBreakdown([pick('  ', 1), pick('WR', 2)])).toEqual([
      { position: 'WR', count: 1 },
    ]);
  });
});
