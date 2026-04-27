import type { DraftClass, DraftPick } from '../types';

export interface PickWithDraftYear {
  pick: DraftPick;
  draftYear: number;
}

/** nflverse-style draft JSON uses both `T` and `OT` for offensive tackle */
const POSITION_CANONICAL: Record<string, string> = {
  T: 'OT',
};

/** Uppercase position code with aliases collapsed (e.g. `T` → `OT`). */
export function canonicalPositionCode(positionCode: string): string {
  const key = positionCode.trim().toUpperCase();
  return POSITION_CANONICAL[key] ?? key;
}

/**
 * Unique positions present in the loaded draft classes, sorted for display.
 * Aliases share one menu entry (e.g. `T` and `OT` → `OT`).
 */
export function collectDraftPositions(draftClasses: DraftClass[]): string[] {
  const byCanon = new Map<string, string>();
  const sortedClasses = [...draftClasses].sort((a, b) => a.year - b.year);
  for (const dc of sortedClasses) {
    const picks = [...dc.picks].sort((a, b) => a.overallPick - b.overallPick);
    for (const p of picks) {
      const raw = p.position.trim();
      if (!raw) continue;
      const canon = canonicalPositionCode(raw);
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
  const target = canonicalPositionCode(position.trim());
  if (!target) return [];
  const out: PickWithDraftYear[] = [];
  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      if (canonicalPositionCode(pick.position.trim()) === target) {
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
  const qCanon = canonicalPositionCode(urlSegment.trim());
  if (!qCanon) return null;
  return (
    positions.find((p) => canonicalPositionCode(p.trim()) === qCanon) ?? null
  );
}
