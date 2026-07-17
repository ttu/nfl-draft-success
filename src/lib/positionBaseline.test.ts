import { describe, it, expect } from 'vitest';
import {
  baselinePositions,
  getPositionBaseline,
  getPositionTierThresholds,
  isBaselineExemptPosition,
  normalizeSnapShareForPosition,
} from './positionBaseline';
import {
  CORE_TIER_THRESHOLD,
  SIGNIFICANT_TIER_THRESHOLD,
  SIGNIFICANT_TIER_THRESHOLD_SPECIALIST,
  DEPTH_TIER_THRESHOLD,
} from './classifyRole';

describe('isBaselineExemptPosition', () => {
  it('exempts kickers, punters and long snappers', () => {
    for (const pos of ['K', 'P', 'LS']) {
      expect(isBaselineExemptPosition(pos)).toBe(true);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isBaselineExemptPosition(' k ')).toBe(true);
    expect(isBaselineExemptPosition('ls')).toBe(true);
  });

  it('does not exempt scrimmage positions', () => {
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'OT', 'DT', 'CB']) {
      expect(isBaselineExemptPosition(pos)).toBe(false);
    }
  });
});

describe('getPositionBaseline', () => {
  it('returns the derived baseline for a known position', () => {
    // RB rotate heavily; a full-time back is well short of every snap.
    const rb = getPositionBaseline('RB');
    expect(rb).toBeGreaterThan(0.5);
    expect(rb).toBeLessThan(0.8);
  });

  it('gives interior offensive line a near-every-snap baseline', () => {
    // The current model is implicitly calibrated for OL, so their baseline
    // must stay ~1.0 for scoring to be unchanged there.
    expect(getPositionBaseline('C')).toBeGreaterThanOrEqual(0.99);
  });

  it('ranks positions in the expected football order', () => {
    expect(getPositionBaseline('C')).toBeGreaterThan(getPositionBaseline('WR'));
    expect(getPositionBaseline('WR')).toBeGreaterThan(
      getPositionBaseline('TE'),
    );
    expect(getPositionBaseline('TE')).toBeGreaterThan(
      getPositionBaseline('RB'),
    );
  });

  it('falls back to 1.0 for unknown positions (today’s behaviour)', () => {
    expect(getPositionBaseline('XYZ')).toBe(1);
    expect(getPositionBaseline('')).toBe(1);
    expect(getPositionBaseline(undefined)).toBe(1);
  });

  it('falls back to 1.0 for exempt specialists so they are never rescaled', () => {
    expect(getPositionBaseline('K')).toBe(1);
    expect(getPositionBaseline('P')).toBe(1);
    expect(getPositionBaseline('LS')).toBe(1);
  });

  it('normalizes case and whitespace when looking up', () => {
    expect(getPositionBaseline(' rb ')).toBe(getPositionBaseline('RB'));
  });

  it('never returns a baseline that could divide by zero', () => {
    for (const pos of ['RB', 'K', 'XYZ', '']) {
      expect(getPositionBaseline(pos)).toBeGreaterThan(0);
    }
  });
});

describe('normalizeSnapShareForPosition', () => {
  it('scales a share by the position baseline', () => {
    // A RB at the baseline is carrying a full-time starter's workload.
    const rb = getPositionBaseline('RB');
    expect(normalizeSnapShareForPosition(rb, 'RB')).toBeCloseTo(1, 5);
    expect(normalizeSnapShareForPosition(rb / 2, 'RB')).toBeCloseTo(0.5, 5);
  });

  it('clamps at 1 so exceeding the baseline cannot inflate the score', () => {
    expect(normalizeSnapShareForPosition(0.99, 'RB')).toBe(1);
  });

  it('leaves specialists untouched', () => {
    expect(normalizeSnapShareForPosition(0.41, 'K')).toBeCloseTo(0.41, 5);
    expect(normalizeSnapShareForPosition(0.48, 'P')).toBeCloseTo(0.48, 5);
  });

  it('leaves unknown positions untouched', () => {
    expect(normalizeSnapShareForPosition(0.5, 'XYZ')).toBeCloseTo(0.5, 5);
  });

  it('leaves near-every-snap positions materially unchanged', () => {
    // The point of the change: OL scoring must not move.
    expect(normalizeSnapShareForPosition(0.65, 'C')).toBeCloseTo(0.65, 2);
  });

  it('floors at 0 and handles a zero share', () => {
    expect(normalizeSnapShareForPosition(0, 'RB')).toBe(0);
    expect(normalizeSnapShareForPosition(-0.1, 'RB')).toBe(0);
  });
});

describe('getPositionTierThresholds', () => {
  it('returns the generic rule for an unknown/undefined position', () => {
    const t = getPositionTierThresholds(undefined);
    expect(t.core).toBeCloseTo(CORE_TIER_THRESHOLD, 10);
    expect(t.significant).toBeCloseTo(SIGNIFICANT_TIER_THRESHOLD, 10);
    expect(t.depth).toBeCloseTo(DEPTH_TIER_THRESHOLD, 10);
  });

  it('scales every band by the position baseline', () => {
    const b = getPositionBaseline('RB');
    const t = getPositionTierThresholds('RB');
    expect(t.core).toBeCloseTo(CORE_TIER_THRESHOLD * b, 10);
    expect(t.significant).toBeCloseTo(SIGNIFICANT_TIER_THRESHOLD * b, 10);
    expect(t.depth).toBeCloseTo(DEPTH_TIER_THRESHOLD * b, 10);
    // A full-time RB is well below a lineman's Core bar.
    expect(t.core).toBeLessThan(0.5);
  });

  it('uses the specialist Significant floor, unscaled, for K/P/LS', () => {
    const t = getPositionTierThresholds('K');
    expect(t.core).toBeCloseTo(CORE_TIER_THRESHOLD, 10);
    expect(t.significant).toBeCloseTo(
      SIGNIFICANT_TIER_THRESHOLD_SPECIALIST,
      10,
    );
    expect(t.depth).toBeCloseTo(DEPTH_TIER_THRESHOLD, 10);
  });

  it('keeps bands ordered core > significant > depth', () => {
    for (const pos of ['RB', 'WR', 'C', 'K', undefined]) {
      const t = getPositionTierThresholds(pos);
      expect(t.core).toBeGreaterThan(t.significant);
      expect(t.significant).toBeGreaterThan(t.depth);
    }
  });
});

describe('baselinePositions', () => {
  it('lists derived positions ordered by baseline, high to low', () => {
    const list = baselinePositions();
    expect(list).toContain('RB');
    expect(list).toContain('WR');
    expect(list.indexOf('C')).toBeLessThan(list.indexOf('RB'));
    // Exempt specialists have no derived baseline and are not listed.
    expect(list).not.toContain('K');
  });
});
