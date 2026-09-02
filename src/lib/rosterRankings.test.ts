import { describe, it, expect } from 'vitest';
import { getRosterRankings } from './rosterRankings';
import { ROSTER_SEASON } from './currentRoster';
import { TEAMS } from '../data/teams';
import {
  makeDraftClass,
  makeDepthSeason,
  makePick,
  makeSeason,
} from '../test/factories';

/** The unplayed snapshot row update-data writes for the season ahead. */
const onRosterOf = (teamId: string | undefined, retained: boolean) =>
  makeSeason({
    year: ROSTER_SEASON,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    retained,
    currentTeam: teamId,
  });

/** A pick who played one season at `season` quality and is on `teamId` now. */
const rostered = (
  overallPick: number,
  draftTeam: string,
  currentTeam: string,
  season: ReturnType<typeof makeSeason>,
) =>
  makePick({
    overallPick,
    teamId: draftTeam,
    seasons: [
      season,
      draftTeam === currentTeam
        ? onRosterOf(undefined, true)
        : onRosterOf(currentTeam, false),
    ],
  });

describe('getRosterRankings', () => {
  it('ranks every team in the league, best roster score first', () => {
    const classes = [
      makeDraftClass({
        year: 2023,
        picks: [
          rostered(1, 'BUF', 'BUF', makeDepthSeason({ year: 2023 })),
          rostered(2, 'KC', 'KC', makeSeason({ year: 2023 })),
        ],
      }),
    ];

    const rankings = getRosterRankings(classes);

    expect(rankings).toHaveLength(TEAMS.length);
    expect(rankings[0]).toMatchObject({ teamId: 'KC', rank: 1, players: 1 });
    expect(rankings[1]).toMatchObject({ teamId: 'BUF', rank: 2, players: 1 });
    expect(rankings[0].score).toBeGreaterThan(rankings[1].score!);
  });

  it('credits an acquired player to the team he is on now', () => {
    const classes = [
      makeDraftClass({
        year: 2023,
        picks: [rostered(1, 'JAX', 'BUF', makeSeason({ year: 2023 }))],
      }),
    ];

    const rankings = getRosterRankings(classes);

    expect(rankings.find((r) => r.teamId === 'BUF')).toMatchObject({
      rank: 1,
      players: 1,
    });
    expect(rankings.find((r) => r.teamId === 'JAX')?.players).toBe(0);
  });

  it('sorts teams with no scored player last, with no score', () => {
    const classes = [
      makeDraftClass({
        year: 2023,
        picks: [rostered(1, 'BUF', 'BUF', makeDepthSeason({ year: 2023 }))],
      }),
    ];

    const rankings = getRosterRankings(classes);

    expect(rankings[0].teamId).toBe('BUF');
    expect(rankings[rankings.length - 1].score).toBeUndefined();
  });

  it('counts a rookie awaiting his first season without scoring him', () => {
    // A team whose only tracked player has never played has a player but no
    // score — a zero there would rank it below teams with genuinely bad rosters.
    const classes = [
      makeDraftClass({
        year: 2023,
        picks: [rostered(1, 'BUF', 'BUF', makeSeason({ year: 2023 }))],
      }),
      makeDraftClass({
        year: 2024,
        picks: [
          makePick({
            overallPick: 2,
            teamId: 'KC',
            draftYear: 2024,
            seasons: [onRosterOf(undefined, true)],
          }),
        ],
      }),
    ];

    const kc = getRosterRankings(classes).find((r) => r.teamId === 'KC');

    expect(kc).toMatchObject({ players: 1, score: undefined });
  });
});
