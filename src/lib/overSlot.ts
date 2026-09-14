import faBaseline from '../data/fa-baseline.json';
import type { Acquisition } from '../types';
import { isDraftPick } from './acquisition';
import { expectedScoreForPick } from './draftSlotBaseline';
import {
  getPlayerDraftScore,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/**
 * What an undrafted free agent is expected to earn: the cohort's own mean, from
 * `src/data/fa-baseline.json`. See {@link deriveFreeAgentBaseline} for why it
 * is one scalar rather than a curve.
 *
 * This scalar and the pick-slot curve in `draftSlotBaseline.ts` are not
 * expectations over the same population, and that asymmetry is deliberate, not
 * a bug to reconcile. The slot curve is fit over *every* pick with season
 * rows — including picks who never took a snap and score near 0 — because a
 * draft slot is assigned regardless of outcome. The free-agent cohort behind
 * this scalar was filtered to players who took at least one snap, because an
 * undrafted player who never made a roster generates no season row to begin
 * with; there is no equivalent "never played" population to average in. So the
 * free-agent baseline is a survivors-only mean and will read *higher* than the
 * expectation for a very late pick, even though free agents are on average
 * worse players than draft picks. Compare it against an early first-rounder's
 * expectation, not a seventh-rounder's, if you want the intuitive "free agents
 * are expected to do less" comparison to hold.
 */
export function expectedScoreForFreeAgent(): number {
  return faBaseline.expected;
}

/**
 * What this acquisition was expected to earn, given only how it was acquired:
 * the empirical slot curve for a pick, the cohort mean for a free agent.
 *
 * The dispatch lives here rather than at each call site so a UI row can show a
 * mixed list without branching, and so the two populations can never drift onto
 * different definitions of the residual.
 */
export function expectedScoreForAcquisition(a: Acquisition): number {
  return isDraftPick(a)
    ? expectedScoreForPick(a.overallPick)
    : expectedScoreForFreeAgent();
}

/**
 * Score above expectation ("over slot"): positive means the player outplayed
 * what his acquisition route predicted. Same units for picks and free agents.
 */
export function getAcquisitionOverSlot(
  a: Acquisition,
  options?: GetPlayerRoleOptions,
): number {
  return getPlayerDraftScore(a, options) - expectedScoreForAcquisition(a);
}
