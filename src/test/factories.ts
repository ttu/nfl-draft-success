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
 * - `draftYear` matches the default season and class year, so a pick, its
 *   seasons and its class agree unless a test says otherwise. Scoring divides by
 *   the rookie-contract window measured from this year (see `rookieWindow`), so
 *   fixtures that care about tenure set it explicitly.
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
    draftYear: 2023,
    seasons: [],
    ...overrides,
  };
}

/**
 * A draft class whose picks all carry its year.
 *
 * In production `loadData` stamps every pick with the year of the file it came
 * from, so `pick.draftYear === class.year` always holds. The factory reproduces
 * that rather than leaving each pick on its own default, which would let a
 * fixture pair a 2021 class with 2023 picks — a shape the app can never load,
 * and one that now silently changes scores, since the rookie-contract window is
 * measured from `draftYear`.
 *
 * Stamps in place, exactly as `stampDraftYear` does, so a fixture that holds a
 * reference to a pick it passed in still sees the same object.
 */
export function makeDraftClass(
  overrides: Partial<DraftClass> = {},
): DraftClass {
  const cls = {
    year: 2023,
    picks: [],
    ...overrides,
  };
  for (const pick of cls.picks) pick.draftYear = cls.year;
  return cls;
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
