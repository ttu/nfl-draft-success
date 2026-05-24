import { describe, it, expect } from 'vitest';
import {
  generateYearArray,
  clampYear,
  isYearRangeValid,
  resolveYearRange,
  parseFromYear,
  parseToYear,
} from './yearRange';

describe('parseFromYear', () => {
  it('returns null for non-numeric input', () => {
    expect(parseFromYear('abc', 2018, 2026)).toBeNull();
  });
  it('clamps below min', () => {
    expect(parseFromYear('2000', 2018, 2026)).toBe(2018);
  });
  it('clamps above maxAllowed', () => {
    expect(parseFromYear('2099', 2018, 2024)).toBe(2024);
  });
  it('returns parsed value when in-range', () => {
    expect(parseFromYear('2020', 2018, 2026)).toBe(2020);
  });
});

describe('parseToYear', () => {
  it('returns null for non-numeric input', () => {
    expect(parseToYear('abc', 2026, 2018)).toBeNull();
  });
  it('clamps below minAllowed', () => {
    expect(parseToYear('2010', 2026, 2020)).toBe(2020);
  });
  it('clamps above max', () => {
    expect(parseToYear('2099', 2026, 2018)).toBe(2026);
  });
});

const bounds = { min: 2018, max: 2026 };
const defaults = { startYear: 2021, endYear: 2026 };

describe('generateYearArray', () => {
  it('returns inclusive ascending integers', () => {
    expect(generateYearArray(2020, 2022)).toEqual([2020, 2021, 2022]);
  });
  it('returns single-element array for equal years', () => {
    expect(generateYearArray(2024, 2024)).toEqual([2024]);
  });
  it('returns [] when end is before start', () => {
    expect(generateYearArray(2024, 2023)).toEqual([]);
  });
});

describe('clampYear', () => {
  it('returns the year when in-range', () => {
    expect(clampYear(2023, bounds)).toBe(2023);
  });
  it('clamps low values to min', () => {
    expect(clampYear(2000, bounds)).toBe(2018);
  });
  it('clamps high values to max', () => {
    expect(clampYear(2099, bounds)).toBe(2026);
  });
});

describe('isYearRangeValid', () => {
  it('accepts integer ranges within bounds', () => {
    expect(isYearRangeValid(2020, 2023, bounds)).toBe(true);
  });
  it('rejects non-integers', () => {
    expect(isYearRangeValid(NaN, 2023, bounds)).toBe(false);
    expect(isYearRangeValid(2020, '2023', bounds)).toBe(false);
  });
  it('rejects out-of-bounds', () => {
    expect(isYearRangeValid(2017, 2023, bounds)).toBe(false);
    expect(isYearRangeValid(2018, 2027, bounds)).toBe(false);
  });
  it('rejects inverted ranges', () => {
    expect(isYearRangeValid(2024, 2020, bounds)).toBe(false);
  });
});

describe('resolveYearRange', () => {
  it('returns parsed range when valid', () => {
    expect(resolveYearRange('2019', '2022', null, bounds, defaults)).toEqual({
      range: { startYear: 2019, endYear: 2022 },
      needsCorrection: false,
    });
  });
  it('returns defaults and signals correction when invalid', () => {
    expect(resolveYearRange('foo', 'bar', null, bounds, defaults)).toEqual({
      range: defaults,
      needsCorrection: true,
    });
  });
  it('returns single-year range when forcedSingleYear is in bounds', () => {
    expect(resolveYearRange(null, null, 2020, bounds, defaults)).toEqual({
      range: { startYear: 2020, endYear: 2020 },
      needsCorrection: false,
    });
  });
  it('uses defaults but does not signal correction when forcedSingleYear is set but out of bounds', () => {
    expect(resolveYearRange(null, null, 1999, bounds, defaults)).toEqual({
      range: defaults,
      needsCorrection: false,
    });
  });
});
