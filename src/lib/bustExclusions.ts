/**
 * Picks held off the "biggest busts" list because their career ended for a
 * reason outside football.
 *
 * Ranking busts by over slot (see {@link getLeagueHighlights}) removed the
 * round-1 filter, which had been incidentally hiding these players — a pick who
 * never took a snap scores 0 against his slot's expectation, so a career that
 * ended before it started lands near the top of the list. Calling that a draft
 * failure is wrong on the facts as well as tasteless: the team's evaluation was
 * never tested.
 *
 * Scope is deliberately narrow. Death and non-football medical conditions only;
 * a career derailed by a football injury is a genuine draft outcome (durability
 * is scouted), and so is one ended by off-field conduct (character is scouted).
 * Those stay on the list.
 *
 * No nflverse feed carries this, so `src/data/bust-exclusions.json` is
 * hand-maintained. Steals are unaffected — a player who produced before his
 * career ended keeps that credit.
 */

import exclusionsData from '../data/bust-exclusions.json';
import type { BustExclusionsData } from '../types';

/** Why a pick is kept off the busts list. */
export const BUST_EXCLUSION_REASONS = [
  'death',
  'non_football_medical',
] as const;

export type BustExclusionReason = (typeof BUST_EXCLUSION_REASONS)[number];

/** One curated exclusion, with the reason recorded for review. */
export interface BustExclusion {
  playerId: string;
  playerName: string;
  reason: BustExclusionReason;
  /** One-line justification, so entries can be audited without outside context. */
  detail: string;
}

/** The curated exclusion list. */
export const BUST_EXCLUSIONS: readonly BustExclusion[] = (
  exclusionsData as BustExclusionsData
).exclusions.map((entry) => ({
  ...entry,
  reason: asReason(entry.reason, entry.playerId),
}));

/** Narrows a JSON reason string, failing loudly on a typo in the data file. */
function asReason(reason: string, playerId: string): BustExclusionReason {
  const known = BUST_EXCLUSION_REASONS.find((r) => r === reason);
  if (known === undefined) {
    throw new Error(
      `bust-exclusions.json: unknown reason "${reason}" for ${playerId}. ` +
        `Expected one of: ${BUST_EXCLUSION_REASONS.join(', ')}.`,
    );
  }
  return known;
}

const EXCLUDED_IDS = new Set(BUST_EXCLUSIONS.map((e) => e.playerId));

/** True when this pick must not appear on the busts list. */
export function isBustExcluded(playerId: string): boolean {
  return EXCLUDED_IDS.has(playerId);
}
