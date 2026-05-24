import type { DraftClass } from '../types';
import {
  getDraftClassMetrics,
  type DraftClassMetrics,
} from './getDraftClassMetrics';

export interface DraftClassWithMetrics {
  dc: DraftClass;
  metrics: DraftClassMetrics;
}

/** Compute metrics for each draft class against the selected team. */
export function buildDraftClassMetricsRows(
  draftClasses: DraftClass[],
  selectedTeam: string,
  options: { draftingTeamOnly: boolean },
): DraftClassWithMetrics[] {
  return draftClasses.map((dc) => ({
    dc,
    metrics: getDraftClassMetrics(dc, selectedTeam, options),
  }));
}

/**
 * Year of the most-recent draft class that still has picks awaiting season
 * data. Returns `null` when no class has awaiting picks — used to anchor a
 * one-off footnote in the UI to only the latest such class.
 */
export function findLatestYearWithAwaitingData(
  rows: DraftClassWithMetrics[],
): number | null {
  return rows.reduce<number | null>((max, { dc, metrics }) => {
    if (metrics.awaitingDataCount <= 0) return max;
    return max == null || dc.year > max ? dc.year : max;
  }, null);
}

/**
 * True when the per-year roster heading is redundant because we're already
 * scoped to a single year and the rendered draft class matches it.
 */
export function shouldHideRosterYearHeading({
  yearCount,
  draftClassesLength,
  rosterByDraftYear,
  draftClassYear,
}: {
  yearCount: number;
  draftClassesLength: number;
  rosterByDraftYear: { year: number }[];
  draftClassYear: number | undefined;
}): boolean {
  return (
    yearCount === 1 &&
    draftClassesLength === 1 &&
    rosterByDraftYear.length === 1 &&
    rosterByDraftYear[0].year === draftClassYear
  );
}
