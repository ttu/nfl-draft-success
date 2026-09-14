import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRoleFilter,
  saveRoleFilter,
  loadShowDeparted,
  saveShowDeparted,
  loadLandingIntroDismissed,
  saveLandingIntroDismissed,
  loadShowFreeAgents,
  saveShowFreeAgents,
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
      'contributor',
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

  it('defaults to true, so a roster shows its whole history', () => {
    expect(loadShowDeparted()).toBe(true);
  });

  it('loads and persists true', () => {
    saveShowDeparted(true);
    expect(loadShowDeparted()).toBe(true);
  });

  it('loads and persists false', () => {
    saveShowDeparted(false);
    expect(loadShowDeparted()).toBe(false);
  });

  it('falls back to the default for a non-boolean stored value', () => {
    localStorage.setItem('nfl-draft-success-show-departed', '"yes"');
    expect(loadShowDeparted()).toBe(true);
  });

  it('remembers an explicit opt-out rather than reapplying the default', () => {
    // Someone who turned departed players off must stay opted out; only an
    // absent preference takes the new default.
    saveShowDeparted(false);
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

describe('showFreeAgents preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to false, so undrafted players are opt-in', () => {
    expect(loadShowFreeAgents()).toBe(false);
  });

  it('loads and persists true', () => {
    saveShowFreeAgents(true);
    expect(loadShowFreeAgents()).toBe(true);
  });

  it('keeps its own key, independent of showDeparted', () => {
    saveShowFreeAgents(true);
    saveShowDeparted(false);
    expect(loadShowFreeAgents()).toBe(true);
    expect(loadShowDeparted()).toBe(false);
  });
});
