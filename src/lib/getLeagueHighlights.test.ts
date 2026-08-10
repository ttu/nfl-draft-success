import { describe, it, expect } from 'vitest';
import { getLeagueHighlights } from './getLeagueHighlights';
import { expectedScoreForPick } from './draftSlotBaseline';
import { BUST_EXCLUSIONS } from './bustExclusions';
import type { DraftClass, DraftPick, Team } from '../types';
import { makePick, makeSeason, makeTeam } from '../test/factories';

const teams: Team[] = [makeTeam({ id: 'A' }), makeTeam({ id: 'B' })];

// Fixtures use the factory default position `ZZ` (baseline 1.0), so scores are
// not position-adjusted here; that behaviour lives in snapShareForTier.test.ts.
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
  return makePick({
    playerId: `${rest.teamId}-${rest.overallPick}`,
    playerName: `Player ${rest.overallPick}`,
    seasons: [
      makeSeason({ year: 2021, gamesPlayed, teamGames: 16, snapShare }),
    ],
    ...rest,
  });
}

/** Pick with no season rows yet (awaiting NFL data). */
function awaitingPick(teamId: string, overallPick: number): DraftPick {
  return makePick({
    playerId: `${teamId}-await-${overallPick}`,
    playerName: 'Await',
    overallPick,
    teamId,
  });
}

const opts = { draftingTeamOnly: false };

