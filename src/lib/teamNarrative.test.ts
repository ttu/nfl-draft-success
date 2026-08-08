import { describe, expect, it } from 'vitest';
import {
  buildTeamNarrative,
  CAPITAL_BANDS,
  CORE_BANDS,
  RETENTION_BANDS,
  TRAJECTORY_BANDS,
  type TeamNarrativeInput,
} from './teamNarrative';
import type { YearScore } from './getScoreByYear';

/**
 * The league range each threshold has to sit inside to be reachable, measured
 * across all 32 teams over the loaded 2018–2025 span. See the design doc for
 * the full distribution table.
 */
const LEAGUE_RANGE = {
  coreRate: { min: 0.14, max: 0.35 },
  retentionRate: { min: 0.23, max: 0.48 },
  overSlot: { min: -1.64, max: 11.98 },
  trendDelta: { min: -14.3, max: 28.1 },
} as const;

/** A steady, unremarkable team: every beat lands mid-band. */
function baseInput(overrides: Partial<TeamNarrativeInput> = {}) {
  return {
    coreStarterCount: 14, // 0.222 of 63 — median core rate
    retainedCount: 23, // 0.365 of 63 — median retention
    scoredPickCount: 63,
    overSlot: 2.7, // inside the dead band
    scoreByYear: flatYears(),
    ...overrides,
  } satisfies TeamNarrativeInput;
}

/** Eight scored years with no trend, so the trajectory beat stays silent. */
function flatYears(): YearScore[] {
  return Array.from({ length: 8 }, (_, i) => ({
    year: 2018 + i,
    score: 50,
    hasData: true,
  }));
}

/** Eight scored years whose last two sit `delta` above the earlier six. */
function trendingYears(delta: number): YearScore[] {
  return flatYears().map((y, i) => (i >= 6 ? { ...y, score: 50 + delta } : y));
}

/** Counts that produce `rate` against a 63-pick denominator. */
function countFor(rate: number): number {
  return Math.round(rate * 63);
}

