import { describe, it, expect } from 'vitest';
import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  buildTeamSeasonDenominatorTotals,
  injuryAdjustedFullSeasonDenominator,
  resolveCumulativeLoadShare,
  resolveCumulativeLoadShareWithInjury,
  resolveCumulativeLoadWithInjury,
  resolveTeamGamesDenominator,
} from './teamSeasonDenominator';

describe('buildTeamSeasonDenominatorTotals', () => {
  it('sums each team’s per-game scrim once per (game, team)', () => {
    const rows = [
      {
        game_id: 'g1',
        team: 'MIN',
        offense_snaps: '35',
        offense_pct: '0.5',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '0',
        st_pct: '0',
      },
      {
        game_id: 'g1',
        team: 'MIN',
        offense_snaps: '30',
        offense_pct: '0.43',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '0',
        st_pct: '0',
      },
      {
        game_id: 'g2',
        team: 'MIN',
        offense_snaps: '35',
        offense_pct: '0.5',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '0',
        st_pct: '0',
      },
    ];
    const { scrimByTeam, gameCountByTeam } =
      buildTeamSeasonDenominatorTotals(rows);
    const g1 = 35 / 0.5;
    const g2 = 35 / 0.5;
    expect(scrimByTeam.get('MIN')).toBeCloseTo(g1 + g2, 5);
    expect(gameCountByTeam.get('MIN')).toBe(2);
  });

  it('collects the distinct weeks each team played', () => {
    const row = (game_id: string, team: string, week: string) => ({
      game_id,
      team,
      week,
      offense_snaps: '35',
      offense_pct: '0.5',
      defense_snaps: '0',
      defense_pct: '0',
      st_snaps: '0',
      st_pct: '0',
    });
    const { weeksByTeam } = buildTeamSeasonDenominatorTotals([
      row('g1', 'MIN', '1'),
      row('g1', 'MIN', '1'),
      row('g2', 'MIN', '3'),
      row('g3', 'GB', '2'),
    ]);
    expect([...(weeksByTeam.get('MIN') ?? [])].sort()).toEqual([1, 3]);
    expect([...(weeksByTeam.get('GB') ?? [])]).toEqual([2]);
  });
});

describe('injuryAdjustedFullSeasonDenominator', () => {
  it('subtracts average per-game capacity for excused missed games (capped by injury weeks)', () => {
    const fullDen = 1700;
    const gameCount = 17;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      injuryReportWeeks: 7,
      teamGames: 17,
      gamesPlayed: 10,
      cumDenGamesPlayed: 600,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - Math.min(7, 7) * avg, 5);
  });

  it('caps excused weeks by missed games, not injury total alone', () => {
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1000,
      gameCount: 10,
      injuryReportWeeks: 10,
      teamGames: 17,
      gamesPlayed: 15,
      cumDenGamesPlayed: 100,
    });
    const missed = 2;
    const avg = 1000 / 10;
    expect(adjusted).toBeCloseTo(1000 - missed * avg, 5);
  });

  it('excuses a season-ending absence that never reached the injury report', () => {
    // Bosa 2020: torn ACL in week 2, straight to IR, zero report rows.
    const fullDen = 1600;
    const gameCount = 16;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      injuryReportWeeks: 0,
      seasonEndingAbsenceGames: 14,
      teamGames: 16,
      gamesPlayed: 2,
      cumDenGamesPlayed: 200,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - 14 * avg, 5);
  });

  it('takes the stronger of the two absence signals rather than summing them', () => {
    const fullDen = 1700;
    const gameCount = 17;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      injuryReportWeeks: 3,
      seasonEndingAbsenceGames: 5,
      teamGames: 17,
      gamesPlayed: 12,
      cumDenGamesPlayed: 100,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - 5 * avg, 5);
  });

  it('still caps a season-ending absence by games actually missed', () => {
    const fullDen = 1700;
    const gameCount = 17;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      injuryReportWeeks: 0,
      seasonEndingAbsenceGames: 9,
      teamGames: 17,
      gamesPlayed: 15,
      cumDenGamesPlayed: 100,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - 2 * avg, 5);
  });
});

