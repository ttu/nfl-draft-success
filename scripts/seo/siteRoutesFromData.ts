/**
 * Build-time route list, derived from the JSON the site actually ships.
 *
 * Shared by `generate-sitemap.ts` and `prerender-routes.ts` so the sitemap can
 * never advertise a URL the build did not emit a page for.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { normalizeDraftPosition } from '../../src/lib/normalizeDraftPosition';
import { buildSiteRoutes, type SiteRoute } from '../../src/seo/siteRoutes';

/** Canonical positions present in `public/data/draft-*.json`, display-sorted. */
export function collectPositionsFromDraftFiles(dataDir: string): string[] {
  const byCanon = new Map<string, string>();
  const files = readdirSync(dataDir).filter(
    (f) => f.startsWith('draft-') && f.endsWith('.json'),
  );
  for (const f of files) {
    const rawJson = readFileSync(join(dataDir, f), 'utf8');
    const j = JSON.parse(rawJson) as { picks?: Array<{ position?: string }> };
    for (const p of j.picks ?? []) {
      const raw = (p.position ?? '').trim();
      if (!raw) continue;
      const canon = normalizeDraftPosition(raw);
      if (!byCanon.has(canon)) byCanon.set(canon, canon);
    }
  }
  return [...byCanon.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function siteRoutesFromData(dataDir: string): SiteRoute[] {
  return buildSiteRoutes(collectPositionsFromDraftFiles(dataDir));
}
