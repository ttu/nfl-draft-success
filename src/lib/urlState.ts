/**
 * URL structure:
 * - Root (rankings): /?from=2021&to=2025
 * - Team: /SEA?from=2021&to=2025
 */

const BASE = typeof window !== 'undefined' ? import.meta.env.BASE_URL : '/';

export interface UrlState {
  team: string | null;
  from: number;
  to: number;
}

function getPathWithoutBase(pathname: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  if (base === '/') return pathname;
  return pathname.startsWith(base)
    ? pathname.slice(base.length) || '/'
    : pathname;
}

/**
 * Parse team from path. / or empty → null. /SEA → SEA.
 */
function parseTeamFromPath(
  pathname: string,
  validTeamIds: Set<string>,
): string | null {
  const path = getPathWithoutBase(pathname);
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const team = segments[0];
  return validTeamIds.has(team) ? team : null;
}

/**
 * @param locationOverride - Optional { pathname, search } for testing.
 */
export function getUrlState(
  validTeamIds: Set<string>,
  yearBounds: { min: number; max: number },
  locationOverride?: { pathname: string; search: string },
): UrlState | null {
  const pathname =
    locationOverride?.pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const search =
    locationOverride?.search ??
    (typeof window !== 'undefined' ? window.location.search : '');

  const team = parseTeamFromPath(pathname, validTeamIds);
  const params = new URLSearchParams(search);
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

  return { team, from, to };
}

/**
 * Build path for team or rankings. Respects BASE_URL.
 */
function buildPath(team: string | null): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const root = base || '/';
  if (!team) return root;
  const basePath = root === '/' ? '' : root;
  return `${basePath}/${team}`;
}

/**
 * Update URL to reflect team and year range.
 */
export function updateUrl(team: string | null, from: number, to: number): void {
  if (typeof window === 'undefined') return;
  const path = buildPath(team);
  const params = new URLSearchParams();
  params.set('from', String(from));
  params.set('to', String(to));
  const url = `${path}?${params.toString()}`;
  window.history.replaceState(null, '', url);
}

export function getShareableUrl(
  team: string | null,
  from: number,
  to: number,
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = buildPath(team);
  const params = new URLSearchParams();
  params.set('from', String(from));
  params.set('to', String(to));
  return `${origin}${path}?${params.toString()}`;
}
