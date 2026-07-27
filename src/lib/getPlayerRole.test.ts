import { describe, it, expect } from 'vitest';
import {
  getPlayerAverageScoreWeight,
  getPlayerDraftScore,
  getPlayerRole,
} from './getPlayerRole';
import type { DraftPick } from '../types';
import { makeDepthSeason, makePick, makeSeason } from '../test/factories';

/** The receiver these role tests classify, minus his career. */
const receiver = (seasons: DraftPick['seasons']): DraftPick =>
  makePick({ playerName: 'Test', position: 'WR', overallPick: 5, seasons });

describe('getPlayerRole', () => {
  it('uses average seasonal value: mixed depth and core starter years → significant contributor', () => {
    const pick = receiver([
      makeSeason({
        year: 2021,
        gamesPlayed: 2,
        snapShare: 0.1,
        retained: false,
      }),
      makeSeason({ year: 2023, gamesPlayed: 15, snapShare: 0.72 }),
    ]);
    expect(getPlayerAverageScoreWeight(pick)).toBeCloseTo(2.5);
    expect(getPlayerRole(pick)).toBe('significant_contributor');
  });

  it('returns non_contributor when no seasons', () => {
    expect(getPlayerRole(receiver([]))).toBe('non_contributor');
  });

  it('handles ongoing season when teamGames < 17', () => {
    const pick = receiver([
      makeSeason({
        year: 2025,
        gamesPlayed: 3,
        teamGames: 5,
        snapShare: 0.7,
      }),
    ]);
    expect(getPlayerRole(pick)).toBe('core_starter');
  });

  it('uses only drafting-team seasons when draftingTeamOnly is true', () => {
    const pick = receiver([
      makeSeason({
        year: 2021,
        gamesPlayed: 15,
        snapShare: 0.72,
        retained: false,
      }),
      makeDepthSeason({ year: 2023 }),
    ]);
    expect(getPlayerRole(pick)).toBe('significant_contributor');
    expect(getPlayerRole(pick, { draftingTeamOnly: true })).toBe('depth');
  });

  it('pulls down representative role when a strong year is averaged with an inactive season', () => {
    const pick = makePick({
      playerName: 'Nicholas Petit-Frere',
      position: 'T',
      round: 3,
      overallPick: 69,
      teamId: 'TEN',
      seasons: [
        makeSeason({ year: 2022, snapShare: 0.97 }),
        makeSeason({ year: 2024, gamesPlayed: 15, snapShare: 0.68 }),
        makeSeason({ year: 2025, gamesPlayed: 0, snapShare: 0 }),
      ],
    });
    expect(getPlayerAverageScoreWeight(pick)).toBeCloseTo(8 / 3);
    expect(getPlayerRole(pick)).toBe('significant_contributor');
  });

  it('classifies full-time kickers by avg snap share, not tiny cumulative load', () => {
    const pick = makePick({
      playerId: 'ReicWi00',
      playerName: 'Will Reichard',
      position: 'K',
      round: 6,
      overallPick: 203,
      teamId: 'MIN',
      seasons: [
        makeSeason({
          year: 2024,
          gamesPlayed: 14,
          teamGames: 18,
          snapShare: 0.4,
          cumulativeSnapShare: 0.094,
          injuryReportWeeks: 1,
        }),
        makeSeason({
          year: 2025,
          gamesPlayed: 17,
          snapShare: 0.346,
          cumulativeSnapShare: 0.109,
        }),
      ],
    });
    expect(getPlayerRole(pick)).toBe('significant_contributor');
  });

  it('returns depth when best season is depth', () => {
    const pick = makePick({
      playerName: 'Test',
      position: 'WR',
      round: 5,
      overallPick: 150,
      seasons: [makeDepthSeason()],
    });
    expect(getPlayerRole(pick)).toBe('depth');
  });
});

const seasonScore = (snap: number, gp: number, tg: number) =>
  (0.7 * snap + 0.3 * (gp / tg)) * 100;

// The factory's default position `ZZ` is unknown → baseline 1.0, so these tests
// exercise the draft-score formula without position adjustment.
// Position-adjustment behaviour is covered in snapShareForTier.test.ts and
// getSeasonScore.test.ts.
const pickWith = (seasons: DraftPick['seasons']): DraftPick =>
  makePick({ overallPick: 5, seasons });

describe('getPlayerDraftScore', () => {
  it('does not saturate: two core starters are separated by real usage', () => {
    const fullTime = pickWith([
      makeSeason({ year: 2021, gamesPlayed: 17, snapShare: 1 }),
      makeSeason({ year: 2022, gamesPlayed: 17, snapShare: 1 }),
    ]);
    const heavyButNotMax = pickWith([
      makeSeason({ year: 2021, gamesPlayed: 14, snapShare: 0.7 }),
      makeSeason({ year: 2022, gamesPlayed: 14, snapShare: 0.7 }),
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
    const pick = pickWith([makeSeason({ gamesPlayed: 8, snapShare: 0.5 })]);
    expect(getPlayerDraftScore(pick)).toBeCloseTo(seasonScore(0.5, 8, 17));
  });

  it('draftingTeamOnly excludes non-retained seasons', () => {
    const pick = pickWith([
      makeSeason({
        year: 2021,
        gamesPlayed: 2,
        snapShare: 0.1,
        retained: false,
      }),
      makeSeason({ year: 2022 }),
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

/**
 * Score and role are memoized per pick. These pin the behaviour a memo can
 * plausibly break: results must not leak between `draftingTeamOnly` settings,
 * between distinct picks, or change when a call is repeated.
 */
describe('repeated evaluation', () => {
  /** Weak drafting-team season, strong season elsewhere — the two settings differ. */
  const splitCareer = () =>
    pickWith([
      makeSeason({ year: 2021 }),
      makeSeason({
        year: 2022,
        gamesPlayed: 1,
        snapShare: 0.05,
        retained: false,
      }),
    ]);

  it('keeps the two draftingTeamOnly settings independent, whichever is asked first', () => {
    const a = splitCareer();
    const drafting = getPlayerDraftScore(a, { draftingTeamOnly: true });
    const full = getPlayerDraftScore(a, { draftingTeamOnly: false });

    // Same pick, opposite call order: the second reading must not serve the first.
    const b = splitCareer();
    const fullFirst = getPlayerDraftScore(b, { draftingTeamOnly: false });
    const draftingSecond = getPlayerDraftScore(b, { draftingTeamOnly: true });

    expect(drafting).not.toBeCloseTo(full);
    expect(fullFirst).toBeCloseTo(full);
    expect(draftingSecond).toBeCloseTo(drafting);
  });

  it('does not confuse two picks that share a player id but differ in data', () => {
    const weak = pickWith([makeSeason({ gamesPlayed: 1, snapShare: 0.05 })]);
    const strong = pickWith([makeSeason({ gamesPlayed: 17, snapShare: 1 })]);

    expect(getPlayerDraftScore(weak)).toBeLessThan(getPlayerDraftScore(strong));
    expect(getPlayerRole(weak)).toBe('non_contributor');
    expect(getPlayerRole(strong)).toBe('core_starter');
  });

  it('returns a stable answer across repeated calls', () => {
    const pick = splitCareer();
    const scores = [0, 1, 2].map(() =>
      getPlayerDraftScore(pick, { draftingTeamOnly: true }),
    );
    const roles = [0, 1, 2].map(() =>
      getPlayerRole(pick, { draftingTeamOnly: true }),
    );

    expect(new Set(scores).size).toBe(1);
    expect(new Set(roles).size).toBe(1);
  });
});