describe('resolveCumulativeLoadShareWithInjury', () => {
  it('increases load vs raw full-season when injury weeks align with missed games', () => {
    const raw = resolveCumulativeLoadShare({
      cumNum: 100,
      cumDenGamesPlayed: 400,
      fullSeasonTeamDen: 2000,
      useFullSeasonDenominator: true,
    });
    const adj = resolveCumulativeLoadShareWithInjury({
      cumNum: 100,
      cumDenGamesPlayed: 400,
      fullSeasonTeamDen: 2000,
      useFullSeasonDenominator: true,
      injuryReportWeeks: 5,
      teamGames: 17,
      gamesPlayed: 12,
      gameCount: 17,
    });
    expect(adj).toBeGreaterThan(raw);
  });

  it('adjusts a season-ending absence even with no injury report weeks', () => {
    const raw = resolveCumulativeLoadShare({
      cumNum: 100,
      cumDenGamesPlayed: 200,
      fullSeasonTeamDen: 1600,
      useFullSeasonDenominator: true,
    });
    const adj = resolveCumulativeLoadShareWithInjury({
      cumNum: 100,
      cumDenGamesPlayed: 200,
      fullSeasonTeamDen: 1600,
      useFullSeasonDenominator: true,
      injuryReportWeeks: 0,
      seasonEndingAbsenceGames: 14,
      teamGames: 16,
      gamesPlayed: 2,
      gameCount: 16,
    });
    expect(raw).toBeCloseTo(100 / 1600, 5);
    expect(adj).toBeCloseTo(100 / 200, 5);
  });
});

describe('resolveTeamGamesDenominator', () => {
  it('uses primary team franchise schedule length when present', () => {
    const franchiseGameCounts = new Map([
      ['BUF', 20],
      ['MIA', 17],
    ]);
    expect(
      resolveTeamGamesDenominator({
        franchiseGameCounts,
        maxFranchiseGamesInSeason: 20,
        primaryTeamRaw: 'BUF',
        injuryTeamRaw: '',
        draftingTeamNormalized: 'MIA',
        normalizeTeam: normalizeNflverseTeam,
      }),
    ).toBe(20);
  });

  it('falls back to injury team then drafting team', () => {
    const franchiseGameCounts = new Map([
      ['BUF', 20],
      ['NYJ', 17],
    ]);
    expect(
      resolveTeamGamesDenominator({
        franchiseGameCounts,
        maxFranchiseGamesInSeason: 20,
        primaryTeamRaw: '',
        injuryTeamRaw: 'BUF',
        draftingTeamNormalized: 'NYJ',
        normalizeTeam: normalizeNflverseTeam,
      }),
    ).toBe(20);
    expect(
      resolveTeamGamesDenominator({
        franchiseGameCounts,
        maxFranchiseGamesInSeason: 20,
        primaryTeamRaw: '',
        injuryTeamRaw: '',
        draftingTeamNormalized: 'NYJ',
        normalizeTeam: normalizeNflverseTeam,
      }),
    ).toBe(17);
  });

  it('uses league max when franchise unknown', () => {
    expect(
      resolveTeamGamesDenominator({
        franchiseGameCounts: new Map([['DAL', 18]]),
        maxFranchiseGamesInSeason: 21,
        primaryTeamRaw: '',
        injuryTeamRaw: '',
        draftingTeamNormalized: 'XXX',
        normalizeTeam: normalizeNflverseTeam,
      }),
    ).toBe(21);
  });
});

describe('resolveCumulativeLoadShare', () => {
  it('uses full-season denominator when enabled', () => {
    expect(
      resolveCumulativeLoadShare({
        cumNum: 100,
        cumDenGamesPlayed: 500,
        fullSeasonTeamDen: 2000,
        useFullSeasonDenominator: true,
      }),
    ).toBe(0.05);
  });

  it('falls back to games-played ratio for multi-team seasons', () => {
    expect(
      resolveCumulativeLoadShare({
        cumNum: 100,
        cumDenGamesPlayed: 500,
        fullSeasonTeamDen: 2000,
        useFullSeasonDenominator: false,
      }),
    ).toBe(0.2);
  });
});

