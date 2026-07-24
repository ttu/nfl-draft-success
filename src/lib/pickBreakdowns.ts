import type { DraftPick } from '../types';
import { normalizeDraftPosition } from './normalizeDraftPosition';
import { getPositionUnit, type PositionUnit } from './positionUnit';

export interface UnitBreakdownRow {
  unit: PositionUnit;
  label: string;
  count: number;
}

export interface PositionBreakdownRow {
  position: string;
  count: number;
}

const UNIT_ORDER: { unit: PositionUnit; label: string }[] = [
  { unit: 'offense', label: 'Offense' },
  { unit: 'defense', label: 'Defense' },
  { unit: 'special_teams', label: 'Special teams' },
];

/**
 * Count picks by side of the ball. Always returns the three units in a fixed
 * offense → defense → special-teams order, including zero counts.
 */
export function getUnitBreakdown(picks: DraftPick[]): UnitBreakdownRow[] {
  const counts = new Map<PositionUnit, number>();
  for (const pick of picks) {
    const unit = getPositionUnit(pick.position);
    counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  return UNIT_ORDER.map(({ unit, label }) => ({
    unit,
    label,
    count: counts.get(unit) ?? 0,
  }));
}

/**
 * Count picks per canonical position (aliases normalized), sorted by count
 * descending then position ascending. Blank positions are ignored.
 */
export function getPositionBreakdown(
  picks: DraftPick[],
): PositionBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    const position = normalizeDraftPosition(pick.position);
    if (!position) continue;
    counts.set(position, (counts.get(position) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([position, count]) => ({ position, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.position.localeCompare(b.position, undefined, {
          sensitivity: 'base',
        }),
    );
}
