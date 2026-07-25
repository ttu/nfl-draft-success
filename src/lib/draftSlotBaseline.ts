/**
 * Draft-slot baseline: what draft score a pick is *expected* to earn given only
 * where it was taken.
 *
 * The raw draft score (see {@link getPlayerDraftScore}) measures how much a pick
 * plays — but playing time is largely handed out by draft capital: early picks
 * are expected to play, late picks are not. That makes the raw score reward
 * teams for merely holding early/plentiful picks (a bad-team advantage), which
 * is why it barely tracks later winning. Scoring a pick *relative to its slot's
 * expectation* strips out the capital and isolates drafting skill:
 *
 *   overSlot(pick) = actualScore(pick) − expectedScore(overallPick)
 *
 * The expectation curve is **empirical**: a local-linear smoother over
 * `ln(overallPick)`, made non-increasing, and stored as a knot table in
 * `src/data/draft-slot-baseline.json` by `scripts/derive-draft-slot-baseline.ts`.
 *
 * It used to be a single log-linear fit, `a + b·ln(pick)` clamped to 0–100, but
 * that shape is wrong at both ends. The observed curve is *flat* across the top
 * of round 1 (pick 1 ≈ 91, picks 2–12 ≈ 83) — no monotone log or logistic line
 * fit across all 262 slots can sit that low up top and still fit the tail, so
 * the clamped fit expected a perfect 100 from picks 1–5 and no top-5 pick could
 * ever post a positive over slot. Empirically the residual bias per slot bucket
 * fell from 16.9 points to 4.5 when this smoother replaced the line.
 */

