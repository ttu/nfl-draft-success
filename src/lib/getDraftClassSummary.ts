import type { DraftClass } from '../types';
import { isDraftPickRetainedLatest } from './draftPickLatestSeason';
import {
  getPlayerDraftScore,
  getPlayerRole,
  pickHasSeasonSnapData,
} from './getPlayerRole';

export interface DraftClassSummary {
  /** Picks with season data (excludes current-year picks awaiting NFL data). */
  tracked: number;
  /** Mean per-pick draft score (0–100) across tracked picks. */
  avgScore: number;
  /** Picks classified `core_starter`. */
  coreStarters: number;
  /** Picks classified `non_contributor` — true misses (excludes awaiting-data). */
  misses: number;
  /** QBs drafted across all rounds, including picks still awaiting data. */
  qbsTaken: number;
  /** WRs drafted across all rounds, including picks still awaiting data. */
  wrsTaken: number;
  /** Tracked picks still with the drafting team in their latest season. */
  retained: number;
  /** `retained / tracked`, or 0 when nothing is tracked. */
  retentionRate: number;
}

export interface GetDraftClassSummaryOptions {
  /** When true, roles/scores use only seasons with the drafting team. */
  draftingTeamOnly?: boolean;
}

/**
 * Whole-class summary metrics for a single draft year (all teams, all rounds).
 * Powers the draft-class view's summary tiles.
 */
export function getDraftClassSummary(
  draftClass: DraftClass,
  options?: GetDraftClassSummaryOptions,
): DraftClassSummary {
  const draftingTeamOnly = options?.draftingTeamOnly === true;

  let tracked = 0;
  let scoreSum = 0;
  let coreStarters = 0;
  let misses = 0;
  let qbsTaken = 0;
  let wrsTaken = 0;
  let retained = 0;

  for (const pick of draftClass.picks) {
    if (pick.position === 'QB') qbsTaken += 1;
    if (pick.position === 'WR') wrsTaken += 1;

    if (!pickHasSeasonSnapData(pick)) continue;

    tracked += 1;
    scoreSum += getPlayerDraftScore(pick, { draftingTeamOnly });

    const role = getPlayerRole(pick, { draftingTeamOnly });
    if (role === 'core_starter') coreStarters += 1;
    if (role === 'non_contributor') misses += 1;

    if (isDraftPickRetainedLatest(pick)) retained += 1;
  }

  return {
    tracked,
    avgScore: tracked > 0 ? scoreSum / tracked : 0,
    coreStarters,
    misses,
    qbsTaken,
    wrsTaken,
    retained,
    retentionRate: tracked > 0 ? retained / tracked : 0,
  };
}
