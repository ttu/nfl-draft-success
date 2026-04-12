import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRoleFilter,
  saveRoleFilter,
  loadShowDeparted,
  saveShowDeparted,
  loadLandingIntroDismissed,
  saveLandingIntroDismissed,
} from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns undefined when localStorage is empty', () => {
    expect(loadRoleFilter()).toBeUndefined();
  });

  it('loads and persists valid roleFilter', () => {
    saveRoleFilter(['core_starter', 'starter_when_healthy']);
    expect(loadRoleFilter()).toEqual(['core_starter', 'starter_when_healthy']);
  });

  it('returns undefined for invalid roleFilter (invalid role id)', () => {
    saveRoleFilter(['core_starter', 'invalid_role']);
    expect(loadRoleFilter()).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    saveRoleFilter([]);
    expect(loadRoleFilter()).toBeUndefined();
  });

  it('handles parse errors gracefully', () => {
    localStorage.setItem('nfl-draft-success-role-filter', 'invalid json');
    expect(loadRoleFilter()).toBeUndefined();
  });

  it('persists all valid role types', () => {
    const roles = [
      'core_starter',
      'starter_when_healthy',
      'significant_contributor',
      'depth',
      'non_contributor',
    ];
    saveRoleFilter(roles);
    expect(loadRoleFilter()).toEqual(roles);
  });
});

describe('showDeparted storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when localStorage is empty', () => {
    expect(loadShowDeparted()).toBe(false);
  });

  it('loads and persists true', () => {
    saveShowDeparted(true);
    expect(loadShowDeparted()).toBe(true);
  });

  it('loads and persists false', () => {
    saveShowDeparted(false);
    expect(loadShowDeparted()).toBe(false);
  });

  it('returns false for non-boolean stored value', () => {
    localStorage.setItem('nfl-draft-success-show-departed', '"yes"');
    expect(loadShowDeparted()).toBe(false);
  });
});

describe('landing intro dismissed storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when localStorage is empty', () => {
    expect(loadLandingIntroDismissed()).toBe(false);
  });

  it('loads and persists true', () => {
    saveLandingIntroDismissed(true);
    expect(loadLandingIntroDismissed()).toBe(true);
  });

  it('loads and persists false', () => {
    saveLandingIntroDismissed(false);
    expect(loadLandingIntroDismissed()).toBe(false);
  });

  it('returns false for non-boolean stored value', () => {
    localStorage.setItem('nfl-draft-success-landing-intro-dismissed', '"yes"');
    expect(loadLandingIntroDismissed()).toBe(false);
  });
});
