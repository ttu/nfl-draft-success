import { describe, it, expect } from 'vitest';
import { formatYearRange, formatYearRangeShort } from './laggedWindow';

describe('formatYearRange', () => {
  it('joins two years with an en dash', () => {
    expect(formatYearRange(2018, 2021)).toBe('2018–2021');
  });

  it('shows a single year plain', () => {
    expect(formatYearRange(2022, 2022)).toBe('2022');
  });
});

describe('formatYearRangeShort', () => {
  it('abbreviates each year to two digits', () => {
    expect(formatYearRangeShort(2018, 2021)).toBe("'18–'21");
  });

  it('shows a single year plain', () => {
    expect(formatYearRangeShort(2025, 2025)).toBe('2025');
  });
});
