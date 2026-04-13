const STORAGE_KEY = 'nfl-draft-success-role-filter';

const VALID_ROLES = new Set([
  'core_starter',
  'starter_when_healthy',
  'significant_contributor',
  'contributor',
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

const SHOW_DEPARTED_KEY = 'nfl-draft-success-show-departed';

/**
 * Load persisted showDeparted toggle. Returns false if not stored or invalid.
 */
export function loadShowDeparted(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DEPARTED_KEY);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as unknown;
    return parsed === true;
  } catch {
    return false;
  }
}

/**
 * Persist showDeparted toggle.
 */
export function saveShowDeparted(value: boolean): void {
  try {
    localStorage.setItem(SHOW_DEPARTED_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode errors
  }
}

const LANDING_INTRO_DISMISSED_KEY = 'nfl-draft-success-landing-intro-dismissed';

/**
 * Whether the user closed the landing-page site intro banner (persisted).
 */
export function loadLandingIntroDismissed(): boolean {
  try {
    const raw = localStorage.getItem(LANDING_INTRO_DISMISSED_KEY);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as unknown;
    return parsed === true;
  } catch {
    return false;
  }
}

export function saveLandingIntroDismissed(value: boolean): void {
  try {
    localStorage.setItem(LANDING_INTRO_DISMISSED_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode errors
  }
}
