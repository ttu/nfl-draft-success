import type { Role } from '../types';

/** Weight used in draft score (same value for both starter roles). */
export const ROLE_SCORE_WEIGHTS: Record<Role, number> = {
  core_starter: 3,
  starter_when_healthy: 3,
  significant_contributor: 2,
  depth: 1,
  non_contributor: 0,
};
