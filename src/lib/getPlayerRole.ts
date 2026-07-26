import type { DraftPick, Role } from '../types';
import { classifyRole } from './classifyRole';
import { getSeasonScore } from './getSeasonScore';
import { ROLE_SCORE_WEIGHTS } from './roleWeights';
import { snapShareForRoleTier } from './snapShareForTier';

const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'contributor',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

function ordinal(r: Role): number {
  return ROLE_ORDER.indexOf(r);
}

export function getFilteredSeasons(
  pick: DraftPick,
  draftingTeamOnly: boolean | undefined,
) {
  return draftingTeamOnly === true
    ? pick.seasons.filter((s) => s.retained)
    : pick.seasons;
}

export interface GetPlayerRoleOptions {
  /** When true, only consider seasons when player was with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Per-pick memo tables for the two exported hot paths, indexed by
 * `draftingTeamOnly` (0 = false, 1 = true) so the two settings never share an
 * entry.
 *
 * The league-wide aggregates each walk every pick — team rankings alone scores
 * all of them once per team — so the same pick is scored hundreds of times per
 * render. Keyed weakly on pick identity: entries die with the draft class, and
 * two picks that merely share a `playerId` stay distinct.
 *
 * Sound only because a pick is immutable once loaded. Nothing in the app
 * mutates one, and {@link loadData} hands out shared frozen-by-convention
 * objects; if that ever changes, this cache goes stale.
 */
const scoreByPick = [
  new WeakMap<DraftPick, number>(),
  new WeakMap<DraftPick, number>(),
] as const;
const roleByPick = [
  new WeakMap<DraftPick, Role>(),
  new WeakMap<DraftPick, Role>(),
] as const;

// Lookups are written out at each call site rather than behind a
// `memoized(table, pick, compute)` helper: the helper allocated a closure per
// call, and at a few thousand calls per aggregate that cost more than the
// recomputation it saved.

/**
 * True when the pick has any season rows in the dataset.
 * Rolling score / “tracked” counts use this so picks with only non-retained
 * seasons (e.g. traded before playing for the drafting team) are not treated
 * as “no data.” Role and weight math still respect `draftingTeamOnly` via
 * {@link getFilteredSeasons}.
 */
export function pickHasSeasonSnapData(pick: DraftPick): boolean {
  return pick.seasons.length > 0;
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
      snapShareForRoleTier(s, pick.position),
      gamesPlayedShare,
      s.gamesPlayed,
      pick.position,
    );
    if (ordinal(role) > ordinal(best)) best = role;
  }
  return best;
}

/**
 * Map mean seasonal score weight to a representative Role for badges and filters.
 * Starter band (mean ≥ 3.5) uses peak role so Core Starter vs Starter when healthy
 * stays consistent with the player’s best seasons.
 */
function averageScoreWeightToRole(avgWeight: number, peakRole: Role): Role {
  if (avgWeight < 0.5) return 'non_contributor';
  if (avgWeight < 1.5) return 'depth';
  if (avgWeight < 2.5) return 'contributor';
  if (avgWeight < 3.5) return 'significant_contributor';
  if (peakRole === 'core_starter' || peakRole === 'starter_when_healthy') {
    return peakRole;
  }
  return 'significant_contributor';
}

/**
 * Mean of each season’s role weight (0–4). Drives draft score; down-weights
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
      snapShareForRoleTier(s, pick.position),
      gamesPlayedShare,
      s.gamesPlayed,
      pick.position,
    );
    sum += ROLE_SCORE_WEIGHTS[role];
  }
  return sum / seasons.length;
}

/**
 * Continuous per-pick draft score on a 0–100 scale:
 *
 *   score(pick) = mean(getSeasonScore(season) for tracked seasons)
 *
 * where each season term is the position-adjusted, availability-weighted
 * {@link getSeasonScore}. Unlike {@link getPlayerAverageScoreWeight} (discrete
 * 0–4 role weights, used for role badges), this does not saturate — it
 * separates a full-snap starter from a part-time one. Drives the numeric
 * "Score" shown in the player, position, draft-year, and team-ranking views.
 */
export function getPlayerDraftScore(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): number {
  const draftingTeamOnly = options?.draftingTeamOnly === true;
  const table = scoreByPick[draftingTeamOnly ? 1 : 0];
  const hit = table.get(pick);
  if (hit !== undefined) return hit;

  const value = computePlayerDraftScore(pick, draftingTeamOnly);
  table.set(pick, value);
  return value;
}

function computePlayerDraftScore(
  pick: DraftPick,
  draftingTeamOnly: boolean,
): number {
  const seasons = getFilteredSeasons(pick, draftingTeamOnly);
  if (seasons.length === 0) return 0;

  let sum = 0;
  for (const s of seasons) {
    sum += getSeasonScore(s, pick.position);
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
  const draftingTeamOnly = options?.draftingTeamOnly === true;
  const table = roleByPick[draftingTeamOnly ? 1 : 0];
  const hit = table.get(pick);
  if (hit !== undefined) return hit;

  const value = computePlayerRole(pick, draftingTeamOnly);
  table.set(pick, value);
  return value;
}

function computePlayerRole(pick: DraftPick, draftingTeamOnly: boolean): Role {
  const seasons = getFilteredSeasons(pick, draftingTeamOnly);
  if (seasons.length === 0) return 'non_contributor';

  const options = { draftingTeamOnly };
  const avg = getPlayerAverageScoreWeight(pick, options);
  const peak = getPlayerPeakRole(pick, options);
  return averageScoreWeightToRole(avg, peak);
}
