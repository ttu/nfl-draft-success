import type { Role } from '../types';

export const ALL_ROLES: Role[] = [
  'core_starter',
  'starter_when_healthy',
  'significant_contributor',
  'depth',
  'non_contributor',
];

export const DEFAULT_ROLE_FILTER = new Set<Role>(ALL_ROLES);

export function roleFilterAllows(
  selectedRoles: Set<Role>,
  role: Role,
): boolean {
  return selectedRoles.has(role);
}
