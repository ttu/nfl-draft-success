import { describe, it, expect } from 'vitest';
import type { DraftPick, Season } from '../types';
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

  describe('picks departing over the offseason', () => {
    /** A row for the upcoming season: carries standing, no football played. */
    const upcoming = (retained: boolean, currentTeam?: string): Season =>
      makeSeason({
        year: LATEST_SEASON + 1,
        gamesPlayed: 0,
        teamGames: 0,
        snapShare: 0,
        retained,
        ...(currentTeam ? { currentTeam } : {}),
      });

    /** Retained right through the newest played season. */
    const stillHere = (round: number, draftYear: number): DraftPick =>
      makePick({
        round,
        overallPick: 150,
        draftYear,
        teamId: 'KC',
        seasons: [makeSeason({ year: LATEST_SEASON })],
      });

    it('charges the full window to a pick traded before playing a snap', () => {
      // Nothing in the played rows says he left, because the season he leaves
      // for has not started.
      const traded = stillHere(3, LATEST_SEASON - 1);
      traded.seasons.push(upcoming(false, 'MIN'));
      expect(scoredSeasonCount(traded, 2)).toBe(4);
    });

    it('charges the full window to a pick left off every roster', () => {
      const unsigned = stillHere(3, LATEST_SEASON - 1);
      unsigned.seasons.push(upcoming(false));
      expect(scoredSeasonCount(unsigned, 2)).toBe(4);
    });

    it('keeps clamping a pick his drafting team still rosters', () => {
      const kept = stillHere(3, LATEST_SEASON - 1);
      kept.seasons.push(upcoming(true));
      expect(scoredSeasonCount(kept, 2)).toBe(2);
    });

    it('does not count the unplayed season as elapsed', () => {
      // The trap this design avoids: the upcoming season must not enter the
      // denominator, or every current pick's score silently deflates.
      const rookie = stillHere(3, LATEST_SEASON);
      rookie.seasons.push(upcoming(true));
      expect(scoredSeasonCount(rookie, 1)).toBe(1);
    });

    it('leaves the scored window drawn over played seasons only', () => {
      const kept = stillHere(3, LATEST_SEASON - 1);
      kept.seasons.push(upcoming(true));
      expect(scoredWindowYears(kept)).not.toContain(LATEST_SEASON + 1);
    });
  });
});

describe('scoredSeasonCount with an apprenticeship', () => {
  /** A quarterback who sat `benchYears` behind a veteran, then won the job. */
  const apprenticed = (
    round: number,
    draftYear: number,
    benchYears: number,
    startingYears: number,
  ): DraftPick =>
    makePick({
      position: 'QB',
      round,
      overallPick: round === 1 ? 26 : 150,
      draftYear,
      seasons: [
        ...Array.from({ length: benchYears }, (_, i) =>
          makeSeason({
            year: draftYear + i,
            gamesPlayed: 1,
            snapShare: 0.02,
          }),
        ),
        ...Array.from({ length: startingYears }, (_, i) =>
          makeSeason({ year: draftYear + benchYears + i }),
        ),
      ],
    });

  it('starts the window at the season the apprenticeship ended', () => {
    // Three bench years, then three as the starter, still on the roster. Only
    // the three starting seasons have elapsed since the window opened.
    const love = apprenticed(1, LATEST_SEASON - 5, 3, 3);
    expect(scoredSeasonCount(love, 3)).toBe(3);
  });

  it('shortens the window by the bench years rather than sliding it', () => {
    // The rookie deal entitled the team to five years from the draft, not five
    // from whenever he took over. Gone after two starting seasons, so the
    // remaining window is charged: 5 − 3 = 2, floored at the 2 seasons he had.
    const gone = makePick({
      position: 'QB',
      round: 1,
      overallPick: 26,
      draftYear: LATEST_SEASON - 6,
      seasons: [
        makeSeason({
          year: LATEST_SEASON - 6,
          gamesPlayed: 1,
          snapShare: 0.02,
        }),
        makeSeason({
          year: LATEST_SEASON - 5,
          gamesPlayed: 1,
          snapShare: 0.02,
        }),
        makeSeason({
          year: LATEST_SEASON - 4,
          gamesPlayed: 1,
          snapShare: 0.02,
        }),
        makeSeason({ year: LATEST_SEASON - 3 }),
        makeSeason({ year: LATEST_SEASON - 2 }),
      ],
    });
    expect(scoredSeasonCount(gone, 2)).toBe(2);
  });

  it('leaves a quarterback who never won the job on the full window', () => {
    // No vindication, no forgiveness: the Kyle Trask case still divides by the
    // whole rookie deal.
    const neverStarted = makePick({
      position: 'QB',
      round: 2,
      overallPick: 64,
      draftYear: LATEST_SEASON - 5,
      seasons: Array.from({ length: 4 }, (_, i) =>
        makeSeason({
          year: LATEST_SEASON - 5 + i,
          gamesPlayed: 1,
          snapShare: 0.02,
        }),
      ),
    });
    expect(scoredSeasonCount(neverStarted, 4)).toBe(4);
  });

  it('never divides by less than the seasons actually counted', () => {
    // Bench years can exhaust the window (4 − 3 = 1 here). The floor keeps the
    // divisor at the seasons the numerator spans.
    const late = apprenticed(4, LATEST_SEASON - 5, 3, 3);
    expect(scoredSeasonCount(late, 3)).toBe(3);
  });

  it('leaves every other position on the unshifted window', () => {
    const tackle = apprenticed(1, LATEST_SEASON - 5, 3, 3);
    tackle.position = 'OT';
    expect(scoredSeasonCount(tackle, 3)).toBe(5);
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

  it('starts at the season a quarterback finished his apprenticeship', () => {
    const love = makePick({
      position: 'QB',
      round: 1,
      overallPick: 26,
      draftYear: 2020,
      seasons: [
        makeSeason({ year: 2020, gamesPlayed: 1, snapShare: 0.02 }),
        makeSeason({ year: 2021, gamesPlayed: 1, snapShare: 0.02 }),
        makeSeason({ year: 2022, gamesPlayed: 1, snapShare: 0.02 }),
        makeSeason({ year: 2023 }),
        makeSeason({ year: 2024 }),
      ],
    });
    expect(scoredWindowYears(love)).toEqual([2023, 2024]);
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
