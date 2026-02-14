import { describe, it, expect } from 'vitest';
import { classifyRole } from './classifyRole';

describe('classifyRole', () => {
  it('returns core_starter when snapShare >= 0.65 and gamesPlayedShare >= 0.5', () => {
    expect(classifyRole(0.72, 0.5)).toBe('core_starter');
    expect(classifyRole(0.65, 0.6)).toBe('core_starter');
    expect(classifyRole(0.98, 1)).toBe('core_starter');
  });

  it('returns starter_when_healthy when snapShare >= 0.65 and gamesPlayedShare < 0.5', () => {
    expect(classifyRole(0.72, 0.49)).toBe('starter_when_healthy');
    expect(classifyRole(0.65, 0)).toBe('starter_when_healthy');
  });

  it('returns significant_contributor when snapShare >= 0.35 and below core threshold', () => {
    expect(classifyRole(0.5, 0.6)).toBe('significant_contributor');
    expect(classifyRole(0.35, 0)).toBe('significant_contributor');
    expect(classifyRole(0.64, 0.4)).toBe('significant_contributor');
  });

  it('returns depth when snapShare >= 0.1 and below significant threshold', () => {
    expect(classifyRole(0.2, 0.5)).toBe('depth');
    expect(classifyRole(0.1, 0)).toBe('depth');
    expect(classifyRole(0.34, 1)).toBe('depth');
  });

  it('returns non_contributor when snapShare < 0.1', () => {
    expect(classifyRole(0.09, 0.5)).toBe('non_contributor');
    expect(classifyRole(0, 1)).toBe('non_contributor');
    expect(classifyRole(0.05, 0.9)).toBe('non_contributor');
  });
});
