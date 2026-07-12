import { describe, it, expect } from 'vitest';
import { getPositionCohort, avgLoad } from './getPositionCohort';
import type { DraftClass, DraftPick } from '../types';

const pick = (id: string, position: string, loads: number[]): DraftPick => ({
  playerId: id,
  playerName: id.toUpperCase(),
  position,
  round: 2,
  overallPick: 40,
  teamId: 'KC',
  seasons: loads.map((cumulativeSnapShare, i) => ({
    year: 2021 + i,
    gamesPlayed: 16,
    teamGames: 17,
    snapShare: cumulativeSnapShare,
    cumulativeSnapShare,
    retained: true,
  })),
});

const classes = (year: number, picks: DraftPick[]): DraftClass[] => [
  { year, picks },
];

describe('avgLoad', () => {
  it('averages cumulativeSnapShare across seasons', () => {
    expect(avgLoad(pick('a', 'WR', [0.4, 0.8]))).toBeCloseTo(0.6);
  });

  it('returns 0 for a pick with no seasons', () => {
    expect(avgLoad(pick('a', 'WR', []))).toBe(0);
  });

  it('falls back to snapShare when cumulativeSnapShare is absent', () => {
    const p: DraftPick = {
      playerId: 'a',
      playerName: 'A',
      position: 'WR',
      round: 2,
      overallPick: 40,
      teamId: 'KC',
      seasons: [
        {
          year: 2021,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.5,
          retained: true,
        },
      ],
    };
    expect(avgLoad(p)).toBeCloseTo(0.5);
  });
});

describe('getPositionCohort', () => {
  const target = pick('target', 'WR', [0.5]);
  const higher = pick('higher', 'WR', [0.9]);
  const lower = pick('lower', 'WR', [0.2]);
  const otherPos = pick('rb', 'RB', [0.99]);

  it('includes only same-position picks from the target draft year, sorted by load desc', () => {
    const cohort = getPositionCohort(
      classes(2021, [lower, target, higher, otherPos]),
      2021,
      target,
    );
    expect(cohort.members.map((m) => m.pick.playerId)).toEqual([
      'higher',
      'target',
      'lower',
    ]);
  });

  it('reports the 1-based rank of the target within the cohort', () => {
    const cohort = getPositionCohort(
      classes(2021, [lower, target, higher]),
      2021,
      target,
    );
    expect(cohort.rank).toBe(2);
  });

  it('limits the cohort to the top N by load', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      pick(`p${i}`, 'WR', [i / 12]),
    );
    const cohort = getPositionCohort(classes(2021, many), 2021, many[0], {}, 8);
    expect(cohort.members).toHaveLength(8);
  });

  it('reports rank 0 when the target falls outside the limited cohort', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      pick(`p${i}`, 'WR', [(12 - i) / 12]),
    );
    // p11 has the lowest load, so it is outside the top 8.
    const cohort = getPositionCohort(
      classes(2021, many),
      2021,
      many[11],
      {},
      8,
    );
    expect(cohort.rank).toBe(0);
  });

  it('returns an empty cohort when the draft year is missing', () => {
    const cohort = getPositionCohort(classes(2021, [target]), 2099, target);
    expect(cohort.members).toEqual([]);
    expect(cohort.rank).toBe(0);
  });

  it('carries each member role via getPlayerRole', () => {
    const cohort = getPositionCohort(classes(2021, [higher]), 2021, higher);
    expect(cohort.members[0].role).toBe('core_starter');
  });
});
