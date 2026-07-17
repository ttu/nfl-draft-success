import { describe, it, expect } from 'vitest';
import { getLeagueContext } from './getLeagueContext';
import type { DraftClass, DraftPick, Season, Team } from '../types';

const teams: Team[] = [
  { id: 'A', name: 'Team A', abbreviation: 'A' },
  { id: 'B', name: 'Team B', abbreviation: 'B' },
  { id: 'C', name: 'Team C', abbreviation: 'C' },
];

// Fixtures use the unknown position `ZZ` (baseline 1.0), so scores are not
// position-adjusted here; that behaviour lives in snapShareForTier.test.ts.
/** Single-season pick producing a deterministic role/score. */
function pick(
  teamId: string,
  snapShare: number,
  gamesPlayed: number,
): DraftPick {
  const season: Season = {
    year: 2021,
    gamesPlayed,
    teamGames: 16,
    snapShare,
    retained: true,
  };
  return {
    playerId: `${teamId}-p`,
    playerName: 'P',
    position: 'ZZ',
    round: 1,
    overallPick: 1,
    teamId,
    seasons: [season],
  };
}

/** Pick with no season rows yet (awaiting NFL data). */
function awaitingPick(teamId: string): DraftPick {
  return {
    playerId: `${teamId}-await`,
    playerName: 'P',
    position: 'ZZ',
    round: 1,
    overallPick: 1,
    teamId,
    seasons: [],
  };
}

// core_starter: 0.9 load, full availability -> score 93
// contributor:  0.25 load, full availability -> score 47.5
// non_contributor: 0.05 load, 1/16 availability -> score ~5.375
function classesAllThree(): DraftClass[] {
  return [
    {
      year: 2021,
      picks: [
        pick('A', 0.9, 16), // core_starter, 93
        pick('B', 0.05, 1), // non_contributor, ~5.375
        pick('C', 0.25, 16), // contributor, 47.5
      ],
    },
  ];
}

describe('getLeagueContext', () => {
  it('returns zeros and null spread for empty draft classes', () => {
    const ctx = getLeagueContext([], teams, { draftingTeamOnly: false });
    expect(ctx.avgScore).toBe(0);
    expect(ctx.spread).toBeNull();
    expect(ctx.roleDistribution.total).toBe(0);
    expect(ctx.roleDistribution.corePct).toBe(0);
    expect(ctx.roleDistribution.contributorPct).toBe(0);
    expect(ctx.roleDistribution.nonContributorPct).toBe(0);
  });

  it('averages only teams with scored picks', () => {
    const ctx = getLeagueContext(classesAllThree(), teams, {
      draftingTeamOnly: false,
    });
    // mean(93, 5.375, 47.5) = 48.625
    expect(ctx.avgScore).toBeCloseTo(48.625, 3);
  });

  it('reports spread between top and bottom scoring teams', () => {
    const ctx = getLeagueContext(classesAllThree(), teams, {
      draftingTeamOnly: false,
    });
    expect(ctx.spread).not.toBeNull();
    expect(ctx.spread!.topId).toBe('A');
    expect(ctx.spread!.bottomId).toBe('B');
    expect(ctx.spread!.topScore).toBeCloseTo(93, 3);
    expect(ctx.spread!.bottomScore).toBeCloseTo(5.375, 3);
    expect(ctx.spread!.gap).toBeCloseTo(87.625, 3);
  });

  it('returns null spread when fewer than two teams have scored picks', () => {
    const classes: DraftClass[] = [{ year: 2021, picks: [pick('A', 0.9, 16)] }];
    const ctx = getLeagueContext(classes, teams, { draftingTeamOnly: false });
    expect(ctx.spread).toBeNull();
    expect(ctx.avgScore).toBeCloseTo(93, 3);
  });

  it('buckets roles into core / contributor / non-contributor', () => {
    const ctx = getLeagueContext(classesAllThree(), teams, {
      draftingTeamOnly: false,
    });
    const rd = ctx.roleDistribution;
    expect(rd.coreCount).toBe(1); // A
    expect(rd.contributorCount).toBe(1); // C
    expect(rd.nonContributorCount).toBe(1); // B
    expect(rd.total).toBe(3);
    expect(rd.corePct).toBeCloseTo(1 / 3, 5);
    expect(rd.contributorPct).toBeCloseTo(1 / 3, 5);
    expect(rd.nonContributorPct).toBeCloseTo(1 / 3, 5);
  });

  it('excludes awaiting-data picks from averages and role counts', () => {
    const classes: DraftClass[] = [
      {
        year: 2021,
        picks: [pick('A', 0.9, 16), awaitingPick('B'), awaitingPick('C')],
      },
    ];
    const ctx = getLeagueContext(classes, teams, { draftingTeamOnly: false });
    // Only A has a scored pick.
    expect(ctx.avgScore).toBeCloseTo(93, 3);
    expect(ctx.spread).toBeNull();
    expect(ctx.roleDistribution.total).toBe(1);
    expect(ctx.roleDistribution.coreCount).toBe(1);
  });

  it('aggregates role counts across all provided draft years', () => {
    const classes: DraftClass[] = [
      { year: 2020, picks: [pick('A', 0.9, 16)] },
      { year: 2021, picks: [pick('A', 0.9, 16)] },
    ];
    const ctx = getLeagueContext(classes, teams, { draftingTeamOnly: false });
    expect(ctx.roleDistribution.coreCount).toBe(2);
    expect(ctx.roleDistribution.total).toBe(2);
  });
});
