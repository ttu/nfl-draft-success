import type { Role } from '../types';

/** Roles in ascending order of contribution; used to compare role strength. */
export const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'contributor',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

export const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  core_starter: { bg: '#16a34a', text: '#fff' },
  starter_when_healthy: { bg: '#15803d', text: '#fff' },
  significant_contributor: { bg: '#0369a1', text: '#fff' },
  contributor: { bg: '#b45309', text: '#fff' },
  depth: { bg: '#a16207', text: '#fff' },
  non_contributor: { bg: '#6b7280', text: '#fff' },
};

export const ROLE_ABBREV: Record<Role, string> = {
  core_starter: 'CS',
  starter_when_healthy: 'SH',
  significant_contributor: 'SC',
  contributor: 'Ct',
  depth: 'D',
  non_contributor: 'NC',
};

export function formatRoleLabel(role: Role): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function isStrongerRole(candidate: Role, current: Role): boolean {
  return ROLE_ORDER.indexOf(candidate) > ROLE_ORDER.indexOf(current);
}
