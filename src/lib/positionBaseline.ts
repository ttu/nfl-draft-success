import baselinesData from '../data/position-baselines.json';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';
import {
  CORE_TIER_THRESHOLD,
  SIGNIFICANT_TIER_THRESHOLD,
  SIGNIFICANT_TIER_THRESHOLD_SPECIALIST,
  DEPTH_TIER_THRESHOLD,
} from './classifyRole';

/**
 * Position-adjusted snap scoring.
 *
 * Snap share is not position-neutral: a full-time offensive lineman plays ~100%
 * of snaps, a lead running back ~50–65%, a rotational defensive tackle ~45–60%.
 * The role thresholds (Core Starter >= 65%, etc.) were therefore ~6x harder to
 * clear at RB than at QB. We rescale each season's snap share by a per-position
 * BASELINE — the workload of a clearly full-time starter at that position — so
 * "Core Starter" means the same thing everywhere.
 *
 * Baselines live in `src/data/position-baselines.json`, derived from the actual
 * draft dataset by `scripts/derive-position-baselines.ts`. See
 * docs/calculations.md and
 * docs/superpowers/specs/2026-07-17-position-adjusted-snap-scoring-research.md.
 */

/** Derivation parameters — shared by the script and the tests. */
export const QUALIFYING_GAMES_SHARE = 0.5;
export const BASELINE_PERCENTILE = 0.9;
export const MIN_QUALIFYING_SEASONS = 25;
/** Guards tiny/odd samples from producing an implausibly low baseline. */
export const BASELINE_FLOOR = 0.35;

const BASELINES: Record<string, number> = baselinesData.baselines;

function normalizePosition(position: string | undefined): string {
  return (position ?? '').trim().toUpperCase();
}

/**
 * Kickers, punters and long snappers are exempt: snap share is measured against
 * a scrimmage-shaped denominator and does not describe specialist workload at
 * all, so rescaling it would be meaningless. They keep raw (unnormalized) shares
 * and their existing role carve-out (`classifyRole`'s specialist SC threshold).
 */
export function isBaselineExemptPosition(
  position: string | undefined,
): boolean {
  return isSpecialTeamsSpecialistPosition(undefined, position);
}

/**
 * Full-time-starter snap share for a position (0–1]. Returns 1 — i.e. no
 * rescaling — for exempt specialists, unknown positions, and any position with
 * too small a sample to derive a baseline. Never returns 0 (safe as a divisor).
 */
export function getPositionBaseline(position: string | undefined): number {
  if (isBaselineExemptPosition(position)) return 1;
  const base = BASELINES[normalizePosition(position)];
  return base && base > 0 ? base : 1;
}

/**
 * Rescale a raw snap share into "share of a full-time starter's workload" at the
 * given position, clamped to [0, 1]. This is the value role classification and
 * the season score consume. Exempt/unknown positions pass through unchanged.
 */
export function normalizeSnapShareForPosition(
  snapShare: number,
  position: string | undefined,
): number {
  const scaled = snapShare / getPositionBaseline(position);
  if (scaled < 0) return 0;
  if (scaled > 1) return 1;
  return scaled;
}

/** Raw-snap-share band floors (0–1) for a position, for UI display. */
export interface PositionTierThresholds {
  /** Core Starter / Starter-when-healthy floor. */
  core: number;
  /** Significant Contributor floor. */
  significant: number;
  /** Depth floor; below this is Non-Contributor. */
  depth: number;
}

/**
 * Concrete raw-snap-share thresholds for a position — the normalized tier floors
 * scaled back up by the position baseline (so the UI can show "a RB is a Core
 * Starter at ~42% of snaps"). Passing an unknown/undefined position yields the
 * generic, unscaled rule (65% / 35% / 10%). Baseline-exempt specialists (K/P/LS)
 * are unscaled but use their lower Significant floor.
 */
export function getPositionTierThresholds(
  position: string | undefined,
): PositionTierThresholds {
  const baseline = getPositionBaseline(position);
  const significantFloor = isBaselineExemptPosition(position)
    ? SIGNIFICANT_TIER_THRESHOLD_SPECIALIST
    : SIGNIFICANT_TIER_THRESHOLD;
  return {
    core: CORE_TIER_THRESHOLD * baseline,
    significant: significantFloor * baseline,
    depth: DEPTH_TIER_THRESHOLD * baseline,
  };
}

/** Draft position labels that have a derived baseline, ordered high → low. */
export function baselinePositions(): string[] {
  return Object.keys(BASELINES).sort(
    (a, b) => (BASELINES[b] ?? 0) - (BASELINES[a] ?? 0),
  );
}
