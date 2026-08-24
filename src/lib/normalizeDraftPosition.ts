/**
 * Aliases applied when writing draft JSON (`scripts/update-data.ts`) and when
 * comparing positions in the app (filters, menus, URLs). Single source of
 * truth — UI does not duplicate this map.
 *
 * The feed labels the same position more than one way, and without these the
 * split is visible: guards drafted as `OG` landed in a different filter option
 * — and under a different `/position/:position` URL — than guards drafted as
 * `G`. Each alias points at whichever label the feed overwhelmingly prefers
 * (`G` 131 picks vs `OG` 1; `S` 193 vs `FS` 2), so the merge moves as few picks
 * as possible.
 *
 * `NT` and the generic `DL`/`OL` buckets are deliberately left alone: those are
 * positions the feed genuinely distinguishes, not two spellings of one.
 */
const DRAFT_POSITION_ALIASES: Record<string, string> = {
  T: 'OT',
  SAF: 'S',
  FS: 'S',
  OG: 'G',
};

export function normalizeDraftPosition(raw: string): string {
  const key = raw.trim().toUpperCase();
  return key ? (DRAFT_POSITION_ALIASES[key] ?? key) : '';
}
