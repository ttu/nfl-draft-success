import { describe, it, expect, beforeEach } from 'vitest';
import { loadPreferences, savePreferences } from './storage';

const VALID_TEAMS = new Set(['KC', 'SEA', 'SF']);

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when localStorage is empty', () => {
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p).toEqual({ yearMin: 2021, yearMax: 2025 });
  });

  it('loads and validates stored preferences', () => {
    savePreferences({ team: 'KC', yearMin: 2019, yearMax: 2023 });
    const p = loadPreferences(
      'SEA',
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p).toEqual({ team: 'KC', yearMin: 2019, yearMax: 2023 });
  });

  it('rejects invalid team and returns defaults', () => {
    savePreferences({ team: 'INVALID', yearMin: 2021, yearMax: 2025 });
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p).toEqual({ yearMin: 2021, yearMax: 2025 });
  });

  it('rejects out-of-range years and returns defaults', () => {
    savePreferences({ team: 'KC', yearMin: 2010, yearMax: 2030 });
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p).toEqual({ yearMin: 2021, yearMax: 2025 });
  });

  it('loads and persists view (rankings vs team)', () => {
    savePreferences({
      team: 'KC',
      yearMin: 2021,
      yearMax: 2025,
      view: 'rankings',
    });
    const p = loadPreferences(
      'SEA',
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p.view).toBe('rankings');
  });

  it('loads and persists roleFilter', () => {
    savePreferences({
      yearMin: 2021,
      yearMax: 2025,
      roleFilter: ['core_starter', 'starter_when_healthy'],
    });
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p.roleFilter).toEqual(['core_starter', 'starter_when_healthy']);
  });

  it('rejects invalid roleFilter and omits it', () => {
    savePreferences({
      yearMin: 2021,
      yearMax: 2025,
      roleFilter: ['core_starter', 'invalid_role'],
    });
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p.roleFilter).toBeUndefined();
    expect(p).toEqual({ yearMin: 2021, yearMax: 2025 });
  });

  it('handles parse errors gracefully', () => {
    localStorage.setItem('nfl-draft-success-preferences', 'invalid json');
    const p = loadPreferences(
      undefined,
      2021,
      2025,
      { min: 2018, max: 2025 },
      VALID_TEAMS,
    );
    expect(p).toEqual({ yearMin: 2021, yearMax: 2025 });
  });
});
