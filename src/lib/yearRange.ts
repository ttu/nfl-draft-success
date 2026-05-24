export interface YearBounds {
  min: number;
  max: number;
}

export interface YearRange {
  startYear: number;
  endYear: number;
}

/** Inclusive integer array of years from start..end. */
export function generateYearArray(
  startYear: number,
  endYear: number,
): number[] {
  if (endYear < startYear) return [];
  return Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i,
  );
}

/** Clamp a year inside `[bounds.min, bounds.max]`. */
export function clampYear(year: number, bounds: YearBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, year));
}

/**
 * Parse a "from" year string and clamp it to `[min, maxAllowed]` where
 * `maxAllowed` is typically the currently selected end year (preserves the
 * range invariant `from ≤ to`). Returns `null` if the input is not numeric.
 */
export function parseFromYear(
  raw: string,
  min: number,
  maxAllowed: number,
): number | null {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  return Math.min(Math.max(parsed, min), maxAllowed);
}

/**
 * Parse a "to" year string and clamp it to `[minAllowed, max]` where
 * `minAllowed` is typically the currently selected start year.
 */
export function parseToYear(
  raw: string,
  max: number,
  minAllowed: number,
): number | null {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return null;
  return Math.max(Math.min(parsed, max), minAllowed);
}

/** True when both years are integers in-range and start ≤ end. */
export function isYearRangeValid(
  from: unknown,
  to: unknown,
  bounds: YearBounds,
): boolean {
  return (
    typeof from === 'number' &&
    typeof to === 'number' &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= bounds.min &&
    to <= bounds.max &&
    from <= to
  );
}

/**
 * Resolve year range from URL params with optional single-year override.
 * - If `forcedSingleYear` is provided and in-bounds: returns a single-year range.
 * - Otherwise returns parsed range when valid, else `defaults`.
 * Returns a `needsCorrection` flag so callers can decide whether to push
 * defaults back into the URL (skipped when a single year is forced).
 */
export function resolveYearRange(
  fromParam: string | null,
  toParam: string | null,
  forcedSingleYear: number | null,
  bounds: YearBounds,
  defaults: YearRange,
): { range: YearRange; needsCorrection: boolean } {
  const from = parseInt(fromParam ?? '', 10);
  const to = parseInt(toParam ?? '', 10);
  const valid = isYearRangeValid(from, to, bounds);

  if (
    forcedSingleYear != null &&
    forcedSingleYear >= bounds.min &&
    forcedSingleYear <= bounds.max
  ) {
    return {
      range: { startYear: forcedSingleYear, endYear: forcedSingleYear },
      needsCorrection: false,
    };
  }

  if (valid) {
    return { range: { startYear: from, endYear: to }, needsCorrection: false };
  }

  return {
    range: defaults,
    needsCorrection: forcedSingleYear == null,
  };
}
