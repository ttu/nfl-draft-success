import { describe, it, expect } from 'vitest';
import { getFreeAgentScore, getTeamFreeAgents } from './getFreeAgentScore';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeSeason } from '../test/factories';

function classWith(
  year: number,
  members: {
    id: string;
    teamId: string;
    snapShare?: number;
    retained?: boolean;
  }[],
) {
  return stampFreeAgentYear({
    year,
    freeAgents: members.map((m) => ({
      playerId: m.id,
      playerName: m.id,
      position: 'ZZ',
      teamId: m.teamId,
      seasons: [
        makeSeason({
          year,
          snapShare: m.snapShare ?? 0.9,
          retained: m.retained ?? true,
        }),
      ],
    })),
  });
}

describe('getTeamFreeAgents', () => {
  it('returns only the requested team, in class order', () => {
    const classes = [
      classWith(2020, [
        { id: 'a', teamId: 'BUF' },
        { id: 'b', teamId: 'NYJ' },
      ]),
      classWith(2021, [{ id: 'c', teamId: 'BUF' }]),
    ];
    expect(getTeamFreeAgents(classes, 'BUF').map((f) => f.playerId)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('getFreeAgentScore', () => {
  it('averages over members with season data', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'BUF' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result.scoredCount).toBe(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it('reports over-slot against the free-agent baseline, not a draft slot', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'BUF' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result.skillScore).toBeGreaterThan(0);
    expect(result.skillScore).toBeLessThan(result.score);
  });

  it('returns zeroes for a team with no free agents', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'NYJ' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result).toMatchObject({
      score: 0,
      skillScore: 0,
      totalFreeAgents: 0,
      scoredCount: 0,
      coreStarterRate: 0,
      retentionRate: 0,
    });
  });

  it('counts a departed free agent against retention', () => {
    const classes = [
      classWith(2020, [{ id: 'a', teamId: 'BUF', retained: false }]),
    ];
    expect(getFreeAgentScore(classes, 'BUF').retentionRate).toBe(0);
  });
});
