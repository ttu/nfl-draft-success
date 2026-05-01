import { describe, it, expect } from 'vitest';
import { normalizeDraftPosition } from './normalizeDraftPosition';

describe('normalizeDraftPosition', () => {
  it('maps SAF to S', () => {
    expect(normalizeDraftPosition('SAF')).toBe('S');
    expect(normalizeDraftPosition('saf')).toBe('S');
    expect(normalizeDraftPosition(' SAF ')).toBe('S');
  });

  it('passes through other codes', () => {
    expect(normalizeDraftPosition('S')).toBe('S');
    expect(normalizeDraftPosition('FS')).toBe('FS');
    expect(normalizeDraftPosition('QB')).toBe('QB');
  });

  it('maps T to OT', () => {
    expect(normalizeDraftPosition('T')).toBe('OT');
    expect(normalizeDraftPosition('t')).toBe('OT');
    expect(normalizeDraftPosition('OT')).toBe('OT');
  });
});
