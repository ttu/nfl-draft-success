import type { DraftClass } from '../types';
import { getPlayerDraftScore, pickHasSeasonSnapData } from './getPlayerRole';
import {
  fitDraftSlotCurve,
  type DraftSlotCurve,
  type DraftSlotPoint,
} from './draftSlotBaseline';

/**
 * A draft class is only used to fit the slot-expectation curve once it is at
 * least this many years old, so "expected" reflects a settled career rather than
 * a single rookie season (recent classes score low across every slot and would
 * bias the whole curve down).
 */
export const DRAFT_SLOT_MATURITY_LAG = 3;

/**
 * The pick score the curve is fit against — the same basis the shipped rankings
 * use ({@link getPlayerDraftScore} over drafting-team seasons), so a team's
 * "over slot" residual is directly comparable to its raw score.
 */
const FIT_SCORE_OPTIONS = { draftingTeamOnly: true } as const;

/** Latest draft year across the classes, or `-Infinity` when there are none. */
function latestDraftYear(classes: DraftClass[]): number {
  return classes.reduce((max, c) => Math.max(max, c.year), -Infinity);
}

/**
 * One `(overallPick, score)` point per scored pick from every class old enough
 * to have matured (see {@link DRAFT_SLOT_MATURITY_LAG}). Picks with no season
 * rows yet are skipped — they carry no signal about their slot.
 */
export function collectMatureDraftSlotPoints(
  classes: DraftClass[],
): DraftSlotPoint[] {
  const cutoff = latestDraftYear(classes) - DRAFT_SLOT_MATURITY_LAG;
  const points: DraftSlotPoint[] = [];
  for (const draft of classes) {
    if (draft.year > cutoff) continue;
    for (const pick of draft.picks) {
      if (!pickHasSeasonSnapData(pick)) continue;
      points.push({
        overallPick: pick.overallPick,
        score: getPlayerDraftScore(pick, FIT_SCORE_OPTIONS),
      });
    }
  }
  return points;
}

/** The fitted slot-expectation curve plus the span and sample it was fit from. */
export interface DraftSlotDerivation {
  curve: DraftSlotCurve;
  pointCount: number;
  /** Earliest mature draft year contributing points, or null when none. */
  matureFrom: number | null;
  /** Latest mature draft year contributing points, or null when none. */
  matureTo: number | null;
}

/** Collect mature-class points and fit the empirical slot-expectation curve. */
export function deriveDraftSlotCurve(
  classes: DraftClass[],
): DraftSlotDerivation {
  const cutoff = latestDraftYear(classes) - DRAFT_SLOT_MATURITY_LAG;
  const matureYears = classes
    .filter((c) => c.year <= cutoff && c.picks.some(pickHasSeasonSnapData))
    .map((c) => c.year);
  const points = collectMatureDraftSlotPoints(classes);

  return {
    curve: fitDraftSlotCurve(points),
    pointCount: points.length,
    matureFrom: matureYears.length > 0 ? Math.min(...matureYears) : null,
    matureTo: matureYears.length > 0 ? Math.max(...matureYears) : null,
  };
}
