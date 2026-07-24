import { describe, it, expect } from 'vitest';
import { formatOrdinal } from './formatOrdinal';

describe('formatOrdinal', () => {
  it('uses st / nd / rd / th for 1–4', () => {
    expect(formatOrdinal(1)).toBe('1st');
    expect(formatOrdinal(2)).toBe('2nd');
    expect(formatOrdinal(3)).toBe('3rd');
    expect(formatOrdinal(4)).toBe('4th');
  });

  it('uses th for the 11–13 exceptions', () => {
    expect(formatOrdinal(11)).toBe('11th');
    expect(formatOrdinal(12)).toBe('12th');
    expect(formatOrdinal(13)).toBe('13th');
  });

  it('handles larger numbers by their last digit', () => {
    expect(formatOrdinal(21)).toBe('21st');
    expect(formatOrdinal(91)).toBe('91st');
    expect(formatOrdinal(94)).toBe('94th');
    expect(formatOrdinal(100)).toBe('100th');
  });
});
