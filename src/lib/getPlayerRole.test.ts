import { describe, it, expect } from 'vitest';
import {
  getPlayerAverageScoreWeight,
  getPlayerDraftScore,
  getPlayerRole,
} from './getPlayerRole';
import type { DraftPick } from '../types';
import { makeDepthSeason, makePick, makeSeason } from '../test/factories';
import { LATEST_SEASON } from './rookieWindow';

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
    // Career mode averages both seasons played.
    expect(getPlayerDraftScore(pick)).toBeCloseTo(
      (seasonScore(0.1, 2, 17) + seasonScore(0.9, 16, 17)) / 2,
    );
    // Drafting-team mode drops the non-retained season from the numerator and
    // divides what is left by the rookie window. The two modes are no longer on
    // a common scale — a windowed score and a plain mean are not comparable —
    // so this asserts values rather than an ordering between them.
    expect(getPlayerDraftScore(pick, { draftingTeamOnly: true })).toBeCloseTo(
      seasonScore(0.9, 16, 17) / 5,
    );
  });

  it('returns 0 for picks with no season rows', () => {
    expect(getPlayerDraftScore(pickWith([]))).toBe(0);
  });

  describe('rookie-contract window (draftingTeamOnly)', () => {
    const opts = { draftingTeamOnly: true } as const;
    const perfect = (year: number) =>
      makeSeason({ year, gamesPlayed: 17, snapShare: 1 });
    /** A pick of `round` drafted `age` seasons before the end of the data. */
    const agedPick = (
      round: number,
      age: number,
      seasons: DraftPick['seasons'],
    ) =>
      makePick({
        round,
        overallPick: round === 1 ? 5 : 150,
        draftYear: LATEST_SEASON - age + 1,
        seasons,
      });

    it('divides a starter traded away mid-window by the full window — the Darnold case', () => {
      // Three perfect seasons, then gone: 300 / 5, not a mean of 100.
      const pick = agedPick(1, 5, [
        perfect(2021),
        perfect(2022),
        perfect(2023),
      ]);
      expect(getPlayerDraftScore(pick, opts)).toBeCloseTo(60);
    });

    it('does not penalise a late-round pick who plays out his four-year deal', () => {
      // The regression guard: 400 / 4 = 100, not 400 / 5 = 80.
      const pick = agedPick(3, 5, [
        perfect(2021),
        perfect(2022),
        perfect(2023),
        perfect(2024),
      ]);
      expect(getPlayerDraftScore(pick, opts)).toBeCloseTo(100);
    });

    it('does not penalise a class whose window has not elapsed yet', () => {
      // Still on the roster one season in — nothing has been missed.
      const pick = agedPick(1, 1, [perfect(LATEST_SEASON)]);
      expect(getPlayerDraftScore(pick, opts)).toBeCloseTo(100);
    });

    it('charges a departed pick the full window rather than elapsed seasons', () => {
      // Gone after one season, two seasons ago. The rest of the window is known
      // to be zero, so it is charged now — and the score stops drifting.
      const gone = agedPick(1, 3, [perfect(LATEST_SEASON - 2)]);
      const longGone = agedPick(1, 6, [perfect(LATEST_SEASON - 5)]);
      expect(getPlayerDraftScore(gone, opts)).toBeCloseTo(20);
      expect(getPlayerDraftScore(gone, opts)).toBeCloseTo(
        getPlayerDraftScore(longGone, opts),
      );
    });

    it('caps a long tenure at the pick’s own seasonal mean', () => {
      const seasons = Array.from({ length: 7 }, (_, i) => perfect(2018 + i));
      expect(getPlayerDraftScore(agedPick(1, 8, seasons), opts)).toBeCloseTo(
        100,
      );
    });

    it('scores a pick with no retained seasons as 0', () => {
      const pick = agedPick(1, 5, [
        makeSeason({ year: 2021, retained: false }),
      ]);
      expect(getPlayerDraftScore(pick, opts)).toBe(0);
    });

    it('leaves the career path on a plain mean over seasons played', () => {
      // draftingTeamOnly false means the numerator spans other teams, so the
      // drafting team's window is not a meaningful denominator.
      const pick = agedPick(1, 5, [perfect(2021), perfect(2022)]);
      expect(getPlayerDraftScore(pick)).toBeCloseTo(100);
    });
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

describe('quarterbacks who sat behind a veteran', () => {
  /**
   * Real career shapes, rounded from the dataset. These are the cases the
   * apprenticeship rule exists to separate, so they are pinned end to end
   * rather than only at `apprenticeSeasonCount`.
   */
  const quarterback = (
    draftYear: number,
    round: number,
    seasons: DraftPick['seasons'],
  ): DraftPick =>
    makePick({ position: 'QB', round, overallPick: 26, draftYear, seasons });

  /** No snaps to speak of, but on the roster. */
  const benched = (year: number) =>
    makeSeason({ year, gamesPlayed: 2, snapShare: 0.03 });

  const startingYear = (year: number) =>
    makeSeason({ year, gamesPlayed: 17, teamGames: 17, snapShare: 0.99 });

  it('scores Jordan Love on the seasons after he won the job', () => {
    // Three years behind Rodgers, then three as QB1. Judged on the whole
    // rookie window he reads 52 — Zach Wilson territory — for a pick that
    // produced a franchise quarterback.
    const love = quarterback(LATEST_SEASON - 5, 1, [
      benched(LATEST_SEASON - 5),
      benched(LATEST_SEASON - 4),
      benched(LATEST_SEASON - 3),
      startingYear(LATEST_SEASON - 2),
      startingYear(LATEST_SEASON - 1),
      startingYear(LATEST_SEASON),
    ]);
    expect(
      getPlayerDraftScore(love, { draftingTeamOnly: true }),
    ).toBeGreaterThan(90);
    expect(getPlayerRole(love, { draftingTeamOnly: true })).toBe(
      'core_starter',
    );
  });

  it('forgives the same seasons in career mode', () => {
    // Career mode has no window, so the bench years are simply absent from the
    // mean. The two toggle states must not disagree about him.
    const love = quarterback(LATEST_SEASON - 4, 1, [
      benched(LATEST_SEASON - 4),
      benched(LATEST_SEASON - 3),
      startingYear(LATEST_SEASON - 2),
      startingYear(LATEST_SEASON - 1),
    ]);
    expect(getPlayerDraftScore(love)).toBeGreaterThan(90);
  });

  it('leaves a quarterback who sat and never took over at the bottom', () => {
    // The Kyle Trask shape: four bench years, no payoff, no forgiveness.
    const trask = quarterback(LATEST_SEASON - 4, 2, [
      benched(LATEST_SEASON - 4),
      benched(LATEST_SEASON - 3),
      benched(LATEST_SEASON - 2),
      benched(LATEST_SEASON - 1),
    ]);
    expect(getPlayerDraftScore(trask, { draftingTeamOnly: true })).toBeLessThan(
      15,
    );
    expect(getPlayerRole(trask, { draftingTeamOnly: true })).toBe(
      'non_contributor',
    );
  });

  it('leaves a quarterback who played real rookie snaps unchanged', () => {
    // The Jalen Hurts shape: a rotation rookie year is not an apprenticeship,
    // and the mean already handles it.
    const hurts = quarterback(LATEST_SEASON - 3, 2, [
      makeSeason({ year: LATEST_SEASON - 3, gamesPlayed: 15, snapShare: 0.45 }),
      startingYear(LATEST_SEASON - 2),
      startingYear(LATEST_SEASON - 1),
      startingYear(LATEST_SEASON),
    ]);
    const scored = getPlayerDraftScore(hurts, { draftingTeamOnly: true });
    expect(scored).toBeGreaterThan(75);
    expect(scored).toBeLessThan(90);
  });

  it('leaves a non-quarterback with the same career shape unchanged', () => {
    // The guard that keeps this from firing on 115 picks: an offensive tackle
    // who was quiet as a rookie and started later is scored as before.
    const tackle = quarterback(LATEST_SEASON - 3, 4, [
      benched(LATEST_SEASON - 3),
      startingYear(LATEST_SEASON - 2),
      startingYear(LATEST_SEASON - 1),
      startingYear(LATEST_SEASON),
    ]);
    tackle.position = 'OT';
    // Four seasons, one of them near zero, divided by the four-year window.
    expect(
      getPlayerDraftScore(tackle, { draftingTeamOnly: true }),
    ).toBeLessThan(80);
  });
});
