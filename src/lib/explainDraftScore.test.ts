import { describe, it, expect } from 'vitest';
import { explainDraftScore } from './explainDraftScore';
import { getSeasonScore } from './getSeasonScore';
import { getPlayerDraftScore } from './getPlayerRole';
import { getPlayerDraftSkill } from './draftSlotBaseline';
import { LATEST_SEASON } from './rookieWindow';
import type { DraftPick, Season } from '../types';
import { makePick, makeSeason } from '../test/factories';

const season = (overrides: Partial<Season> = {}): Season => ({
  year: 2023,
  gamesPlayed: 16,
  teamGames: 17,
  snapShare: 0.9,
  retained: true,
  ...overrides,
});

const pick = (overrides: Partial<DraftPick> = {}): DraftPick => ({
  playerId: 'p1',
  playerName: 'Test Player',
  position: 'ZZ',
  round: 1,
  overallPick: 4,
  teamId: 'IND',
  draftYear: 2023,
  seasons: [season()],
  ...overrides,
});

/** Richardson's real shape: three seasons, first-round, still on the roster. */
const richardson = () =>
  pick({
    position: 'QB',
    seasons: [
      season({
        year: 2023,
        gamesPlayed: 4,
        snapShare: 0.6525,
        cumulativeSnapShare: 0.4842,
        injuryReportWeeks: 2,
        seasonEndingAbsenceGames: 12,
      }),
      season({
        year: 2024,
        gamesPlayed: 11,
        snapShare: 0.9255,
        cumulativeSnapShare: 0.8815,
        injuryReportWeeks: 6,
        seasonEndingAbsenceGames: 2,
      }),
      season({
        year: 2025,
        gamesPlayed: 2,
        snapShare: 0.115,
        cumulativeSnapShare: 0.0444,
        injuryReportWeeks: 3,
        seasonEndingAbsenceGames: 12,
      }),
    ],
  });

const seasonRows = (e: ReturnType<typeof explainDraftScore>) =>
  e!.rows.flatMap((r) => (r.kind === 'season' ? [r] : []));

