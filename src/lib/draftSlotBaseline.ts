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
 * The expectation curve is a log-linear least-squares fit — draft value curves
 * are roughly logarithmic in pick number — fit from mature classes by
 * `scripts/derive-draft-slot-baseline.ts` and stored in
 * `src/data/draft-slot-baseline.json`.
 */

import baselineData from '../data/draft-slot-baseline.json';
import type { DraftPick } from '../types';
import {
  getPlayerDraftScore,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/** Coefficients of the fit `expected = a + b·ln(overallPick)`. */
export interface DraftSlotFit {
  a: number;
  b: number;
}

/** One pick's draft slot and the score it actually earned. */
export interface DraftSlotPoint {
  overallPick: number;
  score: number;
}

/**
 * Ordinary least squares of `score` on `ln(overallPick)`. Returns a flat line at
 * the mean score (`b = 0`) when there is no usable variance in the x values
 * (fewer than two distinct picks), so the fit degrades gracefully instead of
 * dividing by zero.
 */
export function fitDraftSlotBaseline(points: DraftSlotPoint[]): DraftSlotFit {
  const n = points.length;
  if (n === 0) return { a: 0, b: 0 };

  const xs = points.map((p) => Math.log(p.overallPick));
  const ys = points.map((p) => p.score);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    sxy += dx * (ys[i] - meanY);
    sxx += dx * dx;
  }

  if (sxx === 0) return { a: meanY, b: 0 };
  const b = sxy / sxx;
  return { a: meanY - b * meanX, b };
}

/**
 * Expected draft score for a pick at `overallPick`, clamped to the 0–100 score
 * scale so the top of the curve (which the fit can extrapolate above 100) and
 * the deepest picks stay comparable to a real pick's score.
 */
export function expectedScore(fit: DraftSlotFit, overallPick: number): number {
  const value = fit.a + fit.b * Math.log(overallPick);
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** The shipped fit, derived by `scripts/derive-draft-slot-baseline.ts`. */
const SHIPPED_FIT: DraftSlotFit = { a: baselineData.a, b: baselineData.b };

/** Expected draft score for the slot a pick was taken at, on the shipped curve. */
export function expectedScoreForPick(overallPick: number): number {
  return expectedScore(SHIPPED_FIT, overallPick);
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
