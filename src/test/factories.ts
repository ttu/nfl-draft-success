import type { DraftClass, DraftPick, Season, Team } from '../types';

/**
 * Test data builders for the core draft types.
 *
 * Every factory returns a complete, valid object and takes a partial override,
 * so a test only spells out the fields it actually cares about. Defaults are
 * deliberately neutral:
 *
 * - Position defaults to `ZZ`, an unknown position whose snap baseline is 1.0,
 *   so scores come out un-adjusted by position. Tests that care about position
 *   adjustment (or that render a position label) pass one explicitly.
 * - Seasons default to a full 17-game team season, the shape most fixtures want.
 * - A pick defaults to no season rows — the "awaiting data" case — because
 *   season data is the thing tests vary most.
 */

/** A 16-of-17-game season at 90% snap share: classifies as `core_starter`. */
export function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    year: 2023,
    gamesPlayed: 16,
    teamGames: 17,
    snapShare: 0.9,
    retained: true,
    ...overrides,
  };
}

/** 3 of 17 games at 15% snap share: classifies as `depth`. */
export function makeDepthSeason(overrides: Partial<Season> = {}): Season {
  return makeSeason({
    gamesPlayed: 3,
    snapShare: 0.15,
    ...overrides,
  });
}

/** 1 of 17 games at 2% snap share: classifies as `non_contributor`. */
export function makeNonContributorSeason(
  overrides: Partial<Season> = {},
): Season {
  return makeSeason({
    gamesPlayed: 1,
    snapShare: 0.02,
    ...overrides,
  });
}

/**
 * A pick with no season rows (awaiting NFL data). Pass `seasons` to give it a
 * career; `playerId` and `playerName` derive from the overall pick so distinct
 * picks in one fixture stay distinguishable without spelling both out.
 */
export function makePick(overrides: Partial<DraftPick> = {}): DraftPick {
  const overallPick = overrides.overallPick ?? 1;
  return {
    playerId: `p-${overallPick}`,
    playerName: `Player ${overallPick}`,
    position: 'ZZ',
    round: 1,
    overallPick,
    teamId: 'KC',
    seasons: [],
    ...overrides,
  };
}

export function makeDraftClass(
  overrides: Partial<DraftClass> = {},
): DraftClass {
  return {
    year: 2023,
    picks: [],
    ...overrides,
  };
}

export function makeTeam(overrides: Partial<Team> = {}): Team {
  const id = overrides.id ?? 'KC';
  return {
    id,
    name: `Team ${id}`,
    abbreviation: id,
    ...overrides,
  };
}
