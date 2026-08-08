import type { DraftClass } from '../types';
import {
  getPlayerDraftScore,
  getPlayerRole,
  pickHasSeasonSnapData,
} from './getPlayerRole';
import { expectedScoreForPick } from './draftSlotBaseline';
import { isDraftPickRetainedLatest } from './draftPickLatestSeason';
import { getTeamPicks } from './picksByTeam';

export interface RollingDraftScore {
  score: number;
  /**
   * Mean pick score *above its draft-slot expectation* ("over slot"): drafting
   * value with draft capital removed. Positive means the team's picks outplayed
   * their draft positions on average. See {@link expectedScoreForPick}.
   */
  skillScore: number;
  /** Team picks in the loaded draft span (includes picks with no season rows yet). */
  totalPicks: number;
  /** Picks with at least one season row in the data (excludes only classes with no `seasons` yet). */
  scoredPickCount: number;
  coreStarterRate: number;
  retentionRate: number;
  /** Scored picks classified `core_starter` — the numerator of `coreStarterRate`. */
  coreStarterCount: number;
  /** Scored picks still with the drafting team — the numerator of `retentionRate`. */
  retainedCount: number;
}

/** A team's position in the league-wide draft-success ranking. */
export interface TeamRanking {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

export interface GetRollingDraftScoreOptions {
  /** When true, roles based only on seasons with drafting team */
  draftingTeamOnly?: boolean;
}

/**
 * Compute rolling draft score for a team over the loaded draft seasons
 * (whatever year range is in `draftClasses`, typically matching the app’s
 * selected season span).
 *
 *   score(team) = mean(getPlayerDraftScore(pick) for scored picks)
 *
 * i.e. the average continuous snap-based pick score (0–100) across the team's
 * scored picks. Retention is reported alongside it (`retentionRate`) as its own
 * signal rather than folded into the score, so the headline stays on a readable
 * 0–100 scale and the two dimensions — pick quality and roster retention — stay
 * separable. See the Info modal.
 */
export function getRollingDraftScore(
  draftClasses: DraftClass[],
  teamId: string,
  options?: GetRollingDraftScoreOptions,
): RollingDraftScore {
  const opts = { draftingTeamOnly: options?.draftingTeamOnly === true };

  const teamPicks = getTeamPicks(draftClasses, teamId);
  const scoredPicks = teamPicks.filter(pickHasSeasonSnapData);

  let scoreSum = 0;
  let skillSum = 0;
  let coreStarterCount = 0;
  let retentionCount = 0;
  for (const pick of scoredPicks) {
    const pickScore = getPlayerDraftScore(pick, opts);
    scoreSum += pickScore;
    skillSum += pickScore - expectedScoreForPick(pick.overallPick);
    if (getPlayerRole(pick, opts) === 'core_starter') coreStarterCount += 1;
    if (isDraftPickRetainedLatest(pick)) retentionCount += 1;
  }

  const totalPicks = teamPicks.length;
  const scoredPickCount = scoredPicks.length;
  const retentionRate =
    scoredPickCount > 0 ? retentionCount / scoredPickCount : 0;

  return {
    score: scoredPickCount > 0 ? scoreSum / scoredPickCount : 0,
    skillScore: scoredPickCount > 0 ? skillSum / scoredPickCount : 0,
    totalPicks,
    scoredPickCount,
    coreStarterRate:
      scoredPickCount > 0 ? coreStarterCount / scoredPickCount : 0,
    retentionRate,
    coreStarterCount,
    retainedCount: retentionCount,
  };
}
