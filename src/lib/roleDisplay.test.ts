import { describe, it, expect } from 'vitest';
import {
  ROLE_ORDER,
  ROLE_COLORS,
  ROLE_ABBREV,
  formatRoleLabel,
  isStrongerRole,
} from './roleDisplay';

describe('roleDisplay', () => {
  it('orders roles from weakest to strongest', () => {
    expect(ROLE_ORDER[0]).toBe('non_contributor');
    expect(ROLE_ORDER[ROLE_ORDER.length - 1]).toBe('core_starter');
  });

  it('provides a colour and abbreviation for every role', () => {
    for (const role of ROLE_ORDER) {
      expect(ROLE_COLORS[role]).toBeDefined();
      expect(ROLE_ABBREV[role]).toBeDefined();
    }
  });

  it('formats role label by title-casing each underscore-separated word', () => {
    expect(formatRoleLabel('core_starter')).toBe('Core Starter');
    expect(formatRoleLabel('non_contributor')).toBe('Non Contributor');
    expect(formatRoleLabel('depth')).toBe('Depth');
  });

  it('compares role strength using ROLE_ORDER', () => {
    expect(isStrongerRole('core_starter', 'depth')).toBe(true);
    expect(isStrongerRole('depth', 'core_starter')).toBe(false);
    expect(isStrongerRole('depth', 'depth')).toBe(false);
  });
});
