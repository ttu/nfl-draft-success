import { describe, it, expect } from 'vitest';
import type { DraftClass, DraftPick } from '../types';
import { getPicksByTeam, getTeamPicks } from './picksByTeam';

const pick = (playerId: string, teamId: string): DraftPick => ({
  playerId,
  playerName: playerId,
  position: 'WR',
  round: 1,
  overallPick: 1,
  teamId,
  seasons: [],
});

const draftClass = (year: number, picks: DraftPick[]): DraftClass => ({
  year,
  picks,
});

describe('getPicksByTeam', () => {
  it('groups a class by drafting team, preserving pick order', () => {
    const cls = draftClass(2023, [
      pick('a', 'KC'),
      pick('b', 'DAL'),
      pick('c', 'KC'),
    ]);

    const grouped = getPicksByTeam(cls);

    expect(grouped.get('KC')?.map((p) => p.playerId)).toEqual(['a', 'c']);
    expect(grouped.get('DAL')?.map((p) => p.playerId)).toEqual(['b']);
  });

  it('has no entry for a team with no picks in the class', () => {
    const cls = draftClass(2023, [pick('a', 'KC')]);

    expect(getPicksByTeam(cls).get('DAL')).toBeUndefined();
  });

  it('handles an empty class', () => {
    expect(getPicksByTeam(draftClass(2023, [])).size).toBe(0);
  });

  it('keeps two classes independent', () => {
    const a = draftClass(2023, [pick('a', 'KC')]);
    const b = draftClass(2024, [pick('b', 'KC'), pick('c', 'KC')]);

    expect(getPicksByTeam(a).get('KC')).toHaveLength(1);
    expect(getPicksByTeam(b).get('KC')).toHaveLength(2);
    // Re-reading the first must not serve the second's grouping.
    expect(getPicksByTeam(a).get('KC')).toHaveLength(1);
  });
});

describe('getTeamPicks', () => {
  it("collects one team's picks across classes, in class order", () => {
    const classes = [
      draftClass(2023, [pick('a', 'KC'), pick('b', 'DAL')]),
      draftClass(2024, [pick('c', 'DAL'), pick('d', 'KC')]),
    ];

    expect(getTeamPicks(classes, 'KC').map((p) => p.playerId)).toEqual([
      'a',
      'd',
    ]);
    expect(getTeamPicks(classes, 'DAL').map((p) => p.playerId)).toEqual([
      'b',
      'c',
    ]);
  });

  it('returns an empty list for a team that drafted nobody', () => {
    const classes = [draftClass(2023, [pick('a', 'KC')])];

    expect(getTeamPicks(classes, 'NE')).toEqual([]);
  });

  it('returns a fresh array the caller may not use to corrupt the cache', () => {
    const classes = [draftClass(2023, [pick('a', 'KC')])];

    getTeamPicks(classes, 'KC').push(pick('injected', 'KC'));

    expect(getTeamPicks(classes, 'KC').map((p) => p.playerId)).toEqual(['a']);
  });
});
