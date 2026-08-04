/**
 * The nickname half of a full team name — "Detroit Lions" → "Lions".
 *
 * Every current franchise name ends in its nickname, so the last word is the
 * whole rule. Used where a column is only a third of a phone wide and the city
 * would push the name onto three lines.
 */
export function teamNickname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}
