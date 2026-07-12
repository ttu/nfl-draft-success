import { describe, it, expect } from 'vitest';
import { getScoreByYear } from './getScoreByYear';
import { getDraftClassMetrics } from './getDraftClassMetrics';
import type { DraftClass } from '../types';

const scoredPick = (year: number, snapShare: number): DraftClass => ({
  year,
  picks: [
    {
      playerId: `p-${year}`,
      playerName: `Pick ${year}`,
      position: 'WR',
      round: 2,
      overallPick: 40,
      teamId: 'KC',
      seasons: [
        { year, gamesPlayed: 16, teamGames: 17, snapShare, retained: true },
      ],
    },
  ],
});

const emptyClass = (year: number): DraftClass => ({
  year,
  picks: [
    {
      playerId: `rook-${year}`,
      playerName: 'Rookie',
      position: 'QB',
      round: 1,
      overallPick: 1,
      teamId: 'KC',
      seasons: [],
    },
  ],
});

describe('getScoreByYear', () => {
  it('returns one entry per class, ascending by year', () => {
    const result = getScoreByYear(
      [scoredPick(2023, 0.5), scoredPick(2021, 0.9), scoredPick(2022, 0.7)],
      'KC',
    );
    expect(result.map((r) => r.year)).toEqual([2021, 2022, 2023]);
  });

  it('scores each class as its mean per-pick draft score (reconciles with the headline)', () => {
    const classes = [scoredPick(2021, 0.9), scoredPick(2022, 0.4)];
    const result = getScoreByYear(classes, 'KC');
    for (const dc of classes) {
      const expected = getDraftClassMetrics(dc, 'KC').draftScore;
      const point = result.find((r) => r.year === dc.year);
      expect(point?.score).toBeCloseTo(expected);
      expect(point?.hasData).toBe(true);
    }
  });

  it('flags classes with no scored picks as hasData false, score 0', () => {
    const result = getScoreByYear(
      [scoredPick(2021, 0.9), emptyClass(2025)],
      'KC',
    );
    const empty = result.find((r) => r.year === 2025);
    expect(empty?.hasData).toBe(false);
    expect(empty?.score).toBe(0);
  });

  it('forwards the draftingTeamOnly option', () => {
    const dc: DraftClass = {
      year: 2021,
      picks: [
        {
          playerId: 'mixed',
          playerName: 'Mixed',
          position: 'WR',
          round: 5,
          overallPick: 150,
          teamId: 'KC',
          seasons: [
            {
              year: 2021,
              gamesPlayed: 2,
              teamGames: 17,
              snapShare: 0.05,
              retained: false,
            },
            {
              year: 2022,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.9,
              retained: true,
            },
          ],
        },
      ],
    };
    const career = getScoreByYear([dc], 'KC')[0].score;
    const draftingOnly = getScoreByYear([dc], 'KC', {
      draftingTeamOnly: true,
    })[0].score;
    expect(draftingOnly).toBeGreaterThan(career);
  });

  it('returns an empty array when there are no classes', () => {
    expect(getScoreByYear([], 'KC')).toEqual([]);
  });
});
