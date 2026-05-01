import { describe, it, expect } from 'vitest';
import { getPositionDisplayName } from './positionDisplayName';

describe('getPositionDisplayName', () => {
  it('returns full labels for known codes (case-insensitive)', () => {
    expect(getPositionDisplayName('QB')).toBe('Quarterback');
    expect(getPositionDisplayName('qb')).toBe('Quarterback');
    expect(getPositionDisplayName(' OLB ')).toBe('Outside linebacker');
    expect(getPositionDisplayName('OT')).toBe('Offensive tackle');
    expect(getPositionDisplayName('S')).toBe('Safety');
  });

  it('returns uppercase code when unknown', () => {
    expect(getPositionDisplayName('XYZ')).toBe('XYZ');
  });
});
