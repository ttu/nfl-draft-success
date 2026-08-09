/**
 * nflverse snap_counts / draft CSV team codes → canonical ids (matches teams.ts).
 *
 * The feeds do not agree with each other. Snap counts, injuries and draft picks
 * write `ARI` and `LAR`; `roster_{season}.csv` writes `AZ` and `LA` for the same
 * two franchises. An unmapped code survives as itself and reads as a franchise
 * nobody was drafted by, so every Cardinal shows as departed to a team that does
 * not exist.
 */
export const NFLVERSE_FRANCHISE_MAP: Record<string, string> = {
  STL: 'LAR',
  LA: 'LAR',
  AZ: 'ARI',
  SD: 'LAC',
  OAK: 'LV',
  LVR: 'LV',
  KAN: 'KC',
  GNB: 'GB',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
};

export function normalizeNflverseTeam(team: string): string {
  const t = team.trim();
  return NFLVERSE_FRANCHISE_MAP[t] ?? t;
}
