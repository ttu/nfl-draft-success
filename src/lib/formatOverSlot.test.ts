import { describe, it, expect } from 'vitest';
import { formatOverSlot } from './formatOverSlot';

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
});
