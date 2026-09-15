import type { FreeAgent, FreeAgentClass } from '../types';
import { withoutRestGame } from './restGame';
import { hydrateAcquisitionSeasons } from './trailingSeasons';

/**
 * A free-agent class as it exists in `fa-{year}.json`: the stored shape, minus
 * the `draftYear` that is stamped at parse time.
 *
 * Mirrors `RawDraftClass` deliberately — see `stampDraftYear` for why the year
 * is stamped per player rather than read from the enclosing class at score
 * time, and why rest-game subtraction belongs at this single parse point. The
 * same reasoning applies here: a free agent's class year is the season he
 * first debuted, not the year he signed, and scoring needs it per player.
 */
export interface RawFreeAgentClass {
  year: number;
  /** See {@link ./draftClass.RawDraftClass.seasonsThrough}. */
  seasonsThrough?: number;
  freeAgents: Omit<FreeAgent, 'draftYear'>[];
}

/**
 * Prepares a freshly-parsed free-agent class: stamps each player's class year
 * (the season he debuted) and subtracts any rested finale from his seasons.
 *
 * Every path that parses `fa-{year}.json` must call this. A missed call leaves
 * `draftYear` undefined and scores the class `NaN`.
 */
export function stampFreeAgentYear(cls: RawFreeAgentClass): FreeAgentClass {
  const stamped = cls as FreeAgentClass;
  for (const fa of stamped.freeAgents) {
    fa.draftYear = stamped.year;
    fa.seasons = hydrateAcquisitionSeasons(
      fa.seasons,
      fa.teamId,
      stamped.year,
      stamped.seasonsThrough,
    ).map(withoutRestGame);
  }
  return stamped;
}
