import type { DraftPick, Role } from '../types';
import { classifyRole } from './classifyRole';
import { ROLE_SCORE_WEIGHTS } from './roleWeights';
import { snapShareForRoleTier } from './snapShareForTier';

const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

function ordinal(r: Role): number {
  return ROLE_ORDER.indexOf(r);
}

function getFilteredSeasons(
  pick: DraftPick,
  draftingTeamOnly: boolean | undefined,
) {
  return draftingTeamOnly === true
    ? pick.seasons.filter((s) => s.retained)
    : pick.seasons;
}

/**
 * Best single-season role (ordinal max). Used to split Core Starter vs
 * Starter when healthy when average score is in the starter band.
 */
function getPlayerPeakRole(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): Role {
  const seasons = getFilteredSeasons(pick, options?.draftingTeamOnly);
  if (seasons.length === 0) return 'non_contributor';

  let best: Role = 'non_contributor';
  for (const s of seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(
      snapShareForRoleTier(s),
      gamesPlayedShare,
      s.gamesPlayed,
    );
    if (ordinal(role) > ordinal(best)) best = role;
  }
  return best;
}

/**
 * Map mean seasonal score weight to a representative Role for badges and filters.
 * Starter band (>= 2.5) uses peak role so Core Starter vs Starter when healthy
 * stays consistent with the player’s best seasons.
 */
function averageScoreWeightToRole(avgWeight: number, peakRole: Role): Role {
  if (avgWeight < 0.5) return 'non_contributor';
  if (avgWeight < 1.5) return 'depth';
  if (avgWeight < 2.5) return 'significant_contributor';
  if (peakRole === 'core_starter' || peakRole === 'starter_when_healthy') {
    return peakRole;
  }
  return 'significant_contributor';
}

export interface GetPlayerRoleOptions {
  /** When true, only consider seasons when player was with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Mean of each season’s role weight (0–3). Drives draft score; down-weights
 * mixed or inactive years versus a single peak season.
 */
export function getPlayerAverageScoreWeight(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): number {
  const seasons = getFilteredSeasons(pick, options?.draftingTeamOnly);
  if (seasons.length === 0) return 0;

  let sum = 0;
  for (const s of seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(
      snapShareForRoleTier(s),
      gamesPlayedShare,
      s.gamesPlayed,
    );
    sum += ROLE_SCORE_WEIGHTS[role];
  }
  return sum / seasons.length;
}

/**
 * Representative overall role from **average** seasonal value (badges, filters,
 * draft-class bucket counts). Uses peak role only to label the top tier
 * (Core Starter vs Starter when healthy).
 */
export function getPlayerRole(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): Role {
  const seasons = getFilteredSeasons(pick, options?.draftingTeamOnly);
  if (seasons.length === 0) return 'non_contributor';

  const avg = getPlayerAverageScoreWeight(pick, options);
  const peak = getPlayerPeakRole(pick, options);
  return averageScoreWeightToRole(avg, peak);
}
