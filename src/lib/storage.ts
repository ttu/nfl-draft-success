const STORAGE_KEY = 'nfl-draft-success-role-filter';

const VALID_ROLES = new Set([
  'core_starter',
  'starter_when_healthy',
  'significant_contributor',
  'depth',
  'non_contributor',
]);

/**
 * Load persisted role filter. Returns undefined if none stored or invalid.
 */
export function loadRoleFilter(): string[] | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((r) => typeof r === 'string' && VALID_ROLES.has(r))
    ) {
      return parsed as string[];
    }
  } catch {
    // ignore parse errors
  }
  return undefined;
}

/**
 * Persist role filter selection.
 */
export function saveRoleFilter(roleFilter: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roleFilter));
  } catch {
    // ignore quota / private mode errors
  }
}
