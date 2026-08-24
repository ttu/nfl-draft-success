import { describe, it, expect } from 'vitest';
import { normalizeDraftPosition } from './normalizeDraftPosition';

describe('normalizeDraftPosition', () => {
  it('maps SAF to S', () => {
    expect(normalizeDraftPosition('SAF')).toBe('S');
    expect(normalizeDraftPosition('saf')).toBe('S');
    expect(normalizeDraftPosition(' SAF ')).toBe('S');
  });

  it('maps FS to S, so a safety is not split across two positions', () => {
    expect(normalizeDraftPosition('FS')).toBe('S');
    expect(normalizeDraftPosition('fs')).toBe('S');
    expect(normalizeDraftPosition('S')).toBe('S');
  });

  it('maps T to OT', () => {
    expect(normalizeDraftPosition('T')).toBe('OT');
    expect(normalizeDraftPosition('t')).toBe('OT');
    expect(normalizeDraftPosition('OT')).toBe('OT');
  });

  it('maps OG to G, so a guard is not split across two positions', () => {
    expect(normalizeDraftPosition('OG')).toBe('G');
    expect(normalizeDraftPosition('og')).toBe('G');
    expect(normalizeDraftPosition('G')).toBe('G');
  });

  it('passes through other codes', () => {
    expect(normalizeDraftPosition('QB')).toBe('QB');
    expect(normalizeDraftPosition('NT')).toBe('NT');
    expect(normalizeDraftPosition('')).toBe('');
  });
});
