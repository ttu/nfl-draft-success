import { describe, it, expect } from 'vitest';
import { getPositionCohort } from './getPositionCohort';
import type { DraftClass, DraftPick } from '../types';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

const pick = (id: string, position: string, loads: number[]): DraftPick =>
  makePick({
    playerId: id,
    playerName: id.toUpperCase(),
    position,
    round: 2,
    overallPick: 40,
    seasons: loads.map((cumulativeSnapShare, i) =>
      makeSeason({
        year: 2021 + i,
        snapShare: cumulativeSnapShare,
        cumulativeSnapShare,
      }),
    ),
  });

const classes = (year: number, picks: DraftPick[]): DraftClass[] => [
  makeDraftClass({ year, picks }),
];

describe('score is the drafting-team draft score', () => {
  it('ignores seasons played after leaving the drafting team', () => {
    const mk = (id: string, retained: boolean) =>
      makePick({
        playerId: id,
        position: 'G',
        round: 5,
        seasons: [
          makeSeason({ year: 2021, snapShare: 0.2, cumulativeSnapShare: 0.2 }),
          makeSeason({
            year: 2022,
            snapShare: 1,
            cumulativeSnapShare: 1,
            retained,
          }),
        ],
      });
    const stayed = mk('stayed', true);
    const left = mk('left', false);
    const { members } = getPositionCohort(
      classes(2021, [left, stayed]),
      2021,
      left,
    );
    expect(members.map((m) => m.pick.playerId)).toEqual(['stayed', 'left']);
    expect(members[0].score).toBeGreaterThan(members[1].score);
  });
});

describe('getPositionCohort', () => {
  const target = pick('target', 'WR', [0.5]);
  const higher = pick('higher', 'WR', [0.9]);
  const lower = pick('lower', 'WR', [0.2]);
  const otherPos = pick('rb', 'RB', [0.99]);

  it('includes only same-position picks from the target draft year, sorted by draft score desc', () => {
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

  it('limits the cohort to the top N by draft score', () => {
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
    // p11 has the lowest score, so it is outside the top 8.
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
