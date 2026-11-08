import { describe, it, expect } from 'vitest';
import { fitViewWidth } from './fitViewWidth';

const bounds = { min: 400, max: 800 };

describe('fitViewWidth', () => {
  it('uses the design (max) width until the container is measured', () => {
    expect(fitViewWidth(null, bounds)).toBe(800);
  });

  it('matches the container between the bounds, so text renders at its set size', () => {
    expect(fitViewWidth(612.4, bounds)).toBe(612);
  });

  it('caps at the design width on wide screens', () => {
    expect(fitViewWidth(1200, bounds)).toBe(800);
  });

  it('keeps a floor on a phone, so labels shrink a little instead of to a few px', () => {
    // A fixed 800-unit view in a 297px chart drew 16px labels at about 6px.
    expect(fitViewWidth(297, bounds)).toBe(400);
  });
});
