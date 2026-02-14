import { describe, it, expect } from 'vitest';
import { getDraftClassMetrics } from './getDraftClassMetrics';
import type { DraftClass } from '../types';

describe('getDraftClassMetrics', () => {
  it('returns total picks, core starter count, contributor count, retention count, rates', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        {
          playerId: 'p1',
          playerName: 'Starter',
          position: 'QB',
          round: 1,
          overallPick: 5,
          teamId: 'KC',
          seasons: [
            {
              year: 2023,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: true,
            },
          ],
        },
        {
          playerId: 'p2',
          playerName: 'Depth',
          position: 'WR',
          round: 5,
          overallPick: 150,
          teamId: 'KC',
          seasons: [
            {
              year: 2023,
              gamesPlayed: 3,
              teamGames: 17,
              snapShare: 0.15,
              retained: true,
            },
          ],
        },
        {
          playerId: 'p3',
          playerName: 'Gone',
          position: 'CB',
          round: 7,
          overallPick: 220,
          teamId: 'KC',
          seasons: [
            {
              year: 2023,
              gamesPlayed: 2,
              teamGames: 17,
              snapShare: 0.05,
              retained: false,
            },
          ],
        },
      ],
    };

    const metrics = getDraftClassMetrics(draft, 'KC');

    expect(metrics.totalPicks).toBe(3);
    expect(metrics.coreStarterCount).toBe(1);
    expect(metrics.starterWhenHealthyCount).toBe(0);
    expect(metrics.contributorCount).toBe(2);
    expect(metrics.retentionCount).toBe(2);
    expect(metrics.coreStarterRate).toBeCloseTo(1 / 3);
    expect(metrics.contributorRate).toBeCloseTo(2 / 3);
    expect(metrics.retentionRate).toBeCloseTo(2 / 3);
  });

  it('filters by teamId', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        {
          playerId: 'p1',
          playerName: 'A',
          position: 'QB',
          round: 1,
          overallPick: 5,
          teamId: 'KC',
          seasons: [],
        },
        {
          playerId: 'p2',
          playerName: 'B',
          position: 'WR',
          round: 1,
          overallPick: 10,
          teamId: 'BUF',
          seasons: [],
        },
      ],
    };

    expect(getDraftClassMetrics(draft, 'KC').totalPicks).toBe(1);
    expect(getDraftClassMetrics(draft, 'BUF').totalPicks).toBe(1);
  });

  it('handles zero picks', () => {
    const draft: DraftClass = { year: 2023, picks: [] };
    const metrics = getDraftClassMetrics(draft, 'KC');

    expect(metrics.totalPicks).toBe(0);
    expect(metrics.coreStarterCount).toBe(0);
    expect(metrics.contributorCount).toBe(0);
    expect(metrics.retentionCount).toBe(0);
    expect(metrics.coreStarterRate).toBe(0);
    expect(metrics.contributorRate).toBe(0);
    expect(metrics.retentionRate).toBe(0);
  });
});
