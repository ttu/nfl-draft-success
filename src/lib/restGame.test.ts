import { describe, it, expect } from 'vitest';
import type { Season } from '../types';
import {
  MIN_REST_GAME_NORM_WEEKS,
  MIN_REST_GAME_REGULARS,
  REST_GAME_RATIO_THRESHOLD,
  detectRestGames,
  regularSeasonWeeks,
  withoutRestGame,
  type RestGameCsvRow,
} from './restGame';

/**
 * Snap rows for one team-week. `shares` maps player id to their per-game role
 * share; the team totals are fixed so percentages stay self-consistent.
 */
function week(
  team: string,
  wk: number,
  shares: Record<string, number>,
): RestGameCsvRow[] {
  return Object.entries(shares).map(([pfrId, share]) => ({
    game_id: `2023_${String(wk).padStart(2, '0')}_${team}`,
    team,
    week: String(wk),
    pfr_player_id: pfrId,
    offense_snaps: String(Math.round(share * 60)),
    offense_pct: String(share),
    defense_snaps: '0',
    defense_pct: '0',
    st_snaps: '0',
    st_pct: '0',
  }));
}

/** Twelve regulars, so a roster clears MIN_REST_GAME_REGULARS. */
function starters(share: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`S${i}`, share]),
  );
}

/**
 * A team playing weeks 1-18 with its starters at `finalShare` in week 18 and
 * full workloads before that, optionally followed by a postseason game.
 */
function seasonRows(options: {
  team: string;
  finalShare: number;
  playoffs: boolean;
  regularShare?: number;
  lastRegularWeek?: number;
}): RestGameCsvRow[] {
  const {
    team,
    finalShare,
    playoffs,
    regularShare = 0.95,
    lastRegularWeek = 18,
  } = options;
  const rows: RestGameCsvRow[] = [];
  for (let wk = 1; wk < lastRegularWeek; wk++) {
    rows.push(...week(team, wk, starters(regularShare)));
  }
  rows.push(...week(team, lastRegularWeek, starters(finalShare)));
  if (playoffs) {
    rows.push(...week(team, lastRegularWeek + 1, starters(regularShare)));
  }
  return rows;
}

describe('regularSeasonWeeks', () => {
  it('is 18 from 2021, when the NFL added the seventeenth game', () => {
    expect(regularSeasonWeeks(2021)).toBe(18);
    expect(regularSeasonWeeks(2023)).toBe(18);
  });

  it('is 17 before 2021', () => {
    expect(regularSeasonWeeks(2020)).toBe(17);
  });
});

