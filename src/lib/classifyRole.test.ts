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
    expect(classifyRole(0.51, 1 / 17)).toBe('significant_contributor');
    expect(classifyRole(0.4, 0.2)).toBe('significant_contributor');
  });

  it('returns contributor when snapShare is in 20–35% band (below SC threshold)', () => {
    expect(classifyRole(0.2, 0.5)).toBe('contributor');
    expect(classifyRole(0.34, 1)).toBe('contributor');
  });

  it('uses a lower SC threshold for K/P/LS so full-time specialists are not clipped at ~34%', () => {
    expect(classifyRole(0.346, 1, 'K')).toBe('significant_contributor');
    expect(classifyRole(0.32, 1, 'P')).toBe('significant_contributor');
    expect(classifyRole(0.319, 1, 'K')).toBe('contributor');
    expect(classifyRole(0.34, 1)).toBe('contributor');
  });

  it('returns depth when snapShare is in 10–20% band', () => {
    expect(classifyRole(0.19, 0.5)).toBe('depth');
    expect(classifyRole(0.1, 0)).toBe('depth');
  });

  it('returns non_contributor when snapShare < 0.1', () => {
    expect(classifyRole(0.09, 0.5)).toBe('non_contributor');
    expect(classifyRole(0, 1)).toBe('non_contributor');
    expect(classifyRole(0.05, 0.9)).toBe('non_contributor');
  });

  it('ignores raw games played: only the share decides availability', () => {
    // Guard against the dropped third parameter creeping back. A position
    // string in that slot must be read as a position, never as a game count.
    expect(classifyRole(0.7, 0.49, 'WR')).toBe('starter_when_healthy');
    expect(classifyRole(0.7, 0.5, 'WR')).toBe('core_starter');
  });
});
