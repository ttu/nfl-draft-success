/**
 * Draft feeds use `SAF` in some years and `S` in others for generic safety.
 * We store `S` everywhere for consistent filtering and display.
 */
export function normalizeDraftPosition(raw: string): string {
  const pos = raw.trim();
  if (pos.toUpperCase() === 'SAF') return 'S';
  return pos;
}
