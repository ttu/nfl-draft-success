import { describe, it, expect } from 'vitest';
import { formatOverSlot, isOverSlotPositive } from './formatOverSlot';

describe('formatOverSlot', () => {
  it('prefixes positive values with a plus and one decimal', () => {
    expect(formatOverSlot(7.42)).toBe('+7.4');
  });

  it('prefixes negative values with a real minus sign (U+2212)', () => {
    expect(formatOverSlot(-3.24)).toBe('−3.2');
  });

  it('treats zero as a (non-negative) plus value', () => {
    expect(formatOverSlot(0)).toBe('+0.0');
  });

  it('never renders a negative zero', () => {
    // A value that rounds to zero is zero. Reporting "−0.0" claims a team
    // finished below its draft slot by an amount too small to print, which is
    // a distinction the number does not support. IND rendered this in the
    // shipped rankings.
    expect(formatOverSlot(-0.04)).toBe('+0.0');
    expect(formatOverSlot(-0)).toBe('+0.0');
  });

  it('still rounds away from zero once the value is visible at one decimal', () => {
    expect(formatOverSlot(-0.06)).toBe('−0.1');
  });
});

describe('isOverSlotPositive', () => {
  it('agrees with the sign formatOverSlot prints, including near zero', () => {
    // Callers colour over slot by sign. Branching on the raw value while the
    // label branches on the rounded one painted "+0.0" in the negative colour.
    for (const value of [7.42, 0, -0, -0.04, -0.06, -3.24, 0.04]) {
      expect(isOverSlotPositive(value)).toBe(
        formatOverSlot(value).startsWith('+'),
      );
    }
  });

  it('treats a value that rounds to zero as non-negative', () => {
    expect(isOverSlotPositive(-0.04)).toBe(true);
    expect(isOverSlotPositive(-0.06)).toBe(false);
  });
});
