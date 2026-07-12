import { describe, it, expect } from 'vitest';
import { getRollingDraftScore } from './getRollingDraftScore';
import type { DraftClass } from '../types';

// Continuous per-season score used by the snap-based formula:
// clamp(0.7·snapShare + 0.3·availability, 0, 1) × 100.
const seasonScore = (snap: number, gp: number, tg: number) =>
  (0.7 * snap + 0.3 * (gp / tg)) * 100;
const CORE_PICK = seasonScore(0.9, 16, 17); // ~91.2
const DEPTH_PICK = seasonScore(0.15, 3, 17); // ~15.8

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

const nonRetainedCorePick = (year: number): DraftClass => ({
  year,
  picks: [
    {
      playerId: 'p3',
      playerName: 'Left in FA',
      position: 'QB',
      round: 1,
      overallPick: 8,
      teamId: 'KC',
      seasons: [
        {
          year,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.9,
          retained: false,
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
  it('score = mean(per-pick snap score)', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023), depthPick(2023)];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.totalPicks).toBe(2);
    expect(result.scoredPickCount).toBe(2);
    expect(result.score).toBeCloseTo((CORE_PICK + DEPTH_PICK) / 2);
  });

  it('does not scale the score down for un-retained picks (retention is reported, not multiplied in)', () => {
    const drafts: DraftClass[] = [
      coreStarterPick(2022),
      nonRetainedCorePick(2023),
    ];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.scoredPickCount).toBe(2);
    // Only one of two picks retained.
    expect(result.retentionRate).toBeCloseTo(0.5);
    // Both picks post identical snap scores; retention (0.5) must NOT halve it.
    expect(result.score).toBeCloseTo(CORE_PICK);
  });

  it('computes coreStarterRate and retentionRate', () => {
    const drafts: DraftClass[] = [coreStarterPick(2023)];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.scoredPickCount).toBe(1);
    expect(result.coreStarterRate).toBe(1);
    expect(result.retentionRate).toBe(1);
  });

  it('uses drafting-team-only when option is true', () => {
    // Barely played elsewhere before becoming a star with the drafting team;
    // still on the roster in the latest season (retention 1). draftingTeamOnly
    // drops the low non-retained season, raising the pick score.
    const draft: DraftClass = {
      year: 2021,
      picks: [
        {
          playerId: 'p1',
          playerName: 'Mixed tenure',
          position: 'WR',
          round: 5,
          overallPick: 150,
          teamId: 'KC',
          seasons: [
            {
              year: 2021,
              gamesPlayed: 2,
              teamGames: 17,
              snapShare: 0.05,
              retained: false,
            },
            {
              year: 2022,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.9,
              retained: true,
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
    // Both retain (latest season retained), so retention doesn't differ; the
    // score gap is entirely from excluding the low non-drafting-team season.
    expect(draftingOnly.score).toBeGreaterThan(career.score);
    expect(draftingOnly.score).toBeCloseTo(CORE_PICK);
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
    // All retained → retention 1.
    expect(result.score).toBeCloseTo((CORE_PICK + CORE_PICK + DEPTH_PICK) / 3);
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
    expect(result.score).toBeCloseTo(CORE_PICK);
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
