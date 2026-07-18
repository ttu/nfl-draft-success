import type { DraftClass, DraftPick } from '../types';
import { rawSnapShareForRoleTier } from './snapShareForTier';
import {
  BASELINE_FLOOR,
  BASELINE_PERCENTILE,
  MIN_QUALIFYING_SEASONS,
  QUALIFYING_GAMES_SHARE,
  isBaselineExemptPosition,
} from './positionBaseline';

/**
 * Derivation of the per-position snap-share baselines that
 * `positionBaseline.ts` consumes. `scripts/derive-position-baselines.ts` is a
 * thin I/O wrapper around this module.
 *
 * **Invariant: derivation reads RAW snap share.** It must never consume
 * `rawSnapShareForRoleTier`, which divides by the baselines this produces — that
 * feedback loop collapses every position to 1.0 on a single run and silently
 * disables position adjustment. Keeping the logic here, on plain inputs, makes
 * the invariant testable.
 */

export interface DerivedBaselines {
  /** Full-time-starter snap share per position label (0–1]. */
  baselines: Record<string, number>;
  /** Positions left out for lack of a usable sample, as `LABEL (n=N)`. */
  skipped: string[];
}

/** Linear-interpolated percentile of an unsorted sample. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Raw tier snap share for each of a pick's seasons that clears the availability
 * bar. A season with no team games recorded cannot be judged either way.
 */
export function qualifyingSeasonShares(pick: DraftPick): number[] {
  const shares: number[] = [];

  for (const season of pick.seasons) {
    if (season.teamGames <= 0) continue;
    if (season.gamesPlayed / season.teamGames < QUALIFYING_GAMES_SHARE) {
      continue;
    }
    shares.push(rawSnapShareForRoleTier(season, pick.position));
  }

  return shares;
}

/**
 * Collect the raw tier snap share of every qualifying season, grouped by the
 * draft position label — the same vocabulary scoring looks baselines up by.
 * Seasons below {@link QUALIFYING_GAMES_SHARE} availability are too small a
 * sample to describe what a position's snap load looks like.
 */
export function collectSharesByPosition(
  classes: DraftClass[],
): Map<string, number[]> {
  const sharesByPosition = new Map<string, number[]>();

  for (const draftClass of classes) {
    for (const pick of draftClass.picks) {
      if (isBaselineExemptPosition(pick.position)) continue;
      const shares = qualifyingSeasonShares(pick);
      if (shares.length === 0) continue;
      const list = sharesByPosition.get(pick.position);
      if (list) list.push(...shares);
      else sharesByPosition.set(pick.position, shares);
    }
  }

  return sharesByPosition;
}

/**
 * Reduce each position's samples to a single baseline. Positions with too few
 * qualifying seasons are reported as `skipped` rather than given a baseline
 * derived from noise.
 */
export function deriveBaselines(
  sharesByPosition: Map<string, number[]>,
): DerivedBaselines {
  const baselines: Record<string, number> = {};
  const skipped: string[] = [];

  for (const [position, shares] of [...sharesByPosition].sort()) {
    if (shares.length < MIN_QUALIFYING_SEASONS) {
      skipped.push(`${position} (n=${shares.length})`);
      continue;
    }
    const raw = percentile(shares, BASELINE_PERCENTILE);
    // Round to 3dp for a readable, diff-friendly artifact.
    baselines[position] =
      Math.round(Math.max(raw, BASELINE_FLOOR) * 1000) / 1000;
  }

  return { baselines, skipped };
}

/** Baselines for a whole dataset of draft classes. */
export function deriveBaselinesFromClasses(
  classes: DraftClass[],
): DerivedBaselines {
  return deriveBaselines(collectSharesByPosition(classes));
}
