import { describe, it, expect } from 'vitest';
import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  buildTeamSeasonDenominatorTotals,
  injuryAdjustedFullSeasonDenominator,
  resolveCumulativeLoadShare,
  resolveCumulativeLoadWithInjury,
  resolveTeamGamesDenominator,
} from './teamSeasonDenominator';

describe('phase-matched capacity', () => {
  /** One team-game: 70 offensive plays, 60 defensive plays, 25 ST plays. */
  const teamGame = (gameId: string, team = 'IND') => [
    {
      game_id: gameId,
      team,
      week: '1',
      // A lineman: every offensive snap, no defensive snaps.
      offense_snaps: '70',
      offense_pct: '1',
      defense_snaps: '0',
      defense_pct: '0',
      st_snaps: '0',
      st_pct: '0',
    },
    {
      game_id: gameId,
      team,
      week: '1',
      // A linebacker: every defensive snap, no offensive snaps.
      offense_snaps: '0',
      offense_pct: '0',
      defense_snaps: '60',
      defense_pct: '1',
      st_snaps: '25',
      st_pct: '1',
    },
  ];

  it('reports offensive and defensive capacity separately', () => {
    const t = buildTeamSeasonDenominatorTotals(teamGame('g1'));
    expect(t.offByTeam.get('IND')).toBeCloseTo(70);
    expect(t.defByTeam.get('IND')).toBeCloseTo(60);
    // The combined bases stay available for specialists and existing callers.
    expect(t.scrimByTeam.get('IND')).toBeCloseTo(130);
    expect(t.fullByTeam.get('IND')).toBeCloseTo(155);
  });

  it('carries the split onto each team-week, so a rest game subtracts one phase', () => {
    const t = buildTeamSeasonDenominatorTotals(teamGame('g1'));
    const cap = t.capacityByTeamWeek.get('IND|1');
    expect(cap?.off).toBeCloseTo(70);
    expect(cap?.def).toBeCloseTo(60);
    expect(cap?.scrim).toBeCloseTo(130);
  });

  it('lets a never-off-the-field lineman read a full season, not half of one', () => {
    // Two games, an ironman guard playing all 140 offensive snaps. Measured
    // against offensive capacity he is at 100%; against offense+defense he
    // would report 54%, which is what the mixed-phase denominator produced.
    const rows = [...teamGame('g1'), ...teamGame('g2')];
    const t = buildTeamSeasonDenominatorTotals(rows);
    const off = t.offByTeam.get('IND') ?? 0;
    const scrim = t.scrimByTeam.get('IND') ?? 0;
    expect(140 / off).toBeCloseTo(1);
    expect(140 / scrim).toBeLessThan(0.6);
  });

  it('sums the phase across rows, so one row missing a phase cannot halve it', () => {
    // Only the offensive row present for g2: defensive capacity for that game
    // is unknown and contributes nothing, rather than being invented.
    const rows = [...teamGame('g1'), teamGame('g2')[0]];
    const t = buildTeamSeasonDenominatorTotals(rows);
    expect(t.offByTeam.get('IND')).toBeCloseTo(140);
    expect(t.defByTeam.get('IND')).toBeCloseTo(60);
  });
});

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

  it('takes both scrimmage phases from a game, whichever row carries them', () => {
    // Real files list one row per player, so offensive and defensive capacity
    // never appear on the same row. Reading a game from a single row dropped
    // whichever phase that player did not play (§1.2 wants off + def).
    const rows = [
      {
        game_id: 'g1',
        team: 'MIN',
        week: '1',
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
        week: '1',
        offense_snaps: '0',
        offense_pct: '0',
        defense_snaps: '26',
        defense_pct: '0.4',
        st_snaps: '0',
        st_pct: '0',
      },
    ];
    const { scrimByTeam, capacityByTeamWeek } =
      buildTeamSeasonDenominatorTotals(rows);
    const teamOff = 35 / 0.5; // 70
    const teamDef = 26 / 0.4; // 65
    expect(scrimByTeam.get('MIN')).toBeCloseTo(teamOff + teamDef, 5);
    expect(capacityByTeamWeek.get('MIN|1')?.scrim).toBeCloseTo(
      teamOff + teamDef,
      5,
    );
  });

  it('takes special-teams capacity from a row that played special teams', () => {
    const rows = [
      {
        game_id: 'g1',
        team: 'MIN',
        week: '1',
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
        week: '1',
        offense_snaps: '0',
        offense_pct: '0',
        defense_snaps: '0',
        defense_pct: '0',
        st_snaps: '12',
        st_pct: '0.48',
      },
    ];
    const { fullByTeam } = buildTeamSeasonDenominatorTotals(rows);
    expect(fullByTeam.get('MIN')).toBeCloseTo(35 / 0.5 + 12 / 0.48, 5);
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
  it('subtracts average per-game capacity for excused missed games', () => {
    const fullDen = 1700;
    const gameCount = 17;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      excusedGames: 7,
      teamGames: 17,
      gamesPlayed: 10,
      cumDenGamesPlayed: 600,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - Math.min(7, 7) * avg, 5);
  });

  it('caps the excusal at games missed, however large the signal', () => {
    // `excusedGames` is a subset of the missed weeks by construction, so this
    // cap cannot bind on that path. It still guards the 2013–2015 heuristic,
    // which counts games rather than intersecting week sets.
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1000,
      gameCount: 10,
      excusedGames: 10,
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
      excusedGames: 0,
      seasonEndingAbsenceGames: 14,
      teamGames: 16,
      gamesPlayed: 2,
      cumDenGamesPlayed: 200,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - 14 * avg, 5);
  });

  it('takes the stronger of the intersection and the pre-2016 heuristic', () => {
    // Both are counts of games missed to injury, so they describe the same
    // absence and are never summed. The heuristic covers 2013–2015, where the
    // reserve feed does not exist and the week sets are too thin to intersect.
    const fullDen = 1700;
    const gameCount = 17;
    const adjusted = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount,
      excusedGames: 3,
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
      excusedGames: 0,
      seasonEndingAbsenceGames: 9,
      teamGames: 17,
      gamesPlayed: 15,
      cumDenGamesPlayed: 100,
    });
    const avg = fullDen / gameCount;
    expect(adjusted).toBeCloseTo(fullDen - 2 * avg, 5);
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
      excusedGames: 3,
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
      excusedGames: 5,
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
      excusedGames: 4,
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
      excusedGames: 0,
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
      excusedGames: 4,
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
      excusedGames: 0,
      teamGames: 17,
      gamesPlayed: 9,
      gameCount: 17,
    });

    expect(result).toEqual({ share: 400 / 900, denominator: 900 });
  });
});

