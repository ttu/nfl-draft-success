import { describe, it, expect } from 'vitest';
import { excusedAbsenceGames } from './absenceWeeks';

describe('excusedAbsenceGames', () => {
  it('unions two disjoint sources covering consecutive halves of one absence', () => {
    // Ronnie Stanley 2021: on the injury report weeks 1–6, then placed on IR,
    // which removes him from the report, so weeks 7–18 arrive from the reserve
    // feed instead (week 8 is the bye). The two sets never overlap, so `max()`
    // of their counts saw 11 of the 16 games he lost. He played week 1 while
    // listed, which is why that week is documented but not missed.
    const missedWeeks = [
      2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ];
    expect(
      excusedAbsenceGames({
        missedWeeks,
        injuryWeeks: [1, 2, 3, 4, 5, 6],
        reserveWeeks: [7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      }),
    ).toBe(16);
  });

  it('does not excuse a week the player was listed but played', () => {
    // The weekly injury report lists players who suit up on Sunday, so being
    // on it is not evidence a game was lost.
    expect(
      excusedAbsenceGames({
        missedWeeks: [5],
        injuryWeeks: [3, 4, 5],
      }),
    ).toBe(1);
  });

  it('never excuses a bye week, because the team played no game in it', () => {
    // Week 7 is the bye: it is absent from the team's week set, so it cannot
    // reach `missedWeeks` even while the reserve feed still carries him.
    expect(
      excusedAbsenceGames({
        missedWeeks: [6, 8],
        reserveWeeks: [6, 7, 8],
      }),
    ).toBe(2);
  });

  it('counts a week once when one source repeats it', () => {
    // Reserve weeks arrive as one row per roster entry, so a week can appear
    // twice within a single source; the excusal is a count of games, not rows.
    expect(
      excusedAbsenceGames({
        missedWeeks: [4, 4, 5],
        reserveWeeks: [4, 4, 5, 5],
      }),
    ).toBe(2);
  });

  it('counts a week once when both sources report it', () => {
    expect(
      excusedAbsenceGames({
        missedWeeks: [4, 5],
        injuryWeeks: [4, 5],
        reserveWeeks: [4, 5],
      }),
    ).toBe(2);
  });

  it('excuses nothing when neither source is supplied', () => {
    expect(excusedAbsenceGames({ missedWeeks: [1, 2, 3] })).toBe(0);
  });

  it('excuses nothing when no games were missed', () => {
    expect(
      excusedAbsenceGames({
        missedWeeks: [],
        injuryWeeks: [1, 2, 3],
        reserveWeeks: [4, 5],
      }),
    ).toBe(0);
  });

  it('excuses nothing when the evidence covers weeks he did not miss', () => {
    // A player unsigned for weeks 1–3 missed them, but nothing documents an
    // injury, so none of them are forgiven.
    expect(
      excusedAbsenceGames({
        missedWeeks: [1, 2, 3],
        injuryWeeks: [10],
        reserveWeeks: [11],
      }),
    ).toBe(0);
  });

  it('accepts Sets as well as arrays', () => {
    expect(
      excusedAbsenceGames({
        missedWeeks: new Set([2, 3]),
        injuryWeeks: new Set([3]),
        reserveWeeks: new Set([2]),
      }),
    ).toBe(2);
  });

  it('is monotone in evidence: adding a documented week never forgives less', () => {
    const missedWeeks = [1, 2, 3, 4];
    const fewer = excusedAbsenceGames({ missedWeeks, injuryWeeks: [1, 2] });
    const more = excusedAbsenceGames({
      missedWeeks,
      injuryWeeks: [1, 2],
      reserveWeeks: [3],
    });
    expect(more).toBeGreaterThanOrEqual(fewer);
    expect(more).toBe(3);
  });
});
