import { describe, it, expect } from 'vitest';
import { DRAFT_YEAR_BOUNDS } from './draftYearBounds';
import teamSuccess from '../../public/data/team-success.json';

/**
 * The advertised year range and the draft data actually shipped must agree.
 *
 * Extending the range used to mean editing the floor in four places
 * (`update-data.ts`, `App.tsx`, `generate-sitemap.ts`, `generate-team-success.ts`)
 * and two prose strings. Missing one silently either hid a class the site had
 * downloaded or offered a year whose fetch 404s.
 *
 * Globbed rather than read with `fs` so the check runs under the app tsconfig,
 * which has no node types.
 */
describe('DRAFT_YEAR_BOUNDS', () => {
  const shippedYears = Object.keys(
    import.meta.glob('../../public/data/draft-*.json'),
  )
    .map((f) => /draft-(\d{4})\.json$/.exec(f)?.[1])
    .filter((y): y is string => y != null)
    .map(Number)
    .sort((a, b) => a - b);

  it('starts at the oldest shipped draft class', () => {
    expect(DRAFT_YEAR_BOUNDS.min).toBe(shippedYears[0]);
  });

  it('ends at the newest shipped draft class', () => {
    expect(DRAFT_YEAR_BOUNDS.max).toBe(shippedYears.at(-1));
  });

  it('covers an unbroken run of classes, so no year in range 404s', () => {
    const expected = Array.from(
      { length: DRAFT_YEAR_BOUNDS.max - DRAFT_YEAR_BOUNDS.min + 1 },
      (_, i) => DRAFT_YEAR_BOUNDS.min + i,
    );
    expect(shippedYears).toEqual(expected);
  });

  it('pairs every draft class with team-success seasons', () => {
    expect(teamSuccess.from).toBeLessThanOrEqual(DRAFT_YEAR_BOUNDS.min);
    expect(teamSuccess.to).toBeGreaterThanOrEqual(DRAFT_YEAR_BOUNDS.max);
  });
});
