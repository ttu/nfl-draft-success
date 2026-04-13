import type { DraftClass, DraftPick } from '../types';

export interface PickWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

/**
 * Unique positions present in the loaded draft classes, sorted for display.
 * Canonical spelling is taken from the first pick encountered (scan years ascending,
 * then overall pick order).
 */
export function collectDraftPositions(draftClasses: DraftClass[]): string[] {
  const byUpper = new Map<string, string>();
  const sortedClasses = [...draftClasses].sort((a, b) => a.year - b.year);
  for (const dc of sortedClasses) {
    const picks = [...dc.picks].sort((a, b) => a.overallPick - b.overallPick);
    for (const p of picks) {
      const raw = p.position.trim();
      if (!raw) continue;
      const upper = raw.toUpperCase();
      if (!byUpper.has(upper)) byUpper.set(upper, upper);
    }
  }
  return [...byUpper.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function filterPicksByPosition(
  draftClasses: DraftClass[],
  position: string,
): PickWithDraftYear[] {
  const target = position.trim().toLowerCase();
  if (!target) return [];
  const out: PickWithDraftYear[] = [];
  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      if (pick.position.trim().toLowerCase() === target) {
        out.push({ pick, draftYear: dc.year });
      }
    }
  }
  out.sort(
    (a, b) =>
      a.draftYear - b.draftYear || a.pick.overallPick - b.pick.overallPick,
  );
  return out;
}

export function groupPicksByDraftYear(
  picks: PickWithDraftYear[],
): Array<{ year: number; picks: PickWithDraftYear[] }> {
  const map = new Map<number, PickWithDraftYear[]>();
  for (const item of picks) {
    const list = map.get(item.draftYear) ?? [];
    list.push(item);
    map.set(item.draftYear, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, group]) => ({ year, picks: group }));
}

export function resolveCanonicalPosition(
  positions: string[],
  urlSegment: string,
): string | null {
  const q = urlSegment.trim().toLowerCase();
  if (!q) return null;
  return positions.find((p) => p.trim().toLowerCase() === q) ?? null;
}
