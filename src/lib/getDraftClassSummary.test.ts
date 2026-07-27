import { describe, it, expect } from 'vitest';
import { getDraftClassSummary } from './getDraftClassSummary';
import { getPlayerDraftScore } from './getPlayerRole';
import type { DraftClass } from '../types';
import {
  makeNonContributorSeason,
  makePick as pick,
  makeSeason,
} from '../test/factories';

const coreSeason = [makeSeason({ snapShare: 0.95 })];
const nonContribSeason = [makeNonContributorSeason({ retained: false })];

describe('getDraftClassSummary', () => {
  it('counts QBs and WRs across all rounds, including picks awaiting data', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        pick({ playerId: 'q1', position: 'QB', round: 1, seasons: coreSeason }),
        pick({ playerId: 'q2', position: 'QB', round: 6, seasons: [] }),
        pick({ playerId: 'w1', position: 'WR', round: 2, seasons: coreSeason }),
        pick({ playerId: 'r1', position: 'RB', round: 3, seasons: coreSeason }),
      ],
    };

    const summary = getDraftClassSummary(draft);
    expect(summary.qbsTaken).toBe(2);
    expect(summary.wrsTaken).toBe(1);
  });

  it('averages draft score over tracked picks only (ignores awaiting-data)', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        pick({ playerId: 'p1', position: 'QB', seasons: coreSeason }),
        pick({ playerId: 'p2', position: 'WR', seasons: nonContribSeason }),
        pick({ playerId: 'p3', position: 'RB', seasons: [] }),
      ],
    };

    const tracked = draft.picks.filter((p) => p.seasons.length > 0);
    const expected =
      tracked.reduce((s, p) => s + getPlayerDraftScore(p), 0) / tracked.length;

    const summary = getDraftClassSummary(draft);
    expect(summary.tracked).toBe(2);
    expect(summary.avgScore).toBeCloseTo(expected);
  });

  it('counts core starters and misses (non_contributor only, excludes awaiting-data)', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        pick({ playerId: 'p1', position: 'QB', seasons: coreSeason }),
        pick({ playerId: 'p2', position: 'WR', seasons: nonContribSeason }),
        pick({ playerId: 'p3', position: 'RB', seasons: [] }),
      ],
    };

    const summary = getDraftClassSummary(draft);
    expect(summary.coreStarters).toBe(1);
    expect(summary.misses).toBe(1);
  });

  it('reports retained count and rate over tracked picks', () => {
    const draft: DraftClass = {
      year: 2023,
      picks: [
        pick({ playerId: 'p1', position: 'QB', seasons: coreSeason }),
        pick({ playerId: 'p2', position: 'WR', seasons: nonContribSeason }),
      ],
    };

    const summary = getDraftClassSummary(draft);
    expect(summary.retained).toBe(1);
    expect(summary.retentionRate).toBeCloseTo(0.5);
  });

  it('respects draftingTeamOnly', () => {
    const draft: DraftClass = {
      year: 2022,
      picks: [
        pick({
          playerId: 'p1',
          position: 'WR',
          seasons: [
            makeSeason({
              year: 2022,
              gamesPlayed: 2,
              snapShare: 0.05,
            }),
            makeSeason({ year: 2024, retained: false }),
          ],
        }),
      ],
    };

    const career = getDraftClassSummary(draft);
    const draftingOnly = getDraftClassSummary(draft, {
      draftingTeamOnly: true,
    });
    expect(draftingOnly.avgScore).toBeLessThan(career.avgScore);
  });

  it('handles zero picks', () => {
    const summary = getDraftClassSummary({ year: 2023, picks: [] });
    expect(summary).toEqual({
      tracked: 0,
      avgScore: 0,
      coreStarters: 0,
      misses: 0,
      qbsTaken: 0,
      wrsTaken: 0,
      retained: 0,
      retentionRate: 0,
    });
  });
});
