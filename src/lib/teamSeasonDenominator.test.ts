import { describe, it, expect } from 'vitest';
import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  buildTeamSeasonDenominatorTotals,
  injuryAdjustedFullSeasonDenominator,
  resolveCumulativeLoadShare,
  resolveCumulativeLoadShareWithInjury,
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
