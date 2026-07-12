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

/**
 * Builds a load/save pair for a boolean flag persisted under `key`. Loading
 * returns `false` when nothing is stored or the value is not strictly `true`
 * (including parse errors); saving swallows quota / private-mode errors.
 */
function boolFlag(key: string): {
  load: () => boolean;
  save: (value: boolean) => void;
} {
  return {
    load: () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return false;
        return (JSON.parse(raw) as unknown) === true;
      } catch {
        return false;
      }
    },
    save: (value: boolean) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore quota / private mode errors
      }
    },
  };
}

/** Persisted "show departed players" toggle. Defaults to false. */
export const { load: loadShowDeparted, save: saveShowDeparted } = boolFlag(
  'nfl-draft-success-show-departed',
);

/** Whether the user closed the landing-page site intro banner. Defaults to false. */
export const {
  load: loadLandingIntroDismissed,
  save: saveLandingIntroDismissed,
} = boolFlag('nfl-draft-success-landing-intro-dismissed');

/** Persisted dark-mode preference. Defaults to false. */
export const { load: loadDarkMode, save: saveDarkMode } = boolFlag(
  'nfl-draft-success-dark-mode',
);
