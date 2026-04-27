import { describe, it, expect } from 'vitest';
import { getRollingDraftScore } from './getRollingDraftScore';
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

describe('getRollingDraftScore', () => {
  it('score = sum(per-pick average seasonal weights) / total picks', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023), depthPick(2023)];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.totalPicks).toBe(2);
    expect(result.scoredPickCount).toBe(2);
    expect(result.score).toBeCloseTo((4 + 1) / 2);
  });

  it('computes coreStarterRate and retentionRate', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023)];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.scoredPickCount).toBe(1);
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

    const career = getRollingDraftScore([draft], 'KC');
    const draftingOnly = getRollingDraftScore([draft], 'KC', {
      draftingTeamOnly: true,
    });

    expect(career.scoredPickCount).toBe(1);
    expect(draftingOnly.scoredPickCount).toBe(1);
    expect(career.score).toBeGreaterThan(draftingOnly.score);
    expect(draftingOnly.score).toBe(0);
  });

  it('aggregates across multiple draft years', () => {
    const drafts: DraftClass[] = [
      coreStarterPick(2020),
      coreStarterPick(2021),
      depthPick(2022),
    ];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.totalPicks).toBe(3);
    expect(result.scoredPickCount).toBe(3);
    expect(result.score).toBeCloseTo((4 + 4 + 1) / 3);
  });

  it('ignores picks with no season rows for score and scoredPickCount', () => {
    const drafts: DraftClass[] = [
      coreStarterPick(2023),
      {
        year: 2026,
        picks: [
          {
            playerId: 'rook',
            playerName: 'Rookie',
            position: 'WR',
            round: 1,
            overallPick: 1,
            teamId: 'KC',
            seasons: [],
          },
        ],
      },
    ];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.totalPicks).toBe(2);
    expect(result.scoredPickCount).toBe(1);
    expect(result.score).toBeCloseTo(4);
  });

  it('counts picks with only non-retained seasons when draftingTeamOnly (weight can be zero)', () => {
    const draft: DraftClass = {
      year: 2021,
      picks: [
        {
          playerId: 'gone',
          playerName: 'Traded out',
          position: 'DE',
          round: 4,
          overallPick: 134,
          teamId: 'MIN',
          seasons: [
            {
              year: 2021,
              gamesPlayed: 5,
              teamGames: 17,
              snapShare: 0.1,
              retained: false,
              currentTeam: 'CAR',
            },
          ],
        },
      ],
    };
    const result = getRollingDraftScore([draft], 'MIN', {
      draftingTeamOnly: true,
    });
    expect(result.totalPicks).toBe(1);
    expect(result.scoredPickCount).toBe(1);
    expect(result.score).toBe(0);
  });
});
