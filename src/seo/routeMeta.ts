/**
 * Per-route document metadata — title, description, canonical path.
 *
 * Single source of truth for two consumers that must agree, or a shared link
 * renders one card and the indexed page claims another:
 *
 * - `scripts/seo/prerender-routes.ts` bakes it into the static HTML each route
 *   serves, so crawlers see the right head without running the bundle.
 * - `./documentMeta.ts` re-applies it on client-side navigation, so the
 *   head keeps up once the SPA takes over.
 */
import { TEAMS } from '../data/teams';
import { DRAFT_YEAR_BOUNDS } from '../lib/draftYearBounds';
import { normalizeDraftPosition } from '../lib/normalizeDraftPosition';

/** Production origin. Canonical and `og:url` are absolute, so they need it. */
export const SITE_ORIGIN = 'https://www.nfldraftsuccess.com';
export const SITE_NAME = 'NFL Draft Success';

export interface RouteMeta {
  title: string;
  description: string;
  /** Root-relative canonical URL: leading slash, no query, no trailing slash. */
  canonicalPath: string;
}

const { min: YEAR_MIN, max: YEAR_MAX } = DRAFT_YEAR_BOUNDS;
const YEAR_SPAN = `${YEAR_MIN}–${YEAR_MAX}`;

export const DEFAULT_ROUTE_META: RouteMeta = {
  title: SITE_NAME,
  description:
    'Compare NFL draft outcomes for all 32 teams. Pick a season span and explore snap share, retention, and rolling scores—by team, draft year, or position.',
  canonicalPath: '/',
};

const teamsById = new Map(TEAMS.map((t) => [t.id, t]));

/** Absolute canonical URL for a path produced by {@link resolveRouteMeta}. */
export function canonicalUrl(canonicalPath: string): string {
  return `${SITE_ORIGIN}${canonicalPath}`;
}

/**
 * Splits a location pathname into decoded segments, tolerating the trailing
 * slash GitHub Pages adds when it serves `<route>/index.html`.
 */
function pathSegments(pathname: string): string[] {
  const withoutQuery = pathname.split(/[?#]/, 1)[0];
  return withoutQuery
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function teamMeta(teamId: string): RouteMeta | null {
  const team = teamsById.get(teamId);
  if (!team) return null;
  return {
    title: `${team.name} Draft Results | ${SITE_NAME}`,
    description: `How the ${team.name} have drafted since ${YEAR_MIN}: snap share, games played, retention and a rolling draft success score for every pick.`,
    canonicalPath: `/${team.id}`,
  };
}

function yearMeta(yearSegment: string): RouteMeta | null {
  if (!/^\d{4}$/.test(yearSegment)) return null;
  const year = Number(yearSegment);
  if (year < YEAR_MIN || year > YEAR_MAX) return null;
  return {
    title: `${year} NFL Draft Class Results | ${SITE_NAME}`,
    description: `Every pick of the ${year} NFL draft, team by team, with snap share, games played, retention and a draft success score.`,
    canonicalPath: `/year/${year}`,
  };
}

function positionMeta(positionSegment: string): RouteMeta | null {
  const position = normalizeDraftPosition(positionSegment);
  if (!position) return null;
  return {
    title: `${position} Draft Picks by Year | ${SITE_NAME}`,
    description: `Every ${position} drafted from ${YEAR_SPAN}, with snap share, retention and draft success scores by class.`,
    canonicalPath: `/position/${encodeURIComponent(position)}`,
  };
}

function playerMeta(playerId: string, playerName?: string): RouteMeta {
  const subject = playerName ?? 'this pick';
  return {
    title: `${playerName ?? 'Player'} Draft Profile | ${SITE_NAME}`,
    description: `Where ${subject} was drafted, snap share by season, role, and how the pick measures up against its draft-slot expectation.`,
    canonicalPath: `/player/${encodeURIComponent(playerId)}`,
  };
}

const HIGHLIGHTS_META: RouteMeta = {
  title: `Draft Steals & Busts | ${SITE_NAME}`,
  description: `The biggest steals and busts of the ${YEAR_SPAN} NFL drafts, plus league-wide leaders in snap share, retention and draft success score.`,
  canonicalPath: '/highlights',
};

/**
 * Metadata for a location pathname. Anything unrecognised — an unknown team, a
 * year outside the published classes, a stray path — falls back to the site
 * defaults rather than inventing a title for a page that does not exist.
 *
 * `playerName` is only known once the draft classes have loaded, so the player
 * route resolves twice: generic first, named after.
 */
export function resolveRouteMeta(
  pathname: string,
  options: { playerName?: string } = {},
): RouteMeta {
  const segments = pathSegments(pathname);

  if (segments.length === 0) return DEFAULT_ROUTE_META;

  if (segments.length === 1) {
    if (segments[0] === 'highlights') return HIGHLIGHTS_META;
    return teamMeta(segments[0]) ?? DEFAULT_ROUTE_META;
  }

  if (segments.length === 2) {
    const [prefix, value] = segments;
    if (prefix === 'year') return yearMeta(value) ?? DEFAULT_ROUTE_META;
    if (prefix === 'position') return positionMeta(value) ?? DEFAULT_ROUTE_META;
    if (prefix === 'player') return playerMeta(value, options.playerName);
  }

  return DEFAULT_ROUTE_META;
}
