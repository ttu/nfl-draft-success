/**
 * The fixed windows behind the "does the score predict winning?" analysis.
 *
 * The comparison is deliberately *lagged*: a team's draft-success score over an
 * early window is measured against the win rate of the seasons that *followed*.
 * This is a more defensible causal claim than a concurrent comparison — a draft
 * class needs a few years to affect the standings, and a concurrent window is
 * confounded (rebuilding teams hand snaps to rookies, inflating their score
 * exactly when they lose). The windows are fixed rather than driven by the year
 * selector because the app's default window ends at the latest completed season,
 * leaving no later seasons to measure wins against.
 */
export interface LaggedWindows {
  draftFrom: number;
  draftTo: number;
  winFrom: number;
  winTo: number;
}

export const LAGGED_WINDOWS: LaggedWindows = {
  draftFrom: 2018,
  draftTo: 2021,
  winFrom: 2022,
  winTo: 2025,
};

/** A year span as `2018–2021`, or a single year plain. */
export function formatYearRange(from: number, to: number): string {
  return from === to ? String(from) : `${from}–${to}`;
}

/** A compact year span as `'18–'21`, or a single year as `2018`. */
export function formatYearRangeShort(from: number, to: number): string {
  if (from === to) return String(from);
  return `'${String(from).slice(2)}–'${String(to).slice(2)}`;
}
