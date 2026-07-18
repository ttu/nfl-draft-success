import { describe, it, expect } from 'vitest';
import { getLeagueHighlights } from './getLeagueHighlights';
import type { DraftClass, DraftPick, Season, Team } from '../types';

const teams: Team[] = [
  { id: 'A', name: 'Team A', abbreviation: 'A' },
  { id: 'B', name: 'Team B', abbreviation: 'B' },
];

// Fixtures use the unknown position `ZZ` (baseline 1.0), so scores are not
// position-adjusted here; that behaviour lives in snapShareForTier.test.ts.
/** Single-season pick producing a deterministic 0–100 score. */
function pick(
  overrides: Partial<DraftPick> & {
    teamId: string;
    round: number;
    overallPick: number;
    snapShare: number;
    gamesPlayed?: number;
  },
): DraftPick {
  const { snapShare, gamesPlayed = 16, ...rest } = overrides;
  const season: Season = {
    year: 2021,
    gamesPlayed,
    teamGames: 16,
    snapShare,
    retained: true,
  };
  return {
    playerId: `${rest.teamId}-${rest.overallPick}`,
    playerName: `Player ${rest.overallPick}`,
    position: 'ZZ',
    seasons: [season],
    ...rest,
  };
}

/** Pick with no season rows yet (awaiting NFL data). */
function awaitingPick(teamId: string, overallPick: number): DraftPick {
  return {
    playerId: `${teamId}-await-${overallPick}`,
    playerName: 'Await',
    position: 'ZZ',
    round: 1,
    overallPick,
    teamId,
    seasons: [],
  };
}

const opts = { draftingTeamOnly: false };

describe('getLeagueHighlights', () => {
  it('returns empty lists and null leader for empty draft classes', () => {
    const h = getLeagueHighlights([], teams, opts);
    expect(h.steals).toEqual([]);
    expect(h.busts).toEqual([]);
    expect(h.mostCoreStarters).toBeNull();
  });

  it('ranks the top steals highest-scoring first, round 4+ only', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 5, overallPick: 150, snapShare: 0.9 }), // top, 93
          pick({ teamId: 'A', round: 4, overallPick: 120, snapShare: 0.5 }), // second
          pick({ teamId: 'B', round: 1, overallPick: 3, snapShare: 0.95 }), // R1, excluded
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals.map((s) => s.pick.overallPick)).toEqual([150, 120]);
    expect(h.steals[0].team?.id).toBe('A');
    expect(h.steals[0].draftYear).toBe(2021);
    expect(h.steals[0].score).toBeCloseTo(93, 3);
  });

  it('caps the steals list at twenty players', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: Array.from({ length: 25 }, (_, i) =>
          pick({
            teamId: i % 2 === 0 ? 'A' : 'B',
            round: 4,
            overallPick: 110 + i,
            snapShare: 0.9 - i * 0.02,
          }),
        ),
      },
    ];
    expect(getLeagueHighlights(classes, teams, opts).steals).toHaveLength(20);
  });

  it('ignores rounds 1–3 for the steals list', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 3, overallPick: 80, snapShare: 0.95 }), // high but R3
        ],
      },
    ];
    expect(getLeagueHighlights(classes, teams, opts).steals).toEqual([]);
  });

  it('breaks steal ties toward the later pick', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 4, overallPick: 110, snapShare: 0.9 }),
          pick({ teamId: 'B', round: 6, overallPick: 200, snapShare: 0.9 }), // same score, later pick wins
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals[0].pick.overallPick).toBe(200);
  });

  it('ranks the top busts lowest-scoring first, round 1 only', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({
            teamId: 'A',
            round: 1,
            overallPick: 2,
            snapShare: 0.05,
            gamesPlayed: 1,
          }), // worst, ~5.4
          pick({ teamId: 'A', round: 1, overallPick: 5, snapShare: 0.9 }), // good R1
          pick({
            teamId: 'B',
            round: 6,
            overallPick: 200,
            snapShare: 0.02,
            gamesPlayed: 1,
          }), // worse score but not R1
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.busts[0].pick.overallPick).toBe(2);
    expect(h.busts[0].team?.id).toBe('A');
    // The good R1 pick is still listed (only two R1 picks exist).
    expect(h.busts.map((b) => b.pick.overallPick)).toEqual([2, 5]);
  });

  it('breaks bust ties toward the earlier pick', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({
            teamId: 'A',
            round: 1,
            overallPick: 10,
            snapShare: 0.05,
            gamesPlayed: 1,
          }),
          pick({
            teamId: 'B',
            round: 1,
            overallPick: 1,
            snapShare: 0.05,
            gamesPlayed: 1,
          }), // same score, earlier pick wins
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.busts[0].pick.overallPick).toBe(1);
  });

  it('returns an empty busts list when there are no round 1 picks', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 2, overallPick: 40, snapShare: 0.1 }),
        ],
      },
    ];
    expect(getLeagueHighlights(classes, teams, opts).busts).toEqual([]);
  });

  it('finds the team with the most core starters', () => {
    const core = (teamId: string, overallPick: number) =>
      pick({ teamId, round: 1, overallPick, snapShare: 0.9 }); // core_starter
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          core('A', 1),
          core('A', 2),
          core('B', 3),
          pick({
            teamId: 'B',
            round: 7,
            overallPick: 250,
            snapShare: 0.02,
            gamesPlayed: 1,
          }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.mostCoreStarters).not.toBeNull();
    expect(h.mostCoreStarters!.teamId).toBe('A');
    expect(h.mostCoreStarters!.count).toBe(2);
    expect(h.mostCoreStarters!.team?.id).toBe('A');
  });

  it('returns null mostCoreStarters when no team has a core starter', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({
            teamId: 'A',
            round: 1,
            overallPick: 1,
            snapShare: 0.05,
            gamesPlayed: 1,
          }),
        ],
      },
    ];
    expect(
      getLeagueHighlights(classes, teams, opts).mostCoreStarters,
    ).toBeNull();
  });

  it('excludes awaiting-data picks from all highlights', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [awaitingPick('A', 1), awaitingPick('B', 5)],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals).toEqual([]);
    expect(h.busts).toEqual([]);
    expect(h.mostCoreStarters).toBeNull();
  });
});
