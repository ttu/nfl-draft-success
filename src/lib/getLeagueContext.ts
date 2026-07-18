import type { DraftClass, Team } from '../types';
import {
  getRollingDraftScore,
  type GetRollingDraftScoreOptions,
} from './getRollingDraftScore';
import { getDraftClassMetrics } from './getDraftClassMetrics';

/** League-wide share of scored picks in each of three role buckets. */
export interface LeagueRoleDistribution {
  /** core_starter + starter_when_healthy */
  coreCount: number;
  /** significant_contributor + contributor + depth */
  contributorCount: number;
  /** non_contributor */
  nonContributorCount: number;
  /** Total scored picks (sum of the three buckets). */
  total: number;
  /** Each bucket as a share of `total` (0–1); all zero when `total` is 0. */
  corePct: number;
  contributorPct: number;
  nonContributorPct: number;
}

/** Best- and worst-drafting teams and the gap between their scores. */
export interface LeagueSpread {
  topId: string;
  topScore: number;
  bottomId: string;
  bottomScore: number;
  /** topScore − bottomScore (≥ 0). */
  gap: number;
}

/** League-wide context that frames any single team's rolling score. */
export interface LeagueContext {
  /** Mean rolling score across teams with at least one scored pick (0 when none). */
  avgScore: number;
  /** Null when fewer than two teams have scored picks. */
  spread: LeagueSpread | null;
  roleDistribution: LeagueRoleDistribution;
}

/** A team's rolling score, carried alongside its id for ranking. */
interface ScoredTeam {
  teamId: string;
  score: number;
}

/** Best/worst teams by score. Null when fewer than two teams have scored picks. */
function getSpread(scoredTeams: ScoredTeam[]): LeagueSpread | null {
  if (scoredTeams.length < 2) return null;

  let top = scoredTeams[0];
  let bottom = scoredTeams[0];
  for (const t of scoredTeams) {
    if (t.score > top.score) top = t;
    if (t.score < bottom.score) bottom = t;
  }

  return {
    topId: top.teamId,
    topScore: top.score,
    bottomId: bottom.teamId,
    bottomScore: bottom.score,
    gap: top.score - bottom.score,
  };
}

/** Tally every scored pick across all classes and teams into role buckets. */
function getRoleDistribution(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetRollingDraftScoreOptions,
): LeagueRoleDistribution {
  let coreCount = 0;
  let contributorCount = 0;
  let nonContributorCount = 0;

  for (const draft of draftClasses) {
    for (const team of teams) {
      const m = getDraftClassMetrics(draft, team.id, options);
      coreCount += m.coreStarterCount + m.starterWhenHealthyCount;
      contributorCount +=
        m.significantContributorCount + m.contributorRoleCount + m.depthCount;
      nonContributorCount += m.nonContributorCount;
    }
  }

  const total = coreCount + contributorCount + nonContributorCount;
  return {
    coreCount,
    contributorCount,
    nonContributorCount,
    total,
    corePct: total > 0 ? coreCount / total : 0,
    contributorPct: total > 0 ? contributorCount / total : 0,
    nonContributorPct: total > 0 ? nonContributorCount / total : 0,
  };
}

/**
 * Aggregate league-wide context over the loaded draft classes: the average
 * rolling draft score, the spread between the best and worst teams, and the
 * distribution of every scored pick across three role buckets.
 *
 * Average and spread reuse {@link getRollingDraftScore}, so they match the
 * on-screen rankings list by construction. Only teams with at least one scored
 * pick count toward the average and spread; picks awaiting season data
 * contribute no role counts (consistent with {@link getDraftClassMetrics}).
 */
export function getLeagueContext(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetRollingDraftScoreOptions,
): LeagueContext {
  const scoredTeams = teams
    .map((t) => ({
      teamId: t.id,
      ...getRollingDraftScore(draftClasses, t.id, options),
    }))
    .filter((t) => t.scoredPickCount > 0);

  const avgScore =
    scoredTeams.length > 0
      ? scoredTeams.reduce((sum, t) => sum + t.score, 0) / scoredTeams.length
      : 0;

  return {
    avgScore,
    spread: getSpread(scoredTeams),
    roleDistribution: getRoleDistribution(draftClasses, teams, options),
  };
}
