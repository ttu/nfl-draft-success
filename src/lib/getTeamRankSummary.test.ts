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

/** A single scored pick for a team in a season. */
function scoredPick(
  teamId: string,
  id: string,
  snapShare: number,
  year: number,
) {
  return {
    playerId: id,
    playerName: id,
    position: 'QB',
    round: 1,
    overallPick: 1,
    teamId,
    seasons: [
      { year, gamesPlayed: 17, teamGames: 17, snapShare, retained: true },
    ],
  };
}

describe('getTeamRankSummary extended per-team stats', () => {
  const twoTeams: Team[] = teamsStub.slice(0, 2); // A, B

  /**
   * Two-year window where the ordering flips between years:
   *   2021 → B strong, A weak    2022 → A strong, B weak
   * Full-window means are symmetric (A and B tie), but the prior window
   * (2021 only) ranks B above A, so A moves up when 2022 is added.
   */
  function flipDraftClasses(): DraftClass[] {
    return [
      {
        year: 2021,
        picks: [
          scoredPick('A', 'a21', 0.3, 2021),
          scoredPick('B', 'b21', 0.95, 2021),
        ],
      },
      {
        year: 2022,
        picks: [
          scoredPick('A', 'a22', 0.95, 2022),
          scoredPick('B', 'b22', 0.3, 2022),
        ],
      },
    ];
  }

  it('populates picks, coreRate and retentionRate for each team', () => {
    const s = getTeamRankSummary(flipDraftClasses(), twoTeams, 'A', {
      draftingTeamOnly: true,
    });
    const a = s!.rankings.find((r) => r.teamId === 'A')!;
    expect(a.picks).toBe(2);
    expect(a.coreRate).toBeGreaterThanOrEqual(0);
    expect(a.coreRate).toBeLessThanOrEqual(1);
    expect(a.retentionRate).toBe(1);
  });

  it('builds a per-year trend, oldest to newest, over years with scored picks', () => {
    const s = getTeamRankSummary(flipDraftClasses(), twoTeams, 'A', {
      draftingTeamOnly: true,
    });
    const a = s!.rankings.find((r) => r.teamId === 'A')!;
    expect(a.trend).toHaveLength(2);
    // A improved from 2021 (0.3 snaps) to 2022 (0.95 snaps)
    expect(a.trend[1]).toBeGreaterThan(a.trend[0]);
  });

  it('computes YoY change vs the prior window (dropping the most recent year)', () => {
    const s = getTeamRankSummary(flipDraftClasses(), twoTeams, 'A', {
      draftingTeamOnly: true,
    });
    const a = s!.rankings.find((r) => r.teamId === 'A')!;
    const b = s!.rankings.find((r) => r.teamId === 'B')!;
    // Prior (2021 only): B rank 1, A rank 2. Full window: A and B tie at rank 1.
    expect(a.change).toBe(1); // A moved up one spot
    expect(b.change).toBe(0);
  });

  it('leaves change undefined when there is no prior window (single year)', () => {
    const s = getTeamRankSummary(minimalDraftClasses(), teamsStub, 'A', {
      draftingTeamOnly: true,
    });
    for (const r of s!.rankings) {
      expect(r.change).toBeUndefined();
    }
  });
});
