const STORAGE_KEY = 'nfl-draft-success-preferences';

export interface StoredPreferences {
  team: string;
  yearMin: number;
  yearMax: number;
}

export function loadPreferences(
  defaultTeam: string,
  defaultYearMin: number,
  defaultYearMax: number,
  yearBounds: { min: number; max: number },
  validTeamIds: Set<string>,
): StoredPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        team: defaultTeam,
        yearMin: defaultYearMin,
        yearMax: defaultYearMax,
      };
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'team' in parsed &&
      'yearMin' in parsed &&
      'yearMax' in parsed
    ) {
      const { team, yearMin, yearMax } = parsed as StoredPreferences;
      const valid =
        validTeamIds.has(team) &&
        typeof yearMin === 'number' &&
        typeof yearMax === 'number' &&
        yearMin >= yearBounds.min &&
        yearMax <= yearBounds.max &&
        yearMin <= yearMax;
      if (valid) return { team, yearMin, yearMax };
    }
  } catch {
    // ignore parse errors
  }
  return {
    team: defaultTeam,
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
