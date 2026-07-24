import { describe, it, expect } from 'vitest';
import {
  DRAFT_SLOT_MATURITY_LAG,
  collectMatureDraftSlotPoints,
  deriveDraftSlotFit,
} from './deriveDraftSlotBaseline';
import type { DraftClass, DraftPick, Season } from '../types';

function season(overrides: Partial<Season> = {}): Season {
  return {
    year: 2019,
    gamesPlayed: 16,
    teamGames: 16,
    snapShare: 0.9,
    retained: true,
    ...overrides,
  };
}

function pick(overallPick: number, seasons: Season[] = [season()]): DraftPick {
  return {
    playerId: `p${overallPick}`,
    playerName: `Player ${overallPick}`,
    position: 'WR',
    round: Math.ceil(overallPick / 32),
    overallPick,
    teamId: 'KC',
    seasons,
  };
}

// Maturity is measured relative to the latest class present in the data, so
// every scenario anchors that latest year explicitly.
const LATEST = 2030;
const MATURE = LATEST - DRAFT_SLOT_MATURITY_LAG; // newest class old enough
const IMMATURE = LATEST - DRAFT_SLOT_MATURITY_LAG + 1; // one year too new

describe('collectMatureDraftSlotPoints', () => {
  it('includes only picks from classes at least the maturity lag old', () => {
    const classes: DraftClass[] = [
      { year: MATURE, picks: [pick(1), pick(40)] },
      { year: IMMATURE, picks: [pick(2), pick(50)] },
      { year: LATEST, picks: [pick(3)] }, // anchors "latest"
    ];

    const points = collectMatureDraftSlotPoints(classes);

    expect(points.map((p) => p.overallPick).sort((a, b) => a - b)).toEqual([
      1, 40,
    ]);
  });

  it('excludes picks that have no season rows yet', () => {
    const classes: DraftClass[] = [
      { year: MATURE, picks: [pick(1), pick(40, [])] },
      { year: LATEST, picks: [pick(3)] },
    ];

    const points = collectMatureDraftSlotPoints(classes);

    expect(points).toHaveLength(1);
    expect(points[0].overallPick).toBe(1);
  });
});

describe('deriveDraftSlotFit', () => {
  it('fits a decreasing curve and reports the mature span used', () => {
    // Early picks earn more snaps than late picks.
    const classes: DraftClass[] = [
      {
        year: MATURE,
        picks: [
          pick(1, [season({ snapShare: 0.95 })]),
          pick(5, [season({ snapShare: 0.9 })]),
          pick(120, [season({ snapShare: 0.2 })]),
          pick(230, [season({ snapShare: 0.15 })]),
        ],
      },
      { year: LATEST, picks: [pick(3, [season({ snapShare: 0.9 })])] },
    ];

    const result = deriveDraftSlotFit(classes);

    expect(result.fit.b).toBeLessThan(0);
    expect(result.pointCount).toBe(4);
    expect(result.matureFrom).toBe(MATURE);
    expect(result.matureTo).toBe(MATURE);
  });
});
