import { describe, it, expect } from 'vitest';
import { getRollingDraftScore } from './getRollingDraftScore';
import { expectedScoreForPick } from './draftSlotBaseline';
import type { DraftClass } from '../types';
import {
  makeDepthSeason,
  makeDraftClass,
  makePick,
  makeSeason,
} from '../test/factories';

// Fixtures use the factory default position `ZZ` (baseline 1.0) so these
// aggregation tests are unaffected by position-adjusted snap scoring, which is
// covered in snapShareForTier.test.ts and getSeasonScore.test.ts.
//
// Continuous per-season score used by the snap-based formula:
// clamp(0.7·snapShare + 0.3·availability, 0, 1) × 100.
const seasonScore = (snap: number, gp: number, tg: number) =>
  (0.7 * snap + 0.3 * (gp / tg)) * 100;
const CORE_PICK = seasonScore(0.9, 16, 17); // ~91.2
const DEPTH_PICK = seasonScore(0.15, 3, 17); // ~15.8

const coreStarterPick = (year: number): DraftClass =>
  makeDraftClass({
    year,
    picks: [
      makePick({
        playerName: 'Starter',
        overallPick: 5,
        seasons: [makeSeason({ year })],
      }),
    ],
  });

const nonRetainedCorePick = (year: number): DraftClass =>
  makeDraftClass({
    year,
    picks: [
      makePick({
        playerName: 'Left in FA',
        overallPick: 8,
        seasons: [makeSeason({ year, retained: false })],
      }),
    ],
  });

const depthPick = (year: number): DraftClass =>
  makeDraftClass({
    year,
    picks: [
      makePick({
        playerName: 'Depth',
        round: 5,
        overallPick: 150,
        seasons: [makeDepthSeason({ year })],
      }),
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

  it('skillScore = mean pick score above the draft-slot expectation', () => {
    // coreStarterPick is overall #5, depthPick is overall #150.
    const drafts: DraftClass[] = [coreStarterPick(2023), depthPick(2023)];
    const result = getRollingDraftScore(drafts, 'KC');
    const meanExpected =
      (expectedScoreForPick(5) + expectedScoreForPick(150)) / 2;
    expect(result.skillScore).toBeCloseTo(result.score - meanExpected);
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
    const draft = makeDraftClass({
      year: 2021,
      picks: [
        makePick({
          playerName: 'Mixed tenure',
          round: 5,
          overallPick: 150,
          seasons: [
            makeSeason({
              year: 2021,
              gamesPlayed: 2,
              snapShare: 0.05,
              retained: false,
            }),
            makeSeason({ year: 2022 }),
          ],
        }),
      ],
    });

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
      makeDraftClass({
        year: 2026,
        picks: [makePick({ playerId: 'rook', playerName: 'Rookie' })],
      }),
    ];
    const result = getRollingDraftScore(drafts, 'KC');
    expect(result.totalPicks).toBe(2);
    expect(result.scoredPickCount).toBe(1);
    expect(result.score).toBeCloseTo(CORE_PICK);
  });

  it('counts picks with only non-retained seasons when draftingTeamOnly (weight can be zero)', () => {
    const draft = makeDraftClass({
      year: 2021,
      picks: [
        makePick({
          playerId: 'gone',
          playerName: 'Traded out',
          round: 4,
          overallPick: 134,
          teamId: 'MIN',
          seasons: [
            makeSeason({
              year: 2021,
              gamesPlayed: 5,
              snapShare: 0.1,
              retained: false,
              currentTeam: 'CAR',
            }),
          ],
        }),
      ],
    });
    const result = getRollingDraftScore([draft], 'MIN', {
      draftingTeamOnly: true,
    });
    expect(result.totalPicks).toBe(1);
    expect(result.scoredPickCount).toBe(1);
    expect(result.score).toBe(0);
  });
});
