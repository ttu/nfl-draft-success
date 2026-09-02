import { describe, it, expect } from 'vitest';
import {
  getCurrentTeamForPick,
  getCurrentRoster,
  groupRosterByPosition,
  rosterMeanScore,
  hasRosterSnapshot,
  ROSTER_SEASON,
} from './currentRoster';
import { DRAFT_YEAR_BOUNDS } from './draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

/** The synthetic "where he stands" row update-data writes for the season ahead. */
const upcoming = (overrides: { retained: boolean; currentTeam?: string }) =>
  makeSeason({
    year: CURRENT,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

describe('getCurrentTeamForPick', () => {
  it('returns the drafting team when the current-season row is retained', () => {
    const pick = makePick({
      teamId: 'BUF',
      seasons: [
        makeSeason({ year: CURRENT - 1 }),
        upcoming({ retained: true }),
      ],
    });
    expect(getCurrentTeamForPick(pick)).toBe('BUF');
  });

  it('returns the new team when the current-season row shows a move', () => {
    const pick = makePick({
      teamId: 'JAX',
      seasons: [upcoming({ retained: false, currentTeam: 'BUF' })],
    });
    expect(getCurrentTeamForPick(pick)).toBe('BUF');
  });

  it('returns undefined when the current-season row names no team', () => {
    const pick = makePick({
      teamId: 'JAX',
      seasons: [upcoming({ retained: false })],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });

  it('returns undefined for a player whose newest row is last season', () => {
    // Played in the league last year, on nobody's roster now: without this the
    // page would show retired veterans as current players.
    const pick = makePick({
      teamId: 'ARI',
      draftYear: CURRENT - 10,
      seasons: [makeSeason({ year: CURRENT - 1, retained: true })],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });

  it('places a rookie with no season rows on his drafting team', () => {
    const pick = makePick({ teamId: 'KC', draftYear: CURRENT, seasons: [] });
    expect(getCurrentTeamForPick(pick)).toBe('KC');
  });

  it('does not place an older pick with no season rows on any roster', () => {
    const pick = makePick({
      teamId: 'KC',
      draftYear: CURRENT - 3,
      seasons: [],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });

  it('ignores a ROSTER_SEASON row that is already a played season, not a roster snapshot', () => {
    // Once the pipeline actually plays ROSTER_SEASON, its row for this pick
    // stops being the forward-looking snapshot and becomes ordinary season
    // data (teamGames > 0). That must not be read as "still on this roster" —
    // see the regression this constant exists to prevent, in the doc comment
    // on getCurrentTeamForPick.
    const pick = makePick({
      teamId: 'ARI',
      draftYear: CURRENT - 5,
      seasons: [
        makeSeason({
          year: ROSTER_SEASON,
          teamGames: 12,
          gamesPlayed: 10,
          snapShare: 0.5,
          retained: true,
        }),
      ],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });
});

describe('getCurrentRoster', () => {
  it('includes retained players and players acquired from other teams', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({
            overallPick: 1,
            teamId: 'BUF',
            seasons: [upcoming({ retained: true })],
          }),
          makePick({
            overallPick: 2,
            teamId: 'JAX',
            seasons: [upcoming({ retained: false, currentTeam: 'BUF' })],
          }),
          makePick({
            overallPick: 3,
            teamId: 'BUF',
            seasons: [upcoming({ retained: false, currentTeam: 'KC' })],
          }),
        ],
      }),
    ];
    const roster = getCurrentRoster(classes, 'BUF');
    expect(roster.map((e) => e.pick.overallPick)).toEqual([1, 2]);
    expect(roster.map((e) => e.acquired)).toEqual([false, true]);
    expect(roster[0].draftYear).toBe(CURRENT - 2);
  });

  it('scores a career across every team the player suited up for', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 3,
        picks: [
          makePick({
            overallPick: 1,
            teamId: 'JAX',
            seasons: [
              makeSeason({ year: CURRENT - 3, retained: true }),
              makeSeason({
                year: CURRENT - 2,
                retained: false,
                currentTeam: 'BUF',
              }),
              upcoming({ retained: false, currentTeam: 'BUF' }),
            ],
          }),
        ],
      }),
    ];
    const [entry] = getCurrentRoster(classes, 'BUF');
    expect(entry.seasonsPlayed).toBe(2);
    // Two identical full seasons: the mean is one season's score, not a
    // rookie-window-divided fraction of it.
    expect(entry.score).toBeGreaterThan(80);
    expect(entry.role).toBe('core_starter');
  });

  it('leaves score and role undefined for a player who has not played', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT,
        picks: [makePick({ overallPick: 1, teamId: 'BUF', seasons: [] })],
      }),
    ];
    const [entry] = getCurrentRoster(classes, 'BUF');
    expect(entry.seasonsPlayed).toBe(0);
    expect(entry.score).toBeUndefined();
    expect(entry.role).toBeUndefined();
  });
});

describe('hasRosterSnapshot', () => {
  it('is true when some pick carries a ROSTER_SEASON row', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({
            teamId: 'BUF',
            seasons: [
              makeSeason({
                year: ROSTER_SEASON,
                teamGames: 0,
                gamesPlayed: 0,
                snapShare: 0,
                retained: true,
              }),
            ],
          }),
        ],
      }),
    ];
    expect(hasRosterSnapshot(classes)).toBe(true);
  });

  it('is false when no pick has a ROSTER_SEASON row, e.g. an in-season refresh before the roster file publishes', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({
            teamId: 'BUF',
            seasons: [makeSeason({ year: CURRENT - 1, teamGames: 17 })],
          }),
        ],
      }),
    ];
    expect(hasRosterSnapshot(classes)).toBe(false);
  });
});

describe('rosterMeanScore', () => {
  it('averages scored players and ignores unscored ones', () => {
    const entries = [
      { score: 80 },
      { score: 60 },
      { score: undefined },
    ] as Parameters<typeof rosterMeanScore>[0];
    expect(rosterMeanScore(entries)).toBe(70);
  });

  it('is undefined when nobody has played', () => {
    const entries = [{ score: undefined }] as Parameters<
      typeof rosterMeanScore
    >[0];
    expect(rosterMeanScore(entries)).toBeUndefined();
  });
});

describe('groupRosterByPosition', () => {
  it('orders groups by unit, sorts by score, and drops empty groups', () => {
    const seasons = [
      makeSeason({ year: CURRENT - 1 }),
      upcoming({ retained: true }),
    ];
    const weakSeasons = [
      makeSeason({ year: CURRENT - 1, gamesPlayed: 2, snapShare: 0.1 }),
      upcoming({ retained: true }),
    ];
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({ overallPick: 1, teamId: 'BUF', position: 'CB', seasons }),
          makePick({
            overallPick: 2,
            teamId: 'BUF',
            position: 'QB',
            seasons: weakSeasons,
          }),
          makePick({ overallPick: 3, teamId: 'BUF', position: 'QB', seasons }),
        ],
      }),
      makeDraftClass({
        year: CURRENT,
        picks: [
          makePick({
            overallPick: 4,
            teamId: 'BUF',
            position: 'QB',
            seasons: [],
          }),
        ],
      }),
    ];
    const groups = groupRosterByPosition(getCurrentRoster(classes, 'BUF'));
    expect(groups.map((g) => g.id)).toEqual(['QB', 'DB']);
    expect(groups[0].label).toBe('Quarterbacks');
    // Best score first; the player awaiting data goes last.
    expect(groups[0].entries.map((e) => e.pick.overallPick)).toEqual([3, 2, 4]);
    expect(groups[1].meanScore).toBeGreaterThan(80);
  });
});
