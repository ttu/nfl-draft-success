import { describe, it, expect } from 'vitest';
import type { DraftPick, Season } from '../types';

describe('DraftPick type', () => {
  it('has required string playerId', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [],
    };
    expect(typeof pick.playerId).toBe('string');
  });

  it('has seasons array', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [
        {
          year: 2023,
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.72,
          retained: true,
        },
      ],
    };
    expect(pick.seasons).toHaveLength(1);
    expect(pick.seasons[0].snapShare).toBe(0.72);
  });
});

describe('Season type', () => {
  it('has numeric year, gamesPlayed, teamGames, snapShare', () => {
    const season: Season = {
      year: 2023,
      gamesPlayed: 10,
      teamGames: 17,
      snapShare: 0.5,
      retained: true,
    };
    expect(typeof season.year).toBe('number');
    expect(typeof season.gamesPlayed).toBe('number');
    expect(typeof season.snapShare).toBe('number');
  });
});
