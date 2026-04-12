/** nflverse snap_counts / draft CSV team codes → canonical ids (matches teams.ts). */
export const NFLVERSE_FRANCHISE_MAP: Record<string, string> = {
  STL: 'LAR',
  LA: 'LAR',
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
