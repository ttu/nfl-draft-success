/**
 * The routes this site publishes as real, indexable URLs.
 *
 * Shared so the sitemap and the pre-rendered HTML can never drift: every entry
 * here is written to `public/sitemap.xml` *and* gets a `dist/<route>/index.html`
 * of its own, which is what stops a crawler seeing an HTTP 404 on a deep link.
 *
 * Player routes are deliberately absent — there are thousands, they churn with
 * every data refresh, and they are reachable from the pages listed here.
 */
import { TEAMS } from '../data/teams';
import { DRAFT_YEAR_BOUNDS } from '../lib/draftYearBounds';

export interface SiteRoute {
  /** Root-relative path, encoded exactly as it is served and canonicalised. */
  path: string;
  /** Sitemap `<priority>`. */
  priority: string;
}

/**
 * @param positions Canonical position codes present in the shipped draft
 *   classes, in display order.
 */
export function buildSiteRoutes(positions: string[]): SiteRoute[] {
  const { min, max } = DRAFT_YEAR_BOUNDS;
  const routes: SiteRoute[] = [
    { path: '/', priority: '1.0' },
    { path: '/highlights', priority: '0.9' },
    { path: '/rosters', priority: '0.9' },
  ];

  for (const team of TEAMS) {
    routes.push({ path: `/${encodeURIComponent(team.id)}`, priority: '0.9' });
    routes.push({
      path: `/roster/${encodeURIComponent(team.id)}`,
      priority: '0.8',
    });
  }
  for (let year = min; year <= max; year++) {
    routes.push({ path: `/year/${year}`, priority: '0.85' });
  }
  for (const position of positions) {
    routes.push({
      path: `/position/${encodeURIComponent(position)}`,
      priority: '0.85',
    });
  }

  return routes;
}
