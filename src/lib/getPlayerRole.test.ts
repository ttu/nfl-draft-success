import { describe, it, expect } from 'vitest';
import { getPlayerRole } from './getPlayerRole';
import type { DraftPick } from '../types';

describe('getPlayerRole', () => {
  it('returns highest role across seasons', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [
        {
          year: 2021,
          gamesPlayed: 2,
          teamGames: 17,
          snapShare: 0.1,
          retained: false,
        },
        {
          year: 2023,
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.72,
          retained: true,
        },
      ],
    };
    expect(getPlayerRole(pick)).toBe('core_starter');
  });

  it('returns non_contributor when no seasons', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [],
    };
    expect(getPlayerRole(pick)).toBe('non_contributor');
  });

  it('handles ongoing season when teamGames < 17', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [
        {
          year: 2025,
          gamesPlayed: 3,
          teamGames: 5,
          snapShare: 0.7,
          retained: true,
        },
      ],
    };
    expect(getPlayerRole(pick)).toBe('core_starter');
  });

  it('returns depth when best season is depth', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Test',
      position: 'WR',
      round: 5,
      overallPick: 150,
      teamId: 'KC',
      seasons: [
        {
          year: 2023,
          gamesPlayed: 3,
          teamGames: 17,
          snapShare: 0.15,
          retained: true,
        },
      ],
    };
    expect(getPlayerRole(pick)).toBe('depth');
  });
});
