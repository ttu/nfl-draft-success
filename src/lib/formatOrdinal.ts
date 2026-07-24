/**
 * Format a whole number as an English ordinal: 1 → "1st", 2 → "2nd",
 * 91 → "91st". The 11–13 range always takes "th" ("11th", not "11st").
 */
export function formatOrdinal(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  const lastTwo = abs % 100;
  const last = abs % 10;
  let suffix = 'th';
  if (lastTwo < 11 || lastTwo > 13) {
    if (last === 1) suffix = 'st';
    else if (last === 2) suffix = 'nd';
    else if (last === 3) suffix = 'rd';
  }
  return `${n}${suffix}`;
}
