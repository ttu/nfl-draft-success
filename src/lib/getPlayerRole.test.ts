import { describe, it, expect } from 'vitest';
import {
  getPlayerAverageScoreWeight,
  getPlayerDraftScore,
  getPlayerRole,
} from './getPlayerRole';
import type { DraftPick } from '../types';

describe('getPlayerRole', () => {
  it('uses average seasonal value: mixed depth and core starter years → significant contributor', () => {
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
    expect(getPlayerAverageScoreWeight(pick)).toBeCloseTo(2.5);
    expect(getPlayerRole(pick)).toBe('significant_contributor');
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

  it('uses only drafting-team seasons when draftingTeamOnly is true', () => {
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
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.72,
          retained: false,
        },
        {
          year: 2023,
          gamesPlayed: 3,
          teamGames: 17,
          snapShare: 0.15,
          retained: true,
        },
      ],
    };
    expect(getPlayerRole(pick)).toBe('significant_contributor');
    expect(getPlayerRole(pick, { draftingTeamOnly: true })).toBe('depth');
  });

  it('pulls down representative role when a strong year is averaged with an inactive season', () => {
    const pick: DraftPick = {
      playerId: 'p1',
      playerName: 'Nicholas Petit-Frere',
      position: 'T',
      round: 3,
      overallPick: 69,
      teamId: 'TEN',
      seasons: [
        {
          year: 2022,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.97,
          retained: true,
        },
        {
          year: 2024,
          gamesPlayed: 15,
          teamGames: 17,
          snapShare: 0.68,
          retained: true,
        },
        {
          year: 2025,
          gamesPlayed: 0,
          teamGames: 17,
          snapShare: 0,
          retained: true,
        },
      ],
    };
    expect(getPlayerAverageScoreWeight(pick)).toBeCloseTo(8 / 3);
    expect(getPlayerRole(pick)).toBe('significant_contributor');
  });

  it('classifies full-time kickers by avg snap share, not tiny cumulative load', () => {
    const pick: DraftPick = {
      playerId: 'ReicWi00',
      playerName: 'Will Reichard',
      position: 'K',
      round: 6,
      overallPick: 203,
      teamId: 'MIN',
      seasons: [
        {
          year: 2024,
          gamesPlayed: 14,
          teamGames: 18,
          snapShare: 0.4,
          cumulativeSnapShare: 0.094,
          retained: true,
          injuryReportWeeks: 1,
        },
        {
          year: 2025,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.346,
          cumulativeSnapShare: 0.109,
          retained: true,
        },
      ],
    };
    expect(getPlayerRole(pick)).toBe('significant_contributor');
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

const seasonScore = (snap: number, gp: number, tg: number) =>
  (0.7 * snap + 0.3 * (gp / tg)) * 100;

function pickWith(seasons: DraftPick['seasons']): DraftPick {
  return {
    playerId: 'p',
    playerName: 'Player',
    position: 'QB',
    round: 1,
    overallPick: 5,
    teamId: 'KC',
    seasons,
  };
}

describe('getPlayerDraftScore', () => {
  it('does not saturate: two core starters are separated by real usage', () => {
    const fullTime = pickWith([
      {
        year: 2021,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 1,
        retained: true,
      },
      {
        year: 2022,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 1,
        retained: true,
      },
    ]);
    const heavyButNotMax = pickWith([
      {
        year: 2021,
        gamesPlayed: 14,
        teamGames: 17,
        snapShare: 0.7,
        retained: true,
      },
      {
        year: 2022,
        gamesPlayed: 14,
        teamGames: 17,
        snapShare: 0.7,
        retained: true,
      },
    ]);
    // Both classify as core_starter (would both be 100 under the old formula)…
    expect(getPlayerRole(fullTime)).toBe('core_starter');
    expect(getPlayerRole(heavyButNotMax)).toBe('core_starter');
    // …but the snap-based score separates them.
    expect(getPlayerDraftScore(fullTime)).toBeCloseTo(100);
    expect(getPlayerDraftScore(fullTime)).toBeGreaterThan(
      getPlayerDraftScore(heavyButNotMax),
    );
  });

  it('reflects snap share and availability on a 0–100 scale', () => {
    const pick = pickWith([
      {
        year: 2023,
        gamesPlayed: 8,
        teamGames: 17,
        snapShare: 0.5,
        retained: true,
      },
    ]);
    expect(getPlayerDraftScore(pick)).toBeCloseTo(seasonScore(0.5, 8, 17));
  });

  it('draftingTeamOnly excludes non-retained seasons', () => {
    const pick = pickWith([
      {
        year: 2021,
        gamesPlayed: 2,
        teamGames: 17,
        snapShare: 0.1,
        retained: false,
      },
      {
        year: 2022,
        gamesPlayed: 16,
        teamGames: 17,
        snapShare: 0.9,
        retained: true,
      },
    ]);
    const full = getPlayerDraftScore(pick);
    const draftingOnly = getPlayerDraftScore(pick, { draftingTeamOnly: true });
    expect(draftingOnly).toBeGreaterThan(full);
    expect(draftingOnly).toBeCloseTo(seasonScore(0.9, 16, 17));
  });

  it('returns 0 for picks with no season rows', () => {
    expect(getPlayerDraftScore(pickWith([]))).toBe(0);
  });
});
