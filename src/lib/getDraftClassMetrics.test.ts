import { describe, it, expect } from 'vitest';
import { getDraftClassMetrics } from './getDraftClassMetrics';
import { getPlayerDraftScore } from './getPlayerRole';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

describe('getDraftClassMetrics', () => {
  it('reports draftScore as the mean per-pick draft score across scored picks (ignoring awaiting-data picks)', () => {
    const draft = makeDraftClass({
      picks: [
        makePick({
          playerName: 'Starter',
          position: 'QB',
          overallPick: 5,
          seasons: [makeSeason()],
        }),
        makePick({
          playerName: 'Depth',
          position: 'WR',
          round: 5,
          overallPick: 150,
          seasons: [makeSeason({ gamesPlayed: 4, snapShare: 0.2 })],
        }),
        makePick({
          playerId: 'rook',
          playerName: 'Awaiting data',
          position: 'RB',
          round: 3,
          overallPick: 90,
        }),
      ],
    });

    const scored = draft.picks.filter((p) => p.seasons.length > 0);
    const expected =
      scored.reduce((sum, p) => sum + getPlayerDraftScore(p), 0) /
      scored.length;

    expect(getDraftClassMetrics(draft, 'KC').draftScore).toBeCloseTo(expected);
  });

  it('returns total picks, core starter count, contributor count, retention count, rates', () => {
    const draft = makeDraftClass({
      picks: [
        makePick({
          playerName: 'Starter',
          position: 'QB',
          overallPick: 5,
          seasons: [makeSeason({ snapShare: 0.95 })],
        }),
        makePick({
          playerName: 'Depth',
          position: 'WR',
          round: 5,
          overallPick: 150,
          seasons: [makeSeason({ gamesPlayed: 3, snapShare: 0.15 })],
        }),
        makePick({
          playerName: 'Gone',
          position: 'CB',
          round: 7,
          overallPick: 220,
          seasons: [
            makeSeason({ gamesPlayed: 2, snapShare: 0.05, retained: false }),
          ],
        }),
      ],
    });

    const metrics = getDraftClassMetrics(draft, 'KC');

    expect(metrics.totalPicks).toBe(3);
    expect(metrics.awaitingDataCount).toBe(0);
    expect(metrics.coreStarterCount).toBe(1);
    expect(metrics.starterWhenHealthyCount).toBe(0);
    expect(metrics.contributorRoleCount).toBe(0);
    expect(metrics.contributorCount).toBe(2);
    expect(metrics.retentionCount).toBe(2);
    expect(metrics.coreStarterRate).toBeCloseTo(1 / 3);
    expect(metrics.contributorRate).toBeCloseTo(2 / 3);
    expect(metrics.retentionRate).toBeCloseTo(2 / 3);
  });

  it('filters by teamId', () => {
    const draft = makeDraftClass({
      picks: [
        makePick({ playerName: 'A', position: 'QB', overallPick: 5 }),
        makePick({
          playerName: 'B',
          position: 'WR',
          overallPick: 10,
          teamId: 'BUF',
        }),
      ],
    });

    expect(getDraftClassMetrics(draft, 'KC').totalPicks).toBe(1);
    expect(getDraftClassMetrics(draft, 'KC').awaitingDataCount).toBe(1);
    expect(getDraftClassMetrics(draft, 'BUF').totalPicks).toBe(1);
    expect(getDraftClassMetrics(draft, 'BUF').awaitingDataCount).toBe(1);
  });

  it('uses drafting-team-only seasons when draftingTeamOnly is true', () => {
    const draft = makeDraftClass({
      year: 2022,
      picks: [
        makePick({
          playerName: 'Blossomed elsewhere',
          position: 'WR',
          round: 3,
          overallPick: 80,
          seasons: [
            makeSeason({ year: 2022, gamesPlayed: 2, snapShare: 0.05 }),
            makeSeason({ year: 2024, snapShare: 0.85, retained: false }),
          ],
        }),
      ],
    });

    const career = getDraftClassMetrics(draft, 'KC');
    const draftingOnly = getDraftClassMetrics(draft, 'KC', {
      draftingTeamOnly: true,
    });

    expect(career.coreStarterCount).toBe(0);
    expect(draftingOnly.coreStarterCount).toBe(0);
    expect(draftingOnly.nonContributorCount).toBe(1);
  });

  it('handles zero picks', () => {
    const metrics = getDraftClassMetrics(makeDraftClass(), 'KC');

    expect(metrics.totalPicks).toBe(0);
    expect(metrics.awaitingDataCount).toBe(0);
    expect(metrics.coreStarterCount).toBe(0);
    expect(metrics.contributorRoleCount).toBe(0);
    expect(metrics.contributorCount).toBe(0);
    expect(metrics.retentionCount).toBe(0);
    expect(metrics.coreStarterRate).toBe(0);
    expect(metrics.contributorRate).toBe(0);
    expect(metrics.retentionRate).toBe(0);
  });
});
