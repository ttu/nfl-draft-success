/**
 * True when a team has draft picks in the range but none of them have
 * accumulated any season data yet — used to display a placeholder dash
 * rather than misleading 0.00 scores.
 */
export function hasNoScoredPicks(
  totalPicks: number,
  scoredPickCount: number,
): boolean {
  return totalPicks > 0 && scoredPickCount === 0;
}
