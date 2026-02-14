const STORAGE_KEY = 'nfl-draft-success-preferences';

export interface StoredPreferences {
  /** Present when view is 'team'; omitted when view is 'rankings'. */
  team?: string;
  yearMin: number;
  yearMax: number;
  /** Last view: 'rankings' = team list, 'team' = team-specific. Omit = legacy, treat as 'team'. */
  view?: 'rankings' | 'team';
}

export function loadPreferences(
  _defaultTeam: string | undefined,
  defaultYearMin: number,
  defaultYearMax: number,
  yearBounds: { min: number; max: number },
  validTeamIds: Set<string>,
): StoredPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        yearMin: defaultYearMin,
        yearMax: defaultYearMax,
      };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'yearMin' in parsed &&
      'yearMax' in parsed
    ) {
      const { team, yearMin, yearMax, view } = parsed as StoredPreferences;
      const yearsValid =
        typeof yearMin === 'number' &&
        typeof yearMax === 'number' &&
        yearMin >= yearBounds.min &&
        yearMax <= yearBounds.max &&
        yearMin <= yearMax;
      const teamValid =
        team === undefined ||
        (typeof team === 'string' && validTeamIds.has(team));
      if (yearsValid && teamValid) {
        const result: StoredPreferences = { yearMin, yearMax };
        if (team !== undefined) result.team = team;
        if (view === 'rankings' || view === 'team') result.view = view;
        return result;
      }
    }
  } catch {
    // ignore parse errors
  }
  return {
    yearMin: defaultYearMin,
    yearMax: defaultYearMax,
  };
}

export function savePreferences(prefs: StoredPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / private mode errors
  }
}
