/**
 * Everything that makes a route a real, indexable page.
 *
 * Two halves of one job, sharing `routeMeta.ts` so a crawler and a visitor can
 * never be shown different metadata for the same URL:
 *
 * - Build time — `scripts/seo/prerender-routes.ts` writes a file per route in
 *   `siteRoutes.ts`, with the head baked in by `routeHeadHtml.ts`. Without it a
 *   static host answers every deep link with the 404 SPA fallback.
 * - Runtime — `DocumentHead` re-applies the same metadata through
 *   `documentMeta.ts` on client-side navigation, which the pre-rendered
 *   document cannot cover.
 *
 * `scripts/seo/generate-sitemap.ts` publishes the same route list, so the
 * sitemap can only ever advertise URLs the build emitted a page for.
 */
export { DocumentHead } from './DocumentHead';
export { resolveRouteMeta, canonicalUrl, type RouteMeta } from './routeMeta';
export { buildSiteRoutes, type SiteRoute } from './siteRoutes';
