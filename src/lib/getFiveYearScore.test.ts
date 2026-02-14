import { describe, it, expect } from 'vitest';
import { getFiveYearScore } from './getFiveYearScore';
import type { DraftClass } from '../types';

const coreStarterPick = (year: number): DraftClass => ({
  year,
  picks: [
    {
      playerId: 'p1',
      playerName: 'Starter',
      position: 'QB',
      round: 1,
      overallPick: 5,
      teamId: 'KC',
      seasons: [
        {
          year,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.9,
          retained: true,
        },
      ],
    },
  ],
});

const depthPick = (year: number): DraftClass => ({
  year,
  picks: [
    {
      playerId: 'p2',
      playerName: 'Depth',
      position: 'WR',
      round: 5,
      overallPick: 150,
      teamId: 'KC',
      seasons: [
        {
          year,
          gamesPlayed: 3,
          teamGames: 17,
          snapShare: 0.15,
          retained: true,
        },
      ],
    },
  ],
});

describe('getFiveYearScore', () => {
  it('score = sum(weights) / total picks', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023), depthPick(2023)];
    const result = getFiveYearScore(drafts, 'KC');
    expect(result.totalPicks).toBe(2);
    expect(result.score).toBeCloseTo((3 + 1) / 2);
  });

  it('computes coreStarterRate and retentionRate', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023)];
    const result = getFiveYearScore(drafts, 'KC');
    expect(result.coreStarterRate).toBe(1);
    expect(result.retentionRate).toBe(1);
  });

  it('uses drafting-team-only when option is true', () => {
    const draft: DraftClass = {
      year: 2022,
      picks: [
        {
          playerId: 'p1',
          playerName: 'Late bloomer',
          position: 'WR',
          round: 5,
          overallPick: 150,
          teamId: 'KC',
          seasons: [
            {
              year: 2022,
              gamesPlayed: 1,
              teamGames: 17,
              snapShare: 0.02,
              retained: true,
            },
            {
              year: 2024,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.8,
              retained: false,
            },
          ],
        },
      ],
    };

    const career = getFiveYearScore([draft], 'KC');
    const draftingOnly = getFiveYearScore([draft], 'KC', {
      draftingTeamOnly: true,
    });

    expect(career.score).toBeGreaterThan(draftingOnly.score);
    expect(draftingOnly.score).toBe(0);
  });

  it('aggregates across multiple draft years', () => {
    const drafts: DraftClass[] = [
      coreStarterPick(2020),
      coreStarterPick(2021),
      depthPick(2022),
    ];
    const result = getFiveYearScore(drafts, 'KC');
    expect(result.totalPicks).toBe(3);
    expect(result.score).toBeCloseTo((3 + 3 + 1) / 3);
  });
});