describe('buildTeamNarrative', () => {
  describe('thresholds are reachable', () => {
    it('places every core-rate band inside the league range', () => {
      for (const threshold of Object.values(CORE_BANDS)) {
        expect(threshold).toBeGreaterThan(LEAGUE_RANGE.coreRate.min);
        expect(threshold).toBeLessThan(LEAGUE_RANGE.coreRate.max);
      }
    });

    it('places every retention band inside the league range', () => {
      for (const threshold of Object.values(RETENTION_BANDS)) {
        expect(threshold).toBeGreaterThan(LEAGUE_RANGE.retentionRate.min);
        expect(threshold).toBeLessThan(LEAGUE_RANGE.retentionRate.max);
      }
    });

    it('places every over-slot band inside the league range', () => {
      for (const threshold of Object.values(CAPITAL_BANDS)) {
        expect(threshold).toBeGreaterThan(LEAGUE_RANGE.overSlot.min);
        expect(threshold).toBeLessThan(LEAGUE_RANGE.overSlot.max);
      }
    });

    it('places every trajectory band inside the league range', () => {
      for (const threshold of Object.values(TRAJECTORY_BANDS)) {
        expect(threshold).toBeGreaterThan(LEAGUE_RANGE.trendDelta.min);
        expect(threshold).toBeLessThan(LEAGUE_RANGE.trendDelta.max);
      }
    });
  });

  describe('production beat', () => {
    it('always leads the narrative', () => {
      const [first] = buildTeamNarrative(baseInput());
      expect(first).toMatch(/\b14 of 63\b/);
    });

    it('cites both the core-starter and the retained counts', () => {
      const [first] = buildTeamNarrative(
        baseInput({ coreStarterCount: 18, retainedCount: 29 }),
      );
      expect(first).toContain('18 of 63');
      expect(first).toContain('29');
    });

    it('distinguishes all nine core-by-retention combinations', () => {
      const coreRates = [0.3, 0.23, 0.17];
      const retentionRates = [0.45, 0.37, 0.29];
      const clauses = coreRates.flatMap((core) =>
        retentionRates.map(
          (retention) =>
            buildTeamNarrative(
              baseInput({
                coreStarterCount: countFor(core),
                retainedCount: countFor(retention),
              }),
            )[0],
        ),
      );
      // Counts differ per combination, so compare the prose after the numbers.
      const shapes = clauses.map((c) => c.replace(/\d+/g, '#'));
      expect(new Set(shapes).size).toBe(9);
    });

    it('reads a high core rate with high retention as hitting and holding', () => {
      const [first] = buildTeamNarrative(
        baseInput({
          coreStarterCount: countFor(0.3),
          retainedCount: countFor(0.45),
        }),
      );
      expect(first).toMatch(/hold/i);
    });

    it('reads a high core rate with low retention as losing what it finds', () => {
      const [first] = buildTeamNarrative(
        baseInput({
          coreStarterCount: countFor(0.3),
          retainedCount: countFor(0.29),
        }),
      );
      expect(first).toMatch(/lets them go|go elsewhere|not keeping/i);
    });

    it('is omitted when the team has no scored picks', () => {
      expect(
        buildTeamNarrative(
          baseInput({
            coreStarterCount: 0,
            retainedCount: 0,
            scoredPickCount: 0,
            scoreByYear: [],
          }),
        ),
      ).toEqual([]);
    });

    it('silences the capital beat too when there are no scored picks', () => {
      // A zero over slot would otherwise band as "returned less than predicted"
      // for a team that has not drafted anyone with season data yet.
      expect(
        buildTeamNarrative(
          baseInput({
            coreStarterCount: 0,
            retainedCount: 0,
            scoredPickCount: 0,
            overSlot: 0,
            scoreByYear: [],
          }),
        ),
      ).toEqual([]);
    });

    it('bands on the boundary the same way from either side', () => {
      const atThreshold = buildTeamNarrative(
        baseInput({ coreStarterCount: Math.ceil(CORE_BANDS.high * 63) }),
      )[0];
      const justUnder = buildTeamNarrative(
        baseInput({ coreStarterCount: Math.ceil(CORE_BANDS.high * 63) - 1 }),
      )[0];
      expect(atThreshold.replace(/\d+/g, '#')).not.toEqual(
        justUnder.replace(/\d+/g, '#'),
      );
    });
  });

  describe('capital beat', () => {
    it('says the picks outplayed their slots when over slot is high', () => {
      const beats = buildTeamNarrative(baseInput({ overSlot: 6.5 }));
      expect(beats[1]).toMatch(/outplay|beyond|above/i);
      expect(beats[1]).toContain('+6.5');
    });

    it('says the picks underdelivered when over slot is low', () => {
      const beats = buildTeamNarrative(baseInput({ overSlot: 0.4 }));
      expect(beats[1]).toMatch(/less than|short of|below/i);
    });

    it('calls out a negative over slot plainly', () => {
      const beats = buildTeamNarrative(baseInput({ overSlot: -1.2 }));
      expect(beats[1]).toContain('−1.2');
    });

    it('is omitted inside the dead band, where nearly every team sits', () => {
      expect(buildTeamNarrative(baseInput({ overSlot: 2.7 }))).toHaveLength(1);
    });

    it('treats the low threshold as the bottom of the dead band', () => {
      expect(
        buildTeamNarrative(baseInput({ overSlot: CAPITAL_BANDS.low })),
      ).toHaveLength(1);
      expect(
        buildTeamNarrative(baseInput({ overSlot: CAPITAL_BANDS.low - 0.01 })),
      ).toHaveLength(2);
    });
  });

  describe('trajectory beat', () => {
    it('reports a rising trend', () => {
      const beats = buildTeamNarrative(
        baseInput({ scoreByYear: trendingYears(12) }),
      );
      expect(beats.at(-1)).toMatch(/ris|up|climb|better/i);
    });

    it('reports a falling trend', () => {
      const beats = buildTeamNarrative(
        baseInput({ scoreByYear: trendingYears(-12) }),
      );
      expect(beats.at(-1)).toMatch(/fall|down|slip|worse/i);
    });

    it('is omitted when the swing is small', () => {
      expect(
        buildTeamNarrative(baseInput({ scoreByYear: trendingYears(1) })),
      ).toHaveLength(1);
    });

    it('is omitted when fewer than three years have data', () => {
      const twoYears: YearScore[] = [
        { year: 2024, score: 30, hasData: true },
        { year: 2025, score: 80, hasData: true },
      ];
      expect(
        buildTeamNarrative(baseInput({ scoreByYear: twoYears })),
      ).toHaveLength(1);
    });

    it('ignores years still awaiting season data', () => {
      const withAwaiting: YearScore[] = [
        ...trendingYears(12),
        { year: 2026, score: 0, hasData: false },
      ];
      expect(
        buildTeamNarrative(baseInput({ scoreByYear: withAwaiting })),
      ).toEqual(
        buildTeamNarrative(baseInput({ scoreByYear: trendingYears(12) })),
      );
    });
  });

  describe('composition', () => {
    it('orders the beats production, capital, trajectory', () => {
      const beats = buildTeamNarrative(
        baseInput({ overSlot: 6.5, scoreByYear: trendingYears(12) }),
      );
      expect(beats).toHaveLength(3);
      expect(beats[0]).toContain('14 of 63');
      expect(beats[1]).toContain('+6.5');
      expect(beats[2]).toMatch(/ris|up|climb|better/i);
    });

    it('closes every beat as a sentence', () => {
      for (const beat of buildTeamNarrative(
        baseInput({ overSlot: 6.5, scoreByYear: trendingYears(12) }),
      )) {
        expect(beat).toMatch(/\.$/);
      }
    });

    it('leaves no gap when a middle beat is omitted', () => {
      const beats = buildTeamNarrative(
        baseInput({ overSlot: 2.7, scoreByYear: trendingYears(12) }),
      );
      expect(beats).toHaveLength(2);
      expect(beats[1]).toMatch(/ris|up|climb|better/i);
    });
  });
});