describe('excusedGames as the injury signal', () => {
  // Derwin James 2019: 11 weeks on IR, returned for the last 5 games, and
  // absent from the weekly injury report for the whole season. The reserve
  // weeks he missed are the whole of the intersection.
  const james2019 = {
    cumNum: 500,
    cumDenGamesPlayed: 504,
    fullSeasonTeamDen: 1600,
    useFullSeasonDenominator: true,
    excusedGames: 0,
    seasonEndingAbsenceGames: 0,
    teamGames: 16,
    gamesPlayed: 5,
    gameCount: 16,
  };

  it('adjusts the denominator when the reserve stint is the only evidence', () => {
    const before = resolveCumulativeLoadWithInjury(james2019);
    const after = resolveCumulativeLoadWithInjury({
      ...james2019,
      excusedGames: 11,
    });
    expect(before.share).toBeCloseTo(500 / 1600, 5);
    // 11 of 16 games excused takes 1600 down to 500 — but the function floors
    // the result at `cumDenGamesPlayed` (504 here), so 504 is the answer, not
    // 500. Read `injuryAdjustedFullSeasonDenominator`'s closing
    // `Math.max(adjusted, cumDenGamesPlayed)` before changing this number.
    expect(after.denominator).toBeCloseTo(504, 5);
    // Which lands him on the 0.992 the spec predicts for James 2019.
    expect(after.share).toBeCloseTo(500 / 504, 5);
    expect(after.share).toBeGreaterThan(before.share);
  });

  it('forgives a full season split across the report and the reserve list', () => {
    // Ronnie Stanley 2021: injury-report weeks 1–6, then IR for 7–18, which is
    // 16 of the 17 games. `max()` of the two counts forgave 11 of them; the
    // union of the week sets, intersected with the games he missed, forgives
    // all 16. He played only week 1.
    const fullDen = 1700;
    const got = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: fullDen,
      gameCount: 17,
      excusedGames: 16,
      teamGames: 17,
      gamesPlayed: 1,
      cumDenGamesPlayed: 0,
    });
    expect(got).toBeCloseTo(fullDen - 16 * (fullDen / 17), 5);
  });

  it('leaves a season with no signal untouched', () => {
    const got = resolveCumulativeLoadWithInjury({
      ...james2019,
      gamesPlayed: 16,
      excusedGames: 0,
    });
    expect(got.denominator).toBeCloseTo(1600, 5);
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
      // Only an offensive row is present, so defensive capacity is unknown
      // rather than assumed — the phase split is carried explicitly.
      off: 60,
      def: 0,
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