describe('detectRestGames', () => {
  it('flags the finale when a playoff team sits its starters', () => {
    const rows = seasonRows({ team: 'BAL', finalShare: 0, playoffs: true });

    const rest = detectRestGames(rows, 2023);

    expect(rest.get('BAL')).toEqual({
      team: 'BAL',
      week: 18,
      gameId: '2023_18_BAL',
    });
  });

  it('leaves the finale alone when the playoff team played its starters', () => {
    const rows = seasonRows({ team: 'BAL', finalShare: 0.95, playoffs: true });

    expect(detectRestGames(rows, 2023).has('BAL')).toBe(false);
  });

  it('ignores a usage collapse on a team that missed the playoffs', () => {
    // Same shape as a rest week, but this team's season ended in week 18 —
    // a tanking or injury-wrecked roster, not a clinched one.
    const rows = seasonRows({ team: 'CHI', finalShare: 0, playoffs: false });

    expect(detectRestGames(rows, 2023).has('CHI')).toBe(false);
  });

  it('flags a partial rest, where starters take a token series', () => {
    const rows = seasonRows({ team: 'KC', finalShare: 0.2, playoffs: true });

    expect(detectRestGames(rows, 2023).get('KC')?.week).toBe(18);
  });

  it('does not flag a modest dip in the finale', () => {
    const rows = seasonRows({ team: 'KC', finalShare: 0.8, playoffs: true });

    expect(detectRestGames(rows, 2023).has('KC')).toBe(false);
  });

  it('judges each franchise separately, sparing the opponent', () => {
    // PHI rested; NYG needed the win and played its starters.
    const rows = [
      ...seasonRows({ team: 'PHI', finalShare: 0, playoffs: true }),
      ...seasonRows({ team: 'NYG', finalShare: 0.95, playoffs: true }),
    ];

    const rest = detectRestGames(rows, 2023);

    expect(rest.has('PHI')).toBe(true);
    expect(rest.has('NYG')).toBe(false);
  });

  it('reads the finale as the last regular-season week the team played', () => {
    // A team whose week 18 game is missing from the data rests in week 17.
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 16; wk++) {
      rows.push(...week('SF', wk, starters(0.95)));
    }
    rows.push(...week('SF', 17, starters(0)));
    rows.push(...week('SF', 19, starters(0.95)));

    expect(detectRestGames(rows, 2023).get('SF')?.week).toBe(17);
  });

  it('survives two stars on IR without calling a normal finale a rest week', () => {
    // Ten starters play the finale; two vanished weeks ago. The median holds.
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 17; wk++) {
      rows.push(...week('DAL', wk, starters(0.95)));
    }
    const survivors = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`S${i}`, 0.95]),
    );
    rows.push(...week('DAL', 18, survivors));
    rows.push(...week('DAL', 19, starters(0.95)));

    expect(detectRestGames(rows, 2023).has('DAL')).toBe(false);
  });

  it('is not fooled by one ironman starting a rest week', () => {
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 17; wk++) {
      rows.push(...week('BUF', wk, starters(0.95)));
    }
    rows.push(...week('BUF', 18, { S0: 0.95 }));
    rows.push(...week('BUF', 19, starters(0.95)));

    expect(detectRestGames(rows, 2023).get('BUF')?.week).toBe(18);
  });

  it('flags a finale where the stars sat even though the roster played on', () => {
    // Baltimore 2023, the 1 seed locked: Jackson and six others took no snap,
    // while most of the roster played. A partial rest is still a rest, and it
    // is the common shape — a clean sweep of the starting lineup is rarer.
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 17; wk++) {
      rows.push(...week('BAL', wk, starters(0.95)));
    }
    const finale = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`S${i}`, i < 5 ? 0 : 0.57]),
    );
    rows.push(...week('BAL', 18, finale));
    rows.push(...week('BAL', 19, starters(0.95)));

    expect(detectRestGames(rows, 2023).get('BAL')?.week).toBe(18);
  });

  it('spares a finale where a few backups rotated in as usual', () => {
    // Detroit 2023: three regulars down, everyone else at their normal load.
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 17; wk++) {
      rows.push(...week('DET', wk, starters(0.95)));
    }
    const finale = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`S${i}`, i < 3 ? 0 : 0.95]),
    );
    rows.push(...week('DET', 18, finale));
    rows.push(...week('DET', 19, starters(0.95)));

    expect(detectRestGames(rows, 2023).has('DET')).toBe(false);
  });

  it('fails closed when too few regulars can be identified', () => {
    const rows: RestGameCsvRow[] = [];
    const thin = { S0: 0.95, S1: 0.95 };
    for (let wk = 1; wk <= 17; wk++) rows.push(...week('LV', wk, thin));
    rows.push(...week('LV', 18, {}));
    rows.push(...week('LV', 19, thin));

    expect(MIN_REST_GAME_REGULARS).toBeGreaterThan(2);
    expect(detectRestGames(rows, 2023).has('LV')).toBe(false);
  });

  it('fails closed when too few games establish the season norm', () => {
    // An in-progress or truncated file: three games is not a norm to fall from.
    const rows: RestGameCsvRow[] = [];
    for (let wk = 1; wk <= 3; wk++)
      rows.push(...week('NYJ', wk, starters(0.95)));
    rows.push(...week('NYJ', 4, starters(0)));
    rows.push(...week('NYJ', 19, starters(0.95)));

    expect(MIN_REST_GAME_NORM_WEEKS).toBeGreaterThan(3);
    expect(detectRestGames(rows, 2023).has('NYJ')).toBe(false);
  });

  it('normalizes historical franchise codes', () => {
    const rows = seasonRows({
      team: 'OAK',
      finalShare: 0,
      playoffs: true,
      lastRegularWeek: 17,
    });

    expect(detectRestGames(rows, 2020).get('LV')?.team).toBe('LV');
  });

  it('needs the drop to clear REST_GAME_RATIO_THRESHOLD', () => {
    const justAbove = REST_GAME_RATIO_THRESHOLD + 0.05;
    const justBelow = REST_GAME_RATIO_THRESHOLD - 0.05;

    expect(
      detectRestGames(
        seasonRows({
          team: 'MIA',
          finalShare: justAbove,
          playoffs: true,
          regularShare: 1,
        }),
        2023,
      ).has('MIA'),
    ).toBe(false);
    expect(
      detectRestGames(
        seasonRows({
          team: 'MIA',
          finalShare: justBelow,
          playoffs: true,
          regularShare: 1,
        }),
        2023,
      ).has('MIA'),
    ).toBe(true);
  });

  it('returns nothing for an empty file', () => {
    expect(detectRestGames([], 2023).size).toBe(0);
  });
});

