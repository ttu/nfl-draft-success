/**
 * URL state for shareable links - team and year range in query params
 * Format: ?team=SEA&from=2021&to=2025
 */

export interface UrlState {
  team: string;
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
  const team = params.get('team') ?? '';
  const from = parseInt(params.get('from') ?? '', 10);
  const to = parseInt(params.get('to') ?? '', 10);

  if (
    !validTeamIds.has(team) ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < yearBounds.min ||
    to > yearBounds.max ||
    from > to
  ) {
    return null;
  }

  return { team, from, to };
}

export function updateUrl(team: string, from: number, to: number): void {
  const params = new URLSearchParams();
  params.set('team', team);
  params.set('from', String(from));
  params.set('to', String(to));
  const search = params.toString();
  const base = window.location.pathname;
  const hash = window.location.hash;
  const url = search ? `${base}?${search}${hash}` : base + hash;
  window.history.replaceState(null, '', url);
}

export function getShareableUrl(
  team: string,
  from: number,
  to: number,
): string {
  const params = new URLSearchParams();
  params.set('team', team);
  params.set('from', String(from));
  params.set('to', String(to));
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '';
  return `${base}?${params.toString()}`;
}