describe('explainDraftScore', () => {
  // The whole point of this module is to explain a number computed elsewhere.
  // If it re-derives the formula independently it will silently start lying the
  // first time a weight or window rule is tuned, and a wrong explanation is
  // worse than none. These two invariants fail loudly on that drift.
  describe('agrees with the functions it explains', () => {
    it('splits each season score into terms that sum back to it', () => {
      const p = richardson();
      const rows = seasonRows(explainDraftScore(p, true));

      for (const row of rows) {
        const actual = getSeasonScore(
          p.seasons.find((s) => s.year === row.year)!,
          p.position,
        );
        expect(row.snapPoints + row.availabilityPoints).toBeCloseTo(actual, 6);
        expect(row.score).toBeCloseTo(actual, 6);
      }
    });

    it('divides counted season scores into the headline draft score', () => {
      for (const draftingTeamOnly of [true, false]) {
        const p = richardson();
        const e = explainDraftScore(p, draftingTeamOnly)!;
        const counted = seasonRows(e).filter((r) => r.counted);
        const sum = counted.reduce((acc, r) => acc + r.score, 0);

        expect(e.total).toBeCloseTo(sum, 6);
        expect(e.total / e.denominator).toBeCloseTo(e.score, 6);
        expect(e.score).toBeCloseTo(
          getPlayerDraftScore(p, { draftingTeamOnly }),
          6,
        );
      }
    });

    it('reports over slot as the score minus the draft-slot expectation', () => {
      const p = richardson();
      const e = explainDraftScore(p, true)!;

      expect(e.score - e.expectedAtSlot).toBeCloseTo(e.overSlot, 6);
      expect(e.overSlot).toBeCloseTo(
        getPlayerDraftSkill(p, { draftingTeamOnly: true }),
        6,
      );
    });
  });

  describe('denominator', () => {
    it('clamps a first-rounder to seasons elapsed while still on the roster', () => {
      // Drafted 2023, latest season 2025 → 3 elapsed, below the 5-year window.
      const e = explainDraftScore(richardson(), true)!;

      expect(e.denominator).toBe(3);
      expect(e.usesRookieWindow).toBe(true);
      expect(e.windowLength).toBe(5);
    });

    it('charges the full window once the pick has departed', () => {
      const p = pick({
        round: 3,
        overallPick: 80,
        seasons: [
          season({ year: 2023 }),
          season({ year: 2024, retained: false, currentTeam: 'SEA' }),
          season({ year: 2025, retained: false, currentTeam: 'SEA' }),
        ],
      });
      const e = explainDraftScore(p, true)!;

      // Rounds 2-7 get four years, and departure charges all of them now.
      expect(e.denominator).toBe(4);
      expect(e.windowLength).toBe(4);
    });

    it('counts seasons played, not the window, in career mode', () => {
      const e = explainDraftScore(richardson(), false)!;

      expect(e.denominator).toBe(3);
      expect(e.usesRookieWindow).toBe(false);
      expect(e.windowLength).toBeUndefined();
    });
  });

  describe('rows', () => {
    it('marks seasons played elsewhere as not counted in drafting-team mode', () => {
      const p = pick({
        seasons: [
          season({ year: 2023 }),
          season({ year: 2024, retained: false, currentTeam: 'SEA' }),
        ],
      });
      const rows = seasonRows(explainDraftScore(p, true)!);

      expect(rows.map((r) => r.counted)).toEqual([true, false]);
      expect(rows[1].currentTeam).toBe('SEA');
    });

    it('drops seasons played elsewhere after the window closed', () => {
      // Jahlani Tavai's shape: two years with the drafting team, then five
      // elsewhere. Only the window years belong in a panel about this division.
      const p = pick({
        round: 2,
        overallPick: 43,
        seasons: [
          season({ year: 2023 }),
          season({ year: 2024 }),
          season({ year: 2025, retained: false, currentTeam: 'NE' }),
        ],
      });
      const e = explainDraftScore(p, true)!;

      // Window is 2023-2026; 2025 is inside it, so it stays as the reason the
      // divisor is 4 rather than 2.
      expect(e.rows.map((r) => r.year)).toEqual([2023, 2024, 2025, 2026]);
      expect(e.denominator).toBe(4);
      expect(e.rows).toHaveLength(e.denominator);
    });

    it('keeps a counted season even if it falls outside the window', () => {
      // Long tenures are capped by the window, but a season that fed the
      // numerator must stay visible or the sum stops resolving.
      const p = pick({
        round: 3,
        overallPick: 80,
        seasons: [
          season({ year: 2019 }),
          season({ year: 2020 }),
          season({ year: 2021 }),
          season({ year: 2022 }),
          season({ year: 2023 }),
        ],
        draftYear: 2019,
      });
      const e = explainDraftScore(p, true)!;
      const counted = seasonRows(e).filter((r) => r.counted);

      expect(counted).toHaveLength(5);
      expect(e.total).toBeCloseTo(
        counted.reduce((acc, r) => acc + r.score, 0),
        6,
      );
    });

    it('counts every season played in career mode', () => {
      const p = pick({
        seasons: [
          season({ year: 2023 }),
          season({ year: 2024, retained: false, currentTeam: 'SEA' }),
        ],
      });
      const rows = seasonRows(explainDraftScore(p, false)!);

      expect(rows.every((r) => r.counted)).toBe(true);
    });

    it('renders unplayed window years as gap rows in chronological place', () => {
      const p = pick({
        round: 3,
        overallPick: 80,
        seasons: [season({ year: 2023 }), season({ year: 2025 })],
      });
      const e = explainDraftScore(p, true)!;

      // Still on the roster, so the window clamps to the three seasons that
      // have elapsed rather than charging all four up front.
      expect(e.rows.map((r) => [r.kind, r.year])).toEqual([
        ['season', 2023],
        ['gap', 2024],
        ['season', 2025],
      ]);
    });

    it('adds no gap rows in career mode, where the window is not the denominator', () => {
      const p = pick({
        round: 3,
        overallPick: 80,
        seasons: [season({ year: 2023 }), season({ year: 2025 })],
      });
      const e = explainDraftScore(p, false)!;

      expect(e.rows.every((r) => r.kind === 'season')).toBe(true);
    });

    it('leaves an upcoming season out entirely', () => {
      const p = pick({
        seasons: [
          season({ year: 2023 }),
          // teamGames 0 marks a season nobody has played yet.
          season({ year: LATEST_SEASON + 1, gamesPlayed: 0, teamGames: 0 }),
        ],
      });
      const e = explainDraftScore(p, true)!;

      expect(e.rows.some((r) => r.year === LATEST_SEASON + 1)).toBe(false);
    });
  });

  describe('position bar', () => {
    it('reports the divisor a normalized position is measured against', () => {
      const rows = seasonRows(explainDraftScore(richardson(), true)!);

      expect(rows[0].baselineExempt).toBe(false);
      expect(rows[0].positionBaseline).toBeCloseTo(0.99, 3);
      expect(rows[0].normalizedShare).toBeCloseTo(
        rows[0].rawShare / rows[0].positionBaseline,
        6,
      );
    });

    it('marks specialists exempt and leaves their share unscaled', () => {
      const p = pick({ position: 'K', seasons: [season({ snapShare: 0.12 })] });
      const rows = seasonRows(explainDraftScore(p, true)!);

      expect(rows[0].baselineExempt).toBe(true);
      expect(rows[0].positionBaseline).toBe(1);
      expect(rows[0].normalizedShare).toBeCloseTo(rows[0].rawShare, 6);
    });

    it('clamps a share above the position bar to a full-time workload', () => {
      const p = pick({
        position: 'RB',
        seasons: [season({ snapShare: 0.99, cumulativeSnapShare: 0.99 })],
      });
      const rows = seasonRows(explainDraftScore(p, true)!);

      // RB's bar is ~0.653, so 0.99 divides past 1 and must clamp.
      expect(rows[0].normalizedShare).toBe(1);
    });
  });

  describe('injury adjustment', () => {
    it('excuses the larger of the two signals, never their sum', () => {
      const rows = seasonRows(explainDraftScore(richardson(), true)!);
      const y2023 = rows.find((r) => r.year === 2023)!;

      // max(2 report weeks, 12 games after last snap) = 12, not 14.
      expect(y2023.injury).toEqual({
        injuryReportWeeks: 2,
        seasonEndingAbsenceGames: 12,
        excusedGames: 12,
        loadDenominatorGames: 5,
      });
    });

    it('caps excused games at the games actually missed', () => {
      const p = pick({
        seasons: [
          season({
            gamesPlayed: 15,
            teamGames: 17,
            injuryReportWeeks: 9,
          }),
        ],
      });
      const rows = seasonRows(explainDraftScore(p, true)!);

      // Only two games were missed, so nine report weeks cannot excuse nine.
      expect(rows[0].injury?.excusedGames).toBe(2);
      expect(rows[0].injury?.loadDenominatorGames).toBe(15);
    });

    it('omits the adjustment for a season with no snaps to forgive', () => {
      const p = pick({
        seasons: [
          season({ gamesPlayed: 0, snapShare: 0, injuryReportWeeks: 1 }),
        ],
      });
      const rows = seasonRows(explainDraftScore(p, true)!);

      // Load is 0 against any denominator, so there is no adjustment to claim.
      expect(rows[0].injury).toBeUndefined();
    });

    it('omits the adjustment for a season that carries no injury signal', () => {
      const rows = seasonRows(explainDraftScore(pick(), true)!);

      expect(rows[0].injury).toBeUndefined();
    });

    it('omits the adjustment when the signals excuse nothing', () => {
      const p = pick({
        seasons: [
          season({ gamesPlayed: 17, teamGames: 17, injuryReportWeeks: 3 }),
        ],
      });
      const rows = seasonRows(explainDraftScore(p, true)!);

      // He missed no games, so there is nothing to excuse and no claim to make.
      expect(rows[0].injury).toBeUndefined();
    });
  });

  it('returns null for a pick with no played seasons to explain', () => {
    const p = pick({ seasons: [] });

    expect(explainDraftScore(p, true)).toBeNull();
  });

  it('returns null when drafting-team mode leaves nothing counted', () => {
    const p = pick({
      seasons: [season({ year: 2023, retained: false, currentTeam: 'SEA' })],
    });

    expect(explainDraftScore(p, true)).toBeNull();
  });
});

