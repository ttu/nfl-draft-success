import { describe, it, expect } from 'vitest';
import {
  MIN_SEASON_ENDING_ABSENCE_GAMES,
  seasonEndingAbsenceGames,
} from './seasonEndingAbsence';

const teamWeeks = (...weeks: number[]) => new Set(weeks);

describe('seasonEndingAbsenceGames', () => {
  it('counts every team game after a player disappears mid-season', () => {
    // Played weeks 1-2, team played 1-5: three games missed to season end.
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 2),
        teamWeeks: teamWeeks(1, 2, 3, 4, 5),
      }),
    ).toBe(3);
  });

  it('ignores the bye week when counting team games missed', () => {
    // Team has no week 4; missing weeks 5 and 6 is two games, not three.
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 2, 3),
        teamWeeks: teamWeeks(1, 2, 3, 5, 6),
      }),
    ).toBe(2);
  });

  it('returns 0 when the player returned before the season ended', () => {
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 5),
        teamWeeks: teamWeeks(1, 2, 3, 4, 5),
      }),
    ).toBe(0);
  });

  it('returns 0 for a single missed game, which reads as a scratch not an injury', () => {
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 2, 3, 4),
        teamWeeks: teamWeeks(1, 2, 3, 4, 5),
      }),
    ).toBe(0);
  });

  it('needs at least MIN_SEASON_ENDING_ABSENCE_GAMES missed games to excuse any', () => {
    const played = teamWeeks(1);
    const team = teamWeeks(1, 2, 3);
    expect(MIN_SEASON_ENDING_ABSENCE_GAMES).toBe(2);
    expect(
      seasonEndingAbsenceGames({ playerWeeks: played, teamWeeks: team }),
    ).toBe(2);
  });

  it('returns 0 when the player never took a snap, leaving retention to decide', () => {
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(),
        teamWeeks: teamWeeks(1, 2, 3),
      }),
    ).toBe(0);
  });

  it('returns 0 when the player played the whole schedule', () => {
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 2, 3),
        teamWeeks: teamWeeks(1, 2, 3),
      }),
    ).toBe(0);
  });

  it('ignores player weeks the team has no game for', () => {
    expect(
      seasonEndingAbsenceGames({
        playerWeeks: teamWeeks(1, 99),
        teamWeeks: teamWeeks(1, 2, 3, 4),
      }),
    ).toBe(3);
  });
});
