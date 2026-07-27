import { describe, it, expect } from 'vitest';
import {
  DRAFT_SLOT_MATURITY_LAG,
  collectMatureDraftSlotPoints,
  deriveDraftSlotCurve,
} from './deriveDraftSlotBaseline';
import { expectedScore } from './draftSlotBaseline';
import type { DraftClass, DraftPick, Season } from '../types';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

const season = (overrides: Partial<Season> = {}): Season =>
  makeSeason({ year: 2019, teamGames: 16, ...overrides });

const pick = (overallPick: number, seasons: Season[] = [season()]): DraftPick =>
  makePick({
    playerName: `Player ${overallPick}`,
    position: 'WR',
    round: Math.ceil(overallPick / 32),
    overallPick,
    seasons,
  });

// Maturity is measured relative to the latest class present in the data, so
// every scenario anchors that latest year explicitly.
const LATEST = 2030;
const MATURE = LATEST - DRAFT_SLOT_MATURITY_LAG; // newest class old enough
const IMMATURE = LATEST - DRAFT_SLOT_MATURITY_LAG + 1; // one year too new

describe('collectMatureDraftSlotPoints', () => {
  it('includes only picks from classes at least the maturity lag old', () => {
    const classes: DraftClass[] = [
      makeDraftClass({ year: MATURE, picks: [pick(1), pick(40)] }),
      makeDraftClass({ year: IMMATURE, picks: [pick(2), pick(50)] }),
      makeDraftClass({ year: LATEST, picks: [pick(3)] }), // anchors "latest"
    ];

    const points = collectMatureDraftSlotPoints(classes);

    expect(points.map((p) => p.overallPick).sort((a, b) => a - b)).toEqual([
      1, 40,
    ]);
  });

  it('excludes picks that have no season rows yet', () => {
    const classes: DraftClass[] = [
      makeDraftClass({ year: MATURE, picks: [pick(1), pick(40, [])] }),
      makeDraftClass({ year: LATEST, picks: [pick(3)] }),
    ];

    const points = collectMatureDraftSlotPoints(classes);

    expect(points).toHaveLength(1);
    expect(points[0].overallPick).toBe(1);
  });
});

describe('deriveDraftSlotCurve', () => {
  it('fits a decreasing curve and reports the mature span used', () => {
    // Early picks earn more snaps than late picks.
    const classes: DraftClass[] = [
      makeDraftClass({
        year: MATURE,
        picks: [
          pick(1, [season({ snapShare: 0.95 })]),
          pick(5, [season({ snapShare: 0.9 })]),
          pick(120, [season({ snapShare: 0.2 })]),
          pick(230, [season({ snapShare: 0.15 })]),
        ],
      }),
      makeDraftClass({
        year: LATEST,
        picks: [pick(3, [season({ snapShare: 0.9 })])],
      }),
    ];

    const result = deriveDraftSlotCurve(classes);

    expect(expectedScore(result.curve, 1)).toBeGreaterThan(
      expectedScore(result.curve, 230),
    );
    expect(result.pointCount).toBe(4);
    expect(result.matureFrom).toBe(MATURE);
    expect(result.matureTo).toBe(MATURE);
  });
});
