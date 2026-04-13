import type { Role } from '../types';

/** Weight used in draft score (0–4; same value for both starter roles). */
export const ROLE_SCORE_WEIGHTS: Record<Role, number> = {
  core_starter: 4,
  starter_when_healthy: 4,
  significant_contributor: 3,
  contributor: 2,
  depth: 1,
  non_contributor: 0,
};