describe('rest games and the injury adjustment', () => {
  it('does not excuse a missed game the rest rule already erases', () => {
    // 17 team games, played 16: the one he missed was the rested finale, and
    // the engine subtracts that game itself. Excusing it here too would
    // discount the same absence twice.
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1700,
      gameCount: 17,
      injuryReportWeeks: 3,
      teamGames: 17,
      gamesPlayed: 16,
      cumDenGamesPlayed: 1600,
      restTeamGames: 1,
      restPlayerGames: 0,
    });

    expect(adjusted).toBe(1700);
  });

  it('still excuses injury weeks beyond the rested finale', () => {
    // Missed four games; one of them was the rest game, so three are injury.
    const fullDen = 1700;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount: 17,
      injuryReportWeeks: 5,
      teamGames: 17,
      gamesPlayed: 13,
      cumDenGamesPlayed: 1300,
      restTeamGames: 1,
      restPlayerGames: 0,
    });

    expect(adjusted).toBeCloseTo(fullDen - 3 * (fullDen / 17), 5);
  });

  it('counts a game the player did play in the rest week as played', () => {
    // He took a token series in the rested finale, so nothing was missed.
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1700,
      gameCount: 17,
      injuryReportWeeks: 4,
      teamGames: 17,
      gamesPlayed: 17,
      cumDenGamesPlayed: 1700,
      restTeamGames: 1,
      restPlayerGames: 1,
    });

    expect(adjusted).toBe(1700);
  });
});

describe('resolveCumulativeLoadWithInjury', () => {
  it('reports the denominator it divided by, so the engine can reopen it', () => {
    const result = resolveCumulativeLoadWithInjury({
      cumNum: 800,
      cumDenGamesPlayed: 1000,
      fullSeasonTeamDen: 1700,
      useFullSeasonDenominator: true,
      injuryReportWeeks: 0,
      teamGames: 17,
      gamesPlayed: 17,
      gameCount: 17,
    });

    expect(result).toEqual({ share: 800 / 1700, denominator: 1700 });
  });

  it('reports the injury-adjusted denominator, not the raw one', () => {
    const fullDen = 1700;
    const expected = fullDen - 4 * (fullDen / 17);

    const result = resolveCumulativeLoadWithInjury({
      cumNum: 800,
      cumDenGamesPlayed: 1000,
      fullSeasonTeamDen: fullDen,
      useFullSeasonDenominator: true,
      injuryReportWeeks: 4,
      teamGames: 17,
      gamesPlayed: 13,
      gameCount: 17,
    });

    expect(result.denominator).toBeCloseTo(expected, 5);
    expect(result.share).toBeCloseTo(800 / expected, 10);
  });

  it('reports the games-played denominator for a traded season', () => {
    const result = resolveCumulativeLoadWithInjury({
      cumNum: 400,
      cumDenGamesPlayed: 900,
      fullSeasonTeamDen: 1700,
      useFullSeasonDenominator: false,
      injuryReportWeeks: 0,
      teamGames: 17,
      gamesPlayed: 9,
      gameCount: 17,
    });

    expect(result).toEqual({ share: 400 / 900, denominator: 900 });
  });
});

describe('per-week capacity', () => {
  it('records each team-week’s capacity so one game can be subtracted', () => {
    const rows = [
      {
        game_id: 'g17',
        team: 'BAL',
        week: '17',
        offense_snaps: '35',
        offense_pct: '0.5',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '12',
        st_pct: '0.5',
      },
      {
        game_id: 'g18',
        team: 'BAL',
        week: '18',
        offense_snaps: '30',
        offense_pct: '0.5',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '10',
        st_pct: '0.5',
      },
    ];

    const { capacityByTeamWeek } = buildTeamSeasonDenominatorTotals(rows);

    expect(capacityByTeamWeek.get('BAL|18')).toEqual({
      scrim: 60,
      full: 60 + 20,
    });
  });

  it('leaves out weeks the team did not play', () => {
    const rows = [
      {
        game_id: 'g1',
        team: 'BAL',
        week: '1',
        offense_snaps: '35',
        offense_pct: '0.5',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '0',
        st_pct: '0',
      },
    ];

    const { capacityByTeamWeek } = buildTeamSeasonDenominatorTotals(rows);

    expect(capacityByTeamWeek.has('BAL|2')).toBe(false);
  });
});