/** A season a rested starter might have, overridable per case. */
function season(overrides: Partial<Season> = {}): Season {
  return {
    year: 2023,
    gamesPlayed: 19,
    teamGames: 20,
    snapShare: 0.9,
    cumulativeSnapShare: 0.5,
    retained: true,
    ...overrides,
  };
}

describe('withoutRestGame', () => {
  it('returns the season untouched when no rest game applies', () => {
    const s = season();

    expect(withoutRestGame(s)).toBe(s);
  });

  it('shortens the schedule for a starter who sat the finale', () => {
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 19,
        teamGames: 20,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 0,
        },
      }),
    );

    // He now reads as having played every game his team really contested.
    expect(adjusted.teamGames).toBe(19);
    expect(adjusted.gamesPlayed).toBe(19);
  });

  it('drops the game from both sides for a starter who suited up', () => {
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 20,
        teamGames: 20,
        restGame: {
          playerGames: 1,
          playerShareSum: 0.1,
          playerSnaps: 6,
          teamSnaps: 120,
        },
      }),
    );

    expect(adjusted.teamGames).toBe(19);
    expect(adjusted.gamesPlayed).toBe(19);
  });

  it('lifts average snap share by excluding a token appearance', () => {
    // 0.9 across 19 real games, then one 0.1 cameo: stored average 0.86.
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 20,
        teamGames: 20,
        snapShare: 17.2 / 20,
        restGame: {
          playerGames: 1,
          playerShareSum: 0.1,
          playerSnaps: 0,
          teamSnaps: 0,
        },
      }),
    );

    expect(adjusted.snapShare).toBeCloseTo(0.9, 10);
  });

  it('reopens cumulative load against the shrunken denominator', () => {
    const adjusted = withoutRestGame(
      season({
        cumulativeSnapShare: 0.5,
        loadDenominator: 2000,
        restGame: {
          playerGames: 1,
          playerShareSum: 0.5,
          playerSnaps: 20,
          teamSnaps: 100,
        },
      }),
    );

    // (0.5*2000 - 20) / (2000 - 100)
    expect(adjusted.cumulativeSnapShare).toBeCloseTo(980 / 1900, 10);
  });

  it('leaves load alone when older data carries no denominator', () => {
    const adjusted = withoutRestGame(
      season({
        cumulativeSnapShare: 0.5,
        loadDenominator: undefined,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 100,
        },
      }),
    );

    expect(adjusted.cumulativeSnapShare).toBe(0.5);
    expect(adjusted.teamGames).toBe(19);
  });

  it('caps load at the adjusted average share, not the stored one', () => {
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 19,
        snapShare: 0.6,
        cumulativeSnapShare: 0.9,
        loadDenominator: 1000,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 100,
        },
      }),
    );

    // Load would reopen to 1.0; a season role cannot exceed typical usage.
    expect(adjusted.cumulativeSnapShare).toBe(0.6);
  });

  it('reads a player whose only game was the rest game as having none', () => {
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 1,
        teamGames: 20,
        snapShare: 0.5,
        cumulativeSnapShare: 0.02,
        loadDenominator: 2000,
        restGame: {
          playerGames: 1,
          playerShareSum: 0.5,
          playerSnaps: 40,
          teamSnaps: 100,
        },
      }),
    );

    expect(adjusted.gamesPlayed).toBe(0);
    expect(adjusted.snapShare).toBe(0);
    expect(adjusted.cumulativeSnapShare).toBe(0);
  });

  it('keeps the rest game on the result so the UI can explain it', () => {
    const restGame = {
      playerGames: 0,
      playerShareSum: 0,
      playerSnaps: 0,
      teamSnaps: 0,
    };

    expect(withoutRestGame(season({ restGame })).restGame).toEqual(restGame);
  });

  it('never drives team games below zero', () => {
    const adjusted = withoutRestGame(
      season({
        gamesPlayed: 0,
        teamGames: 0,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 0,
        },
      }),
    );

    expect(adjusted.teamGames).toBe(0);
  });
});