import baselineData from '../data/draft-slot-baseline.json';
import type { DraftPick } from '../types';
import {
  getPlayerDraftScore,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/** One point on the expectation curve: the score expected at this draft slot. */
export interface DraftSlotKnot {
  overallPick: number;
  expected: number;
}

/**
 * The expectation curve, as knots in ascending pick order with non-increasing
 * expectations. Evaluated by log-space interpolation (see {@link expectedScore}).
 */
export interface DraftSlotCurve {
  knots: DraftSlotKnot[];
}

/** One pick's draft slot and the score it actually earned. */
export interface DraftSlotPoint {
  overallPick: number;
  score: number;
}

/**
 * Draft slots the curve is evaluated at — dense early, where a handful of picks
 * separates a franchise quarterback from a bust, and sparse in the late rounds
 * where slots are nearly interchangeable. Knots outside the observed pick range
 * are dropped and replaced by the range's own endpoints (see
 * {@link fitDraftSlotCurve}).
 */
export const DRAFT_SLOT_KNOT_PICKS = [
  1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 150,
  180, 210, 240,
] as const;

/**
 * Smoothing bandwidth, in units of `ln(overallPick)`. Wide enough that each knot
 * pools several nearby slots (30-odd picks per top-10 bucket is a thin sample),
 * narrow enough to keep the shape. Fit quality is flat across 0.15–0.5, so this
 * is a mid-range default rather than a tuned optimum.
 */
export const DRAFT_SLOT_BANDWIDTH = 0.25;

/**
 * Local-linear (LOESS-style) regression evaluated at `logPick`. Local *linear*
 * rather than a local mean because the plain weighted average is biased at the
 * ends of the range — exactly the top-of-draft region the curve exists to get
 * right. Falls back to the weighted mean when the local design is degenerate
 * (all weight at a single slot).
 */
function localLinearAt(points: DraftSlotPoint[], logPick: number): number {
  let sumW = 0;
  let sumWx = 0;
  let sumWxx = 0;
  let sumWy = 0;
  let sumWxy = 0;

  for (const point of points) {
    const dx = Math.log(point.overallPick) - logPick;
    const w = Math.exp(-0.5 * (dx / DRAFT_SLOT_BANDWIDTH) ** 2);
    sumW += w;
    sumWx += w * dx;
    sumWxx += w * dx * dx;
    sumWy += w * point.score;
    sumWxy += w * dx * point.score;
  }

  if (sumW === 0) return 0;
  // Intercept of the locally weighted line, i.e. its value at `logPick`.
  const determinant = sumW * sumWxx - sumWx * sumWx;
  if (Math.abs(determinant) < 1e-9) return sumWy / sumW;
  return (sumWxx * sumWy - sumWx * sumWxy) / determinant;
}

/**
 * Pool-adjacent-violators, in place: replaces any rising run with its mean so
 * the curve never expects a later pick to outscore an earlier one. Local sample
 * noise (picks 6–10 slightly outscoring picks 2–5, on 30 picks each) would
 * otherwise show up as a pick being "expected" to do better than the one ahead
 * of it, which no reader would accept as an expectation.
 */
function enforceNonIncreasing(values: number[]): void {
  for (let i = 1; i < values.length; i++) {
    if (values[i] <= values[i - 1]) continue;
    let sum = values[i] + values[i - 1];
    let count = 2;
    while (i - count >= 0 && sum / count > values[i - count]) {
      sum += values[i - count];
      count++;
    }
    values.fill(sum / count, i - count + 1, i + 1);
  }
}

/** The draft slots to place knots at, given the range the points actually cover. */
function knotPicksFor(points: DraftSlotPoint[]): number[] {
  const picks = points.map((p) => p.overallPick);
  const first = Math.min(...picks);
  const last = Math.max(...picks);
  if (first === last) return [first];
  return [
    first,
    ...DRAFT_SLOT_KNOT_PICKS.filter((k) => k > first && k < last),
    last,
  ];
}

/**
 * Fit the empirical slot-expectation curve: smooth the observed scores over
 * `ln(overallPick)`, force the result non-increasing, and clamp it to the 0–100
 * score scale so expectations stay comparable to a real pick's score.
 */
export function fitDraftSlotCurve(points: DraftSlotPoint[]): DraftSlotCurve {
  if (points.length === 0) return { knots: [] };

  const knotPicks = knotPicksFor(points);
  const expectations = knotPicks.map((overallPick) =>
    localLinearAt(points, Math.log(overallPick)),
  );
  enforceNonIncreasing(expectations);

  return {
    knots: knotPicks.map((overallPick, i) => ({
      overallPick,
      expected: Math.min(100, Math.max(0, expectations[i])),
    })),
  };
}

/**
 * Expected draft score at `overallPick`, interpolated linearly between knots in
 * log-pick space (the space the curve was fit in) and held flat beyond the
 * fitted range.
 */
export function expectedScore(
  curve: DraftSlotCurve,
  overallPick: number,
): number {
  const { knots } = curve;
  if (knots.length === 0) return 0;

  const first = knots[0];
  const last = knots[knots.length - 1];
  if (overallPick <= first.overallPick) return first.expected;
  if (overallPick >= last.overallPick) return last.expected;

  const logPick = Math.log(overallPick);
  for (let i = 1; i < knots.length; i++) {
    const high = knots[i];
    if (logPick > Math.log(high.overallPick)) continue;
    const low = knots[i - 1];
    const logLow = Math.log(low.overallPick);
    const t = (logPick - logLow) / (Math.log(high.overallPick) - logLow);
    return low.expected + (high.expected - low.expected) * t;
  }
  return last.expected;
}

/** The shipped curve, derived by `scripts/derive-draft-slot-baseline.ts`. */
const SHIPPED_CURVE: DraftSlotCurve = { knots: baselineData.knots };

/** Expected draft score for the slot a pick was taken at, on the shipped curve. */
export function expectedScoreForPick(overallPick: number): number {
  return expectedScore(SHIPPED_CURVE, overallPick);
}

/**
 * A pick's draft score *above what its draft slot predicted* ("over slot"):
 * positive means the pick outplayed its draft position (a steal), negative means
 * it fell short (a reach). This isolates drafting skill from draft capital — the
 * raw score alone rewards merely holding early picks. Uses the same season basis
 * as {@link getPlayerDraftScore}, so it subtracts cleanly from the shown score.
 */
export function getPlayerDraftSkill(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): number {
  return (
    getPlayerDraftScore(pick, options) - expectedScoreForPick(pick.overallPick)
  );
}
