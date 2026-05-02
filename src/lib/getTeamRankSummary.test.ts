import { describe, it, expect } from 'vitest';
import { getTeamRankSummary } from './getTeamRankSummary';
import type { DraftClass, Team } from '../types';

const teamsStub: Team[] = [
  { id: 'A', name: 'Team A', abbreviation: 'A' },
  { id: 'B', name: 'Team B', abbreviation: 'B' },
  { id: 'C', name: 'Team C', abbreviation: 'C' },
];

/** Minimal draft classes so every team gets a score (may be 0). */
function minimalDraftClasses(): DraftClass[] {
  return [
    {
      year: 2021,
      picks: teamsStub.flatMap((t) => [
        {
          playerId: `${t.id}-1`,
          playerName: 'P',
          position: 'QB',
          round: 1,
          overallPick: 1,
          teamId: t.id,
          seasons: [],
        },
      ]),
    },
  ];
}

describe('getTeamRankSummary', () => {
  it('returns null when draftClasses is empty', () => {
    expect(
      getTeamRankSummary([], teamsStub, 'A', { draftingTeamOnly: true }),
    ).toBeNull();
  });

  it('sorts by score descending and assigns competition ranks (ties share rank)', () => {
    const dc: DraftClass[] = [
      {
        year: 2021,
        picks: [
          {
            playerId: 'p1',
            playerName: 'P1',
            position: 'QB',
            round: 1,
            overallPick: 1,
            teamId: 'A',
            seasons: [
              {
                year: 2021,
                gamesPlayed: 17,
                teamGames: 17,
                snapShare: 0.95,
                retained: true,
              },
            ],
          },
          {
            playerId: 'p2',
            playerName: 'P2',
            position: 'QB',
            round: 1,
            overallPick: 2,
            teamId: 'B',
            seasons: [
              {
                year: 2021,
                gamesPlayed: 17,
                teamGames: 17,
                snapShare: 0.95,
                retained: true,
              },
            ],
          },
          {
            playerId: 'p3',
            playerName: 'P3',
            position: 'QB',
            round: 1,
            overallPick: 3,
            teamId: 'C',
            seasons: [
              {
                year: 2021,
                gamesPlayed: 17,
                teamGames: 17,
                snapShare: 0.1,
                retained: true,
              },
            ],
          },
        ],
      },
    ];

    const twoTeams: Team[] = teamsStub.slice(0, 2);
    const dcTwo = {
      ...dc[0],
      picks: dc[0].picks.filter((p) => p.teamId === 'A' || p.teamId === 'B'),
    };
    const summary = getTeamRankSummary([dcTwo], twoTeams, 'B', {
      draftingTeamOnly: true,
    });
    expect(summary).not.toBeNull();
    expect(summary!.rankings).toHaveLength(2);
    expect(summary!.rankings[0].score).toBe(summary!.rankings[1].score);
    expect(summary!.rankings[0].rank).toBe(1);
    expect(summary!.rankings[1].rank).toBe(1);

    const full = getTeamRankSummary(dc, teamsStub, 'C', {
      draftingTeamOnly: true,
    });
    expect(full!.rankings[0].rank).toBe(1);
    expect(full!.rankings[1].rank).toBe(1);
    expect(full!.rankings[2].rank).toBe(3);
    expect(full!.rank).toBe(3);
  });

  it('sets selected rank to 0 when selectedTeam is null', () => {
    const s = getTeamRankSummary(minimalDraftClasses(), teamsStub, null, {
      draftingTeamOnly: true,
    });
    expect(s!.rank).toBe(0);
  });

  it('total matches teams length', () => {
    const s = getTeamRankSummary(minimalDraftClasses(), teamsStub, 'A', {
      draftingTeamOnly: true,
    });
    expect(s!.total).toBe(3);
  });
});
