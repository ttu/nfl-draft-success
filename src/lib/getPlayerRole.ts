import type { DraftPick, Role } from '../types';
import { withoutApprenticeSeasons } from './apprenticeship';
import { classifyRole } from './classifyRole';
import { getSeasonScore } from './getSeasonScore';
import { ROLE_SCORE_WEIGHTS } from './roleWeights';
import { snapShareForRoleTier } from './snapShareForTier';
import { scoredSeasonCount } from './rookieWindow';
import { playedSeasons } from './seasonPlayed';

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

/**
 * The seasons a pick is judged on. Always played seasons only — a row for an
 * upcoming season records where the player stands, and scoring it would read
 * "has not played yet" as "did nothing".
 *
 * Seasons before {@link firstScoredYear} drop out too: a quarterback who sat
 * behind a veteran and then won the job was not failing during the wait (see
 * `apprenticeship.ts`). Applied in both modes — career mode has no window, so
 * there those seasons are simply absent from the mean. If sitting to learn was
 * not a failure, it was not a failure in either lens.
 *
 * This is the single choke point for scoring: `getPlayerDraftScore`,
 * `getPlayerAverageScoreWeight`, `getPlayerPeakRole`, `getPlayerRole` and
 * `explainDraftScore` all read their seasons from here.
 */
export function getFilteredSeasons(
  pick: DraftPick,
  draftingTeamOnly: boolean | undefined,
) {
  const played = withoutApprenticeSeasons(pick, playedSeasons(pick));
  return draftingTeamOnly === true ? played.filter((s) => s.retained) : played;
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
 * True when the pick has any *played* season rows in the dataset.
 * Rolling score / “tracked” counts use this so picks with only non-retained
 * seasons (e.g. traded before playing for the drafting team) are not treated
 * as “no data.” Role and weight math still respect `draftingTeamOnly` via
 * {@link getFilteredSeasons}.
 *
 * A row for an upcoming season does not count: a pick whose only row says
 * where he will line up is still awaiting data, not tracked.
 */
export function pickHasSeasonSnapData(pick: DraftPick): boolean {
  return playedSeasons(pick).length > 0;
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
      pick.position,
    );
    if (ordinal(role) > ordinal(best)) best = role;
  }
  return best;
}

/**
 * Band edges on the 0–4 badge value (see {@link getPlayerAverageScoreWeight}).
 *
 * The top edge is not 3.5, and the reason is worth keeping. Once the badge began
 * dividing by the rookie window rather than by seasons played, 3.5 meant a
 * first-rounder needed 4.4 core-starter seasons out of five to be called one —
 * four perfect years score 16 ÷ 5 = 3.2 and missed. That left 93 picks who
 * started every season they played badged below Core Starter, Sheldon Richardson
 * (four core seasons for the Jets, then traded) among them. The score already
 * charges the year the team did not get; having the badge charge it twice turned
 * a value measure into a mislabelling.
 *
 * 3.2 is exactly "core starter for four of your five contract years", and it
 * restores the Core Starter population to what it was before the denominator
 * moved — 26.5% of scored picks against 26.3% before. Narrowing that population
 * by a fifth was a side effect of the denominator change, never its intent.
 */
const DEPTH_BAND = 0.5;
const CONTRIBUTOR_BAND = 1.5;
const SIGNIFICANT_BAND = 2.5;
export const CORE_STARTER_BAND = 3.2;

/**
 * Map the badge value to a representative Role for badges and filters. The top
 * band uses peak role so Core Starter vs Starter when healthy stays consistent
 * with the player’s best seasons.
 */
function averageScoreWeightToRole(avgWeight: number, peakRole: Role): Role {
  if (avgWeight < DEPTH_BAND) return 'non_contributor';
  if (avgWeight < CONTRIBUTOR_BAND) return 'depth';
  if (avgWeight < SIGNIFICANT_BAND) return 'contributor';
  if (avgWeight < CORE_STARTER_BAND) return 'significant_contributor';
  if (peakRole === 'core_starter' || peakRole === 'starter_when_healthy') {
    return peakRole;
  }
  return 'significant_contributor';
}

/**
 * Mean of each season’s role weight (0–4). Drives the representative role badge;
 * down-weights mixed or inactive years versus a single peak season.
 *
 * Divided by the same denominator as {@link getPlayerDraftScore} — the rookie
 * window in drafting-team mode, seasons played in career mode. The two must
 * agree: while this averaged over seasons *played*, a pick who started as a
 * rookie and was then gone kept a Core Starter badge beside a score of 17,
 * because his unplayed years vanished from the badge but not from the score.
 * The badge also feeds `coreStarterRate`, so that disagreement reached the team
 * metrics and not just the chip.
 */
export function getPlayerAverageScoreWeight(
  pick: DraftPick,
  options?: GetPlayerRoleOptions,
): number {
  const draftingTeamOnly = options?.draftingTeamOnly === true;
  const seasons = getFilteredSeasons(pick, draftingTeamOnly);
  if (seasons.length === 0) return 0;

  let sum = 0;
  for (const s of seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(
      snapShareForRoleTier(s, pick.position),
      gamesPlayedShare,
      pick.position,
    );
    sum += ROLE_SCORE_WEIGHTS[role];
  }

  const denominator = draftingTeamOnly
    ? scoredSeasonCount(pick, seasons.length)
    : seasons.length;
  return sum / denominator;
}

/**
 * Continuous per-pick draft score on a 0–100 scale:
 *
 *   score(pick) = mean(getSeasonScore(season) for tracked seasons)
 *
 * where each season term is the position-adjusted, availability-weighted
 * {@link getSeasonScore}. Unlike {@link getPlayerAverageScoreWeight}, which
 * collapses a season onto one of five discrete role weights, this separates a
 * full-snap starter from a part-time one across most of the range. It does
 * saturate at the top: the snap term is clamped to the position's full-time
 * baseline, which pins the best ~5% of played seasons (9% at ≥0.95) at the
 * maximum. That is deliberate — an unclamped ratio would let one position's
 * outlier exceed 100 and break the over-slot subtraction — so above a full-time
 * workload the score declines to rank starters against each other on snap count
 * alone. Drives the numeric "Score" shown in the player, position, draft-year,
 * and team-ranking views.
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

  // Divide by the rookie-contract window, not by seasons played, so the score
  // measures volume rather than rate: a season the drafting team did not get
  // scores zero instead of vanishing from the average. Without this a starter
  // traded after three years and one who stayed six average identically.
  //
  // Career mode keeps the plain mean — its numerator spans every team the
  // player suited up for, so the *drafting* team's window would be a
  // denominator for seasons it never had a claim on.
  const denominator = draftingTeamOnly
    ? scoredSeasonCount(pick, seasons.length)
    : seasons.length;
  return sum / denominator;
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