describe('getLeagueHighlights', () => {
  it('returns empty lists and null leader for empty draft classes', () => {
    const h = getLeagueHighlights([], teams, opts);
    expect(h.steals).toEqual([]);
    expect(h.busts).toEqual([]);
    expect(h.mostCoreStarters).toBeNull();
    expect(h.dayOneStarters).toEqual([]);
    expect(h.lateBloomers).toEqual([]);
    expect(h.ironMen).toEqual([]);
    expect(h.snakebit).toEqual([]);
    expect(h.gotAway).toEqual([]);
    expect(h.keptTheBand).toEqual([]);
  });

  it('carries the career-shape and retention bands', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({
            teamId: 'A',
            round: 1,
            overallPick: 1,
            snapShare: 0.9,
            draftYear: 2021,
          }),
        ],
      },
    ];

    const h = getLeagueHighlights(classes, teams, opts);

    expect(h.dayOneStarters).toHaveLength(1);
    expect(h.lateBloomers).toBeDefined();
    expect(h.ironMen).toBeDefined();
    expect(h.snakebit).toBeDefined();
    expect(h.gotAway).toBeDefined();
    expect(h.keptTheBand).toBeDefined();
  });

  it('ranks the top steals by over slot, not by raw score', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          // Lower raw score, but far above what pick 150 is expected to earn.
          pick({ teamId: 'A', round: 5, overallPick: 150, snapShare: 0.9 }),
          // Higher raw score, yet pick 3 is expected to play like this anyway.
          pick({ teamId: 'B', round: 1, overallPick: 3, snapShare: 0.95 }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals[0].pick.overallPick).toBe(150);
    expect(h.steals[0].score).toBeLessThan(h.steals[1].score);
    expect(h.steals[0].team?.id).toBe('A');
    expect(h.steals[0].draftYear).toBe(2021);
    expect(h.steals[0].score).toBeCloseTo(93, 3);
  });

  it('reports over slot as the score above the draft slot expectation', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 5, overallPick: 150, snapShare: 0.9 }),
        ],
      },
    ];
    const [steal] = getLeagueHighlights(classes, teams, opts).steals;
    expect(steal.overSlot).toBeCloseTo(
      steal.score - expectedScoreForPick(150),
      6,
    );
    expect(steal.overSlot).toBeGreaterThan(0);
  });

  it('keeps early picks off the steals list once over slot ranks them', () => {
    // A perfect top-5 pick has barely any headroom over its slot expectation,
    // so it loses to any late pick that merely plays a rotational role.
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 1, overallPick: 1, snapShare: 1 }),
          pick({ teamId: 'B', round: 7, overallPick: 240, snapShare: 0.4 }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals[0].pick.overallPick).toBe(240);
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

  it('breaks steal ties toward the later pick', () => {
    // Equal over slot is impossible with distinct slots, so this pair shares a
    // slot expectation (the curve is flat across picks 2–10) and a raw score.
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 1, overallPick: 4, snapShare: 0.9 }),
          pick({ teamId: 'B', round: 1, overallPick: 8, snapShare: 0.9 }), // same over slot, later pick wins
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals[0].pick.overallPick).toBe(8);
  });

  it('ranks the top busts by over slot, not by raw score', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          // Worst over slot: a top pick that never played.
          pick({
            teamId: 'A',
            round: 1,
            overallPick: 2,
            snapShare: 0.05,
            gamesPlayed: 1,
          }),
          pick({ teamId: 'A', round: 1, overallPick: 5, snapShare: 0.9 }), // good R1
          // Lower raw score, but a 6th-rounder was never expected to play.
          pick({
            teamId: 'B',
            round: 6,
            overallPick: 200,
            snapShare: 0.02,
            gamesPlayed: 1,
          }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.busts[0].pick.overallPick).toBe(2);
    expect(h.busts[0].team?.id).toBe('A');
    expect(h.busts[0].overSlot).toBeLessThan(0);
    // The late pick still fell short of its (modest) expectation, so it sits
    // above the round 1 pick that beat its own.
    expect(h.busts.map((b) => b.pick.overallPick)).toEqual([2, 200, 5]);
    expect(h.busts[2].overSlot).toBeGreaterThan(0);
  });

  it('lets rounds 2–3 onto the busts list', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({
            teamId: 'A',
            round: 2,
            overallPick: 46,
            snapShare: 0.02,
            gamesPlayed: 1,
          }),
          pick({ teamId: 'B', round: 1, overallPick: 20, snapShare: 0.85 }), // solid R1
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.busts[0].pick.overallPick).toBe(46);
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
            overallPick: 2,
            snapShare: 0.05,
            gamesPlayed: 1,
          }), // same over slot, earlier pick wins
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.busts[0].pick.overallPick).toBe(2);
  });

  it('keeps a pick whose career ended outside football off the busts list', () => {
    const excluded = pick({
      teamId: 'A',
      round: 1,
      overallPick: 2,
      snapShare: 0.02,
      gamesPlayed: 1,
    });
    excluded.playerId = BUST_EXCLUSIONS[0].playerId;
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          excluded,
          pick({
            teamId: 'B',
            round: 1,
            overallPick: 12,
            snapShare: 0.05,
            gamesPlayed: 2,
          }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    // The worst over slot of the two, yet the list backfills past him.
    expect(h.busts.map((b) => b.pick.playerId)).toEqual([
      classes[0].picks[1].playerId,
    ]);
    // Steals are unaffected: the credit side still counts every pick.
    expect(h.steals.map((s) => s.pick.playerId)).toContain(excluded.playerId);
  });

  it('still counts an excluded pick toward the core-starter tally', () => {
    const excluded = pick({
      teamId: 'A',
      round: 1,
      overallPick: 2,
      snapShare: 0.9,
    });
    excluded.playerId = BUST_EXCLUSIONS[0].playerId;
    const classes: DraftClass[] = [{ year: 2021, picks: [excluded] }];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.mostCoreStarters?.count).toBe(1);
  });

  it('lists a pick on both sides when the pool is smaller than the lists', () => {
    // Both lists draw from one pool now, so tiny fixtures overlap. Real windows
    // carry hundreds of picks, where the two ends never meet.
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [
          pick({ teamId: 'A', round: 4, overallPick: 120, snapShare: 0.9 }),
        ],
      },
    ];
    const h = getLeagueHighlights(classes, teams, opts);
    expect(h.steals).toHaveLength(1);
    expect(h.busts).toHaveLength(1);
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
