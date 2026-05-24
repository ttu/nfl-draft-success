import type { DraftPick } from '../types';

/** Picks sorted ascending by overall pick number (does not mutate input). */
export function sortPicksByOverall(picks: DraftPick[]): DraftPick[] {
  return [...picks].sort((a, b) => a.overallPick - b.overallPick);
}

/** True when every pick has zero seasons (e.g. brand-new draft class). */
export function allPicksAwaitingSeasonData(picks: DraftPick[]): boolean {
  return picks.every((p) => p.seasons.length === 0);
}

/**
 * Suppress the per-year heading when a position view is already scoped to a
 * single year that matches the only group on screen.
 */
export function shouldHidePositionYearBanner({
  yearFrom,
  yearTo,
  groupCount,
  groupYear,
}: {
  yearFrom: number;
  yearTo: number;
  groupCount: number;
  groupYear: number;
}): boolean {
  return yearFrom === yearTo && groupCount === 1 && groupYear === yearFrom;
}
