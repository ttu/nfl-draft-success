/**
 * Detecting season-ending absences from snap data alone.
 *
 * The nflverse injury feed is the weekly practice/game-status report, and a
 * player placed on IR drops off the 53-man roster and off that report entirely.
 * The worst injuries therefore leave no trace in `injuryReportWeeks` (Nick Bosa
 * has zero 2020 rows despite tearing his ACL in week 2). Snap counts still show
 * the shape of it: the player appears every week, then never again.
 */

/**
 * Missing the final game of a season reads as a rest day or a healthy scratch,
 * so a gap has to run at least this long before we treat it as season-ending.
 */
export const MIN_SEASON_ENDING_ABSENCE_GAMES = 2;

/**
 * Team games between a player's last appearance and the end of their team's
 * season. Weeks are matched against the team's own schedule, so byes and
 * postseason runs count correctly. Returns 0 when the player came back, when
 * they never played, or when the gap is too short to read as an injury.
 */
export function seasonEndingAbsenceGames(options: {
  playerWeeks: Iterable<number>;
  teamWeeks: Iterable<number>;
}): number {
  const teamSchedule = new Set(options.teamWeeks);

  let lastPlayed = -Infinity;
  for (const week of options.playerWeeks) {
    if (teamSchedule.has(week) && week > lastPlayed) lastPlayed = week;
  }
  if (lastPlayed === -Infinity) return 0;

  let missed = 0;
  for (const week of teamSchedule) {
    if (week > lastPlayed) missed += 1;
  }

  return missed >= MIN_SEASON_ENDING_ABSENCE_GAMES ? missed : 0;
}
