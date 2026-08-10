import { describe, it, expect } from 'vitest';
import { getRetentionHighlights, MIN_KEEPERS } from './retentionHighlights';
import { makePick, makeSeason, makeTeam } from '../test/factories';
import type { DraftClass, DraftPick } from '../types';

const teams = [makeTeam({ id: 'A' }), makeTeam({ id: 'B' })];

function classOf(...picks: DraftPick[]): DraftClass[] {
  return [{ year: 2021, picks }];
}

describe('the ones that got away', () => {
  /** Two quiet years with the drafting team, then two good ones elsewhere. */
  function bloomedElsewhere(overallPick: number): DraftPick {
    return makePick({
      overallPick,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 6, snapShare: 0.15 }),
        makeSeason({ year: 2022, gamesPlayed: 8, snapShare: 0.2 }),
        makeSeason({
          year: 2023,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2024,
          snapShare: 0.95,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });
  }

  it('ranks by the rise after leaving and names the new team', () => {
    const { gotAway } = getRetentionHighlights(
      classOf(bloomedElsewhere(50)),
      teams,
    );

    expect(gotAway).toHaveLength(1);
    expect(gotAway[0].team?.id).toBe('A');
    expect(gotAway[0].value).toBeGreaterThan(0);
    expect(gotAway[0].detail).toMatch(/→ \d+ with B$/);
  });

  it('skips a pick traded before he ever played', () => {
    const neverHere = makePick({
      overallPick: 51,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(neverHere), teams);

    expect(gotAway).toEqual([]);
  });

  it('skips a rise that never reaches starter grade', () => {
    const mediocre = makePick({
      overallPick: 52,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 1, snapShare: 0.01 }),
        makeSeason({
          year: 2022,
          gamesPlayed: 5,
          snapShare: 0.25,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 5,
          snapShare: 0.25,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(mediocre), teams);

    expect(gotAway).toEqual([]);
  });

  it('needs more than one starter-grade season elsewhere', () => {
    const oneGoodYear = makePick({
      overallPick: 53,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 4, snapShare: 0.1 }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 2,
          snapShare: 0.05,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(oneGoodYear), teams);

    expect(gotAway).toEqual([]);
  });

  it('reads the current team from an unplayed roster row, not the last played one', () => {
    // He played elsewhere for B, then moved again over the offseason. The
    // roster row is the only thing that knows, and it must not be scored.
    const pick = bloomedElsewhere(54);
    pick.seasons.push(
      makeSeason({
        year: 2025,
        gamesPlayed: 0,
        teamGames: 0,
        snapShare: 0,
        retained: false,
        currentTeam: 'DEN',
      }),
    );

    const { gotAway } = getRetentionHighlights(classOf(pick), teams);

    expect(gotAway[0].detail).toMatch(/with DEN$/);
    // The unplayed row contributed nothing: the rise is the same as without it.
    const { gotAway: without } = getRetentionHighlights(
      classOf(bloomedElsewhere(54)),
      teams,
    );
    expect(gotAway[0].value).toBeCloseTo(without[0].value);
  });
});

describe('kept the band together', () => {
  /** A starter-grade pick, retained or not in his latest season. */
  function keeper(
    teamId: string,
    overallPick: number,
    stayed: boolean,
  ): DraftPick {
    return makePick({
      overallPick,
      teamId,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, snapShare: 0.9 }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: stayed,
          ...(stayed ? {} : { currentTeam: 'B' }),
        }),
      ],
    });
  }

  function keepers(teamId: string, kept: number, lost: number): DraftPick[] {
    const picks: DraftPick[] = [];
    for (let i = 0; i < kept; i += 1) picks.push(keeper(teamId, 100 + i, true));
    for (let i = 0; i < lost; i += 1)
      picks.push(keeper(teamId, 200 + i, false));
    return picks;
  }

  it('ranks teams by the share of keepers retained', () => {
    const { keptTheBand } = getRetentionHighlights(
      classOf(...keepers('A', 5, 1), ...keepers('B', 3, 3)),
      teams,
    );

    expect(keptTheBand[0].teamId).toBe('A');
    expect(keptTheBand[0].kept).toBe(5);
    expect(keptTheBand[0].keepers).toBe(6);
    expect(keptTheBand[0].rate).toBeCloseTo(5 / 6);
  });

  it('needs MIN_KEEPERS before a team can rank', () => {
    const { keptTheBand } = getRetentionHighlights(
      classOf(...keepers('A', 4, 0)),
      teams,
    );

    expect(MIN_KEEPERS).toBe(5);
    expect(keptTheBand).toEqual([]);
  });

  it('ignores picks who never reached starter grade', () => {
    const scrubs = Array.from({ length: 6 }, (_, i) =>
      makePick({
        overallPick: 300 + i,
        teamId: 'A',
        draftYear: 2021,
        seasons: [makeSeason({ year: 2021, gamesPlayed: 2, snapShare: 0.05 })],
      }),
    );

    const { keptTheBand } = getRetentionHighlights(classOf(...scrubs), teams);

    expect(keptTheBand).toEqual([]);
  });
});

describe('careers that ended', () => {
  /**
   * The shape that distorted these lists in production: the pipeline writes a
   * season row for every year in the window, so a player who left the league
   * carries rows long after his last snap. Those rows are not roster evidence.
   */
  function washedOut(overallPick: number, teamId: string): DraftPick {
    return makePick({
      overallPick,
      teamId,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, snapShare: 0.9 }),
        makeSeason({ year: 2022, snapShare: 0.9 }),
        ...[2023, 2024, 2025].map((year) =>
          makeSeason({
            year,
            gamesPlayed: 0,
            teamGames: 17,
            snapShare: 0,
            retained: false,
          }),
        ),
      ],
    });
  }

  it('reads retention from the last season with snaps, not a post-career row', () => {
    const picks = Array.from({ length: 5 }, (_, i) => washedOut(400 + i, 'A'));

    const { keptTheBand } = getRetentionHighlights(classOf(...picks), teams);

    // He was still on the drafting team when he last played, so he was kept.
    expect(keptTheBand[0]).toMatchObject({ teamId: 'A', kept: 5, keepers: 5 });
  });

  it('does not treat years out of the league as playing elsewhere', () => {
    const { gotAway } = getRetentionHighlights(
      classOf(washedOut(410, 'A')),
      teams,
    );

    expect(gotAway).toEqual([]);
  });

  it('omits the destination when no row names one', () => {
    const noDestination = makePick({
      overallPick: 411,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 4, snapShare: 0.1 }),
        makeSeason({ year: 2022, snapShare: 0.9, retained: false }),
        makeSeason({ year: 2023, snapShare: 0.9, retained: false }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(noDestination), teams);

    expect(gotAway[0].detail).not.toContain('—');
    expect(gotAway[0].detail).toMatch(/^\d+ → \d+$/);
  });
});
