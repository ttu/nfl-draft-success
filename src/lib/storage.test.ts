import { describe, it, expect, beforeEach } from 'vitest';
import { loadRoleFilter, saveRoleFilter } from './storage';

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
