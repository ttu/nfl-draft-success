import type { FreeAgentClass } from '../types';
import { getPlayerDraftScore, pickHasSeasonSnapData } from './getPlayerRole';
import { DRAFT_SLOT_MATURITY_LAG } from './deriveDraftSlotBaseline';

/**
 * Fit in drafting-team mode, matching `FIT_SCORE_OPTIONS` in
 * `deriveDraftSlotBaseline.ts`. The two expectations must be fit on the same
 * basis or a free agent's residual and a pick's would not be comparable.
 */
const FIT_SCORE_OPTIONS = { draftingTeamOnly: true } as const;

/**
 * The score an undrafted free agent is *expected* to earn — the cohort's own
 * mean, over classes old enough to have played out their window.
 *
 * A single scalar rather than the per-slot curve picks get, because there is no
 * slot dimension here to vary along: position baselines already normalize load
 * before scoring, so what remains is one population with one expectation.
 *
 * Scored in drafting-team mode, matching how the draft-slot curve is fit, so
 * free-agent and pick over-slot are computed on the same basis and read
 * sensibly side by side.
 *
 * `latestDraftClassYear` is the reference the maturity cutoff is measured back
 * from, and it is deliberately a parameter rather than something derived from
 * `classes`. It must be the same reference `collectMatureDraftSlotPoints` uses
 * — the newest *draft* class — or the two expectations would disagree about
 * what "settled" means. Free-agent classes stop at the newest season anyone has
 * played, while draft classes run one year further, to the class drafted for the
 * upcoming season; taking the maximum over `classes` therefore lands a year
 * early and drops a debut class that has in fact played all three seasons of its
 * window. `scripts/derive-fa-baseline.ts` passes the latest `draft-{year}.json`
 * year, exactly what `scripts/derive-draft-slot-baseline.ts` fits against.
 *
 * Because it is the cohort's own mean, free-agent over-slot is centered on zero
 * by construction: it ranks teams against each other and can never say the
 * league as a whole is good or bad at signing undrafted players. The Info modal
 * states that.
 */
export function deriveFreeAgentBaseline(
  classes: FreeAgentClass[],
  latestDraftClassYear: number,
): {
  expected: number;
  playerCount: number;
  matureFrom: number | null;
  matureTo: number | null;
} {
  // Maturity measured back from the newest draft class, exactly as
  // `collectMatureDraftSlotPoints` measures it.
  const cutoff = latestDraftClassYear - DRAFT_SLOT_MATURITY_LAG;

  let sum = 0;
  let playerCount = 0;
  let matureFrom: number | null = null;
  let matureTo: number | null = null;
  for (const cls of classes) {
    if (cls.year > cutoff) continue;
    for (const fa of cls.freeAgents) {
      if (!pickHasSeasonSnapData(fa)) continue;
      sum += getPlayerDraftScore(fa, FIT_SCORE_OPTIONS);
      playerCount += 1;
      matureFrom =
        matureFrom == null ? cls.year : Math.min(matureFrom, cls.year);
      matureTo = matureTo == null ? cls.year : Math.max(matureTo, cls.year);
    }
  }

  return {
    expected: playerCount > 0 ? sum / playerCount : 0,
    playerCount,
    matureFrom,
    matureTo,
  };
}
