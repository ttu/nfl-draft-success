import type { DraftClass, DraftPick } from '../types';
import { normalizeDraftPosition } from './normalizeDraftPosition';

export interface PickWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

/**
 * Unique positions present in the loaded draft classes, sorted for display.
 * Uses {@link normalizeDraftPosition} so codes match persisted JSON.
 */
export function collectDraftPositions(draftClasses: DraftClass[]): string[] {
  const byCanon = new Map<string, string>();
  const sortedClasses = [...draftClasses].sort((a, b) => a.year - b.year);
  for (const dc of sortedClasses) {
    const picks = [...dc.picks].sort((a, b) => a.overallPick - b.overallPick);
    for (const p of picks) {
      const raw = p.position.trim();
      if (!raw) continue;
      const canon = normalizeDraftPosition(raw);
      if (!byCanon.has(canon)) byCanon.set(canon, canon);
    }
  }
  return [...byCanon.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function filterPicksByPosition(
  draftClasses: DraftClass[],
  position: string,
): PickWithDraftYear[] {
  const target = normalizeDraftPosition(position.trim());
  if (!target) return [];
  const out: PickWithDraftYear[] = [];
  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      if (normalizeDraftPosition(pick.position.trim()) === target) {
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
  const qCanon = normalizeDraftPosition(urlSegment.trim());
  if (!qCanon) return null;
  return (
    positions.find((p) => normalizeDraftPosition(p.trim()) === qCanon) ?? null
  );
}
