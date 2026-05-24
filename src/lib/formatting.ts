/** Up to two uppercase initials from a person's name. */
export function getNameInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Snap share (0..1) rendered as a one-decimal percent (e.g. 0.4567 → "45.7%"). */
export function formatSnapPercent(share: number): string {
  return `${Math.round(share * 1000) / 10}%`;
}

/** "1 season" / "N seasons" pluralisation. */
export function pluralizeSeasons(count: number): string {
  return `${count} season${count === 1 ? '' : 's'}`;
}

/** "N role" / "N roles" pluralisation. */
export function pluralizeRoles(count: number): string {
  return `${count} role${count === 1 ? '' : 's'}`;
}

/**
 * Suffix shown after a position title to indicate the draft range.
 * Examples: ` · 2023` (single year) or ` — drafts 2021–2024` (multi-year).
 */
export function formatDraftRangeSuffix(
  yearFrom: number,
  yearTo: number,
): string {
  return yearFrom === yearTo
    ? ` · ${yearFrom}`
    : ` — drafts ${yearFrom}–${yearTo}`;
}
