import { describe, it, expect } from 'vitest';
import type { DraftPick } from '../types';
import { makePick, makeSeason } from '../test/factories';
import {
  LATEST_SEASON,
  rookieWindow,
  scoredSeasonCount,
  scoredWindowYears,
} from './rookieWindow';

/** Still on the roster: carries a retained row in the newest season. */
const pick = (round: number, draftYear: number): DraftPick =>
  makePick({
    round,
    overallPick: round === 1 ? 5 : 150,
    draftYear,
    seasons: [makeSeason({ year: LATEST_SEASON })],
  });

/** Gone: last retained row predates the newest season. */
const departedPick = (
  round: number,
  draftYear: number,
  lastSeasonWithTeam: number,
): DraftPick =>
  makePick({
    round,
    overallPick: round === 1 ? 5 : 150,
    draftYear,
    seasons: [makeSeason({ year: lastSeasonWithTeam })],
  });

describe('rookieWindow', () => {
  it('gives round 1 five years — the rookie deal plus the fifth-year option', () => {
    expect(rookieWindow(1)).toBe(5);
  });

  it('gives rounds 2–7 four years, the length of their rookie deal', () => {
    for (const round of [2, 3, 4, 5, 6, 7]) {
      expect(rookieWindow(round)).toBe(4);
    }
  });
});

describe('scoredSeasonCount', () => {
  it('measures a matured round-1 pick against the full five-year window', () => {
    // Drafted long enough ago that all five years have elapsed.
    expect(scoredSeasonCount(pick(1, LATEST_SEASON - 6), 3)).toBe(5);
  });

  it('measures a matured late-round pick against four years, not five', () => {
    // The regression guard: a 4-year contributor who leaves in free agency did
    // exactly what a late pick should, and must not be scored 4/5.
    expect(scoredSeasonCount(pick(3, LATEST_SEASON - 6), 4)).toBe(4);
  });

  it('measures a recent class against elapsed seasons only', () => {
    // One season into a five-year window: nothing has been missed yet.
    expect(scoredSeasonCount(pick(1, LATEST_SEASON), 1)).toBe(1);
    expect(scoredSeasonCount(pick(1, LATEST_SEASON - 1), 2)).toBe(2);
  });

  it('never lets seasons beyond the window inflate a long tenure', () => {
    // Seven retained years divided by five would exceed the pick's own mean.
    expect(scoredSeasonCount(pick(1, LATEST_SEASON - 8), 7)).toBe(7);
  });

  it('handles a class drafted after the latest season in the data', () => {
    // Zero elapsed seasons must not produce a zero denominator.
    expect(scoredSeasonCount(pick(1, LATEST_SEASON + 1), 1)).toBe(1);
  });

  describe('picks that have already departed', () => {
    it('charges a departed pick the full window even mid-window', () => {
      // Drafted 3 seasons ago, gone after his first. The remaining two years of
      // the five-year window are known to be zero, so charge them now.
      const gone = departedPick(1, LATEST_SEASON - 2, LATEST_SEASON - 2);
      expect(scoredSeasonCount(gone, 1)).toBe(5);
    });

    it('gives a departed pick a score that no longer drifts with the calendar', () => {
      // The same career, viewed from three different "latest seasons", must
      // divide by the same window — otherwise a settled outcome keeps sliding.
      const twoYearsOn = departedPick(1, LATEST_SEASON - 2, LATEST_SEASON - 2);
      const fiveYearsOn = departedPick(1, LATEST_SEASON - 5, LATEST_SEASON - 5);
      expect(scoredSeasonCount(twoYearsOn, 1)).toBe(
        scoredSeasonCount(fiveYearsOn, 1),
      );
    });

    it('uses the late-round window for a departed late-round pick', () => {
      const gone = departedPick(4, LATEST_SEASON - 1, LATEST_SEASON - 1);
      expect(scoredSeasonCount(gone, 1)).toBe(4);
    });

    it('still caps a departed pick who outlasted his window', () => {
      const gone = departedPick(1, LATEST_SEASON - 8, LATEST_SEASON - 2);
      expect(scoredSeasonCount(gone, 7)).toBe(7);
    });

    it('leaves a pick still on the roster clamped to elapsed seasons', () => {
      expect(scoredSeasonCount(pick(1, LATEST_SEASON - 1), 2)).toBe(2);
    });
  });
});

describe('scoredWindowYears', () => {
  it('runs from the draft year across the whole scored window', () => {
    // Departed after one season, so all five years are charged.
    const gone = departedPick(1, 2021, 2021);
    expect(scoredWindowYears(gone)).toEqual([2021, 2022, 2023, 2024, 2025]);
  });

  it('stops at elapsed seasons for a pick still on the roster', () => {
    const here = pick(1, LATEST_SEASON - 1);
    expect(scoredWindowYears(here)).toEqual([LATEST_SEASON - 1, LATEST_SEASON]);
  });

  it('covers every season of a tenure that outlasted the window', () => {
    const seasons = Array.from({ length: 7 }, (_, i) =>
      makeSeason({ year: 2018 + i }),
    );
    const longServer = makePick({ round: 1, draftYear: 2018, seasons });
    expect(scoredWindowYears(longServer)).toHaveLength(7);
    expect(scoredWindowYears(longServer).at(-1)).toBe(2024);
  });

  it('is empty for a pick that never had a retained season', () => {
    // Nothing is divided, so there is no window to draw.
    const neverPlayed = makePick({
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, retained: false })],
    });
    expect(scoredWindowYears(neverPlayed)).toEqual([]);
    expect(scoredWindowYears(makePick({ seasons: [] }))).toEqual([]);
  });
});