describe('a quarterback who sat behind a veteran', () => {
  /** The Jordan Love shape. */
  const love = makePick({
    position: 'QB',
    round: 1,
    overallPick: 26,
    teamId: 'GB',
    draftYear: 2020,
    seasons: [
      makeSeason({ year: 2020, gamesPlayed: 1, snapShare: 0.01 }),
      makeSeason({ year: 2021, gamesPlayed: 2, snapShare: 0.06 }),
      makeSeason({ year: 2022, gamesPlayed: 2, snapShare: 0.03 }),
      makeSeason({
        year: 2023,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 0.99,
      }),
      makeSeason({
        year: 2024,
        gamesPlayed: 15,
        teamGames: 17,
        snapShare: 0.97,
      }),
    ],
  });

  it('marks the bench years as apprentice rows, not seasons', () => {
    const explained = explainDraftScore(love, true);
    const kinds = explained!.rows.map((r) => `${r.year}:${r.kind}`);
    expect(kinds).toEqual([
      '2020:apprentice',
      '2021:apprentice',
      '2022:apprentice',
      '2023:season',
      '2024:season',
    ]);
  });

  it('keeps them out of the total', () => {
    const explained = explainDraftScore(love, true)!;
    const counted = explained.rows.filter(
      (r) => r.kind === 'season' && r.counted,
    );
    expect(counted).toHaveLength(2);
    expect(explained.apprenticeSeasons).toBe(3);
  });

  it('reports the shortened window, not the contract length', () => {
    // 5 − 3 bench years. Saying "5-season window" beside a divisor of 2 would
    // send the reader hunting for three seasons that are not there.
    expect(explainDraftScore(love, true)!.windowLength).toBe(2);
  });

  it('still reconciles with the headline score', () => {
    const explained = explainDraftScore(love, true)!;
    expect(explained.total / explained.denominator).toBeCloseTo(
      getPlayerDraftScore(love, { draftingTeamOnly: true }),
    );
  });
});

describe('explainDraftScore rested finale', () => {
  it('marks a season whose finale the team rested through', () => {
    const explanation = explainDraftScore(
      pick({
        seasons: [
          season({
            gamesPlayed: 19,
            teamGames: 19,
            restGame: {
              playerGames: 0,
              playerShareSum: 0,
              playerSnaps: 0,
              teamSnaps: 100,
            },
          }),
        ],
      }),
      true,
    );

    const row = explanation!.rows[0];
    expect(row.kind).toBe('season');
    expect(row.kind === 'season' && row.restedFinale).toBe(true);
  });

  it('leaves an ordinary season unmarked', () => {
    const explanation = explainDraftScore(pick(), true)!;

    const row = explanation.rows[0];
    expect(row.kind === 'season' && row.restedFinale).toBe(false);
  });
});
