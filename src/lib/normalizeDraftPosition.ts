/**
 * Aliases applied when writing draft JSON (`scripts/update-data.ts`) and when
 * comparing positions in the app (filters, menus, URLs). Single source of
 * truth — UI does not duplicate this map.
 */
const DRAFT_POSITION_ALIASES: Record<string, string> = {
  T: 'OT',
  SAF: 'S',
};

export function normalizeDraftPosition(raw: string): string {
  const key = raw.trim().toUpperCase();
  return key ? (DRAFT_POSITION_ALIASES[key] ?? key) : '';
}
