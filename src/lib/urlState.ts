/**
 * URL state for shareable links - team (optional) and year range in query params
 * Rankings: ?from=2021&to=2025
 * Team: ?team=SEA&from=2021&to=2025
 */

export interface UrlState {
  team: string | null;
  from: number;
  to: number;
}

/**
 * @param searchOverride - Optional search string for testing; uses window.location.search when omitted.
 */
export function getUrlState(
  validTeamIds: Set<string>,
  yearBounds: { min: number; max: number },
  searchOverride?: string,
): UrlState | null {
  const search =
    searchOverride ??
    (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const teamParam = params.get('team') ?? '';
  const from = parseInt(params.get('from') ?? '', 10);
  const to = parseInt(params.get('to') ?? '', 10);

  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < yearBounds.min ||
    to > yearBounds.max ||
    from > to
  ) {
    return null;
  }

  const team = teamParam && validTeamIds.has(teamParam) ? teamParam : null;
  return { team, from, to };
}

export function updateUrl(team: string | null, from: number, to: number): void {
  const params = new URLSearchParams();
  params.set('from', String(from));
  params.set('to', String(to));
  if (team) params.set('team', team);
  const search = params.toString();
  const base = window.location.pathname;
  const hash = window.location.hash;
  const url = search ? `${base}?${search}${hash}` : base + hash;
  window.history.replaceState(null, '', url);
}

export function getShareableUrl(
  team: string | null,
  from: number,
  to: number,
): string {
  const params = new URLSearchParams();
  params.set('from', String(from));
  params.set('to', String(to));
  if (team) params.set('team', team);
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  return `${base}?${params.toString()}`;
}
