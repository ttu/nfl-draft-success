/**
 * Writes public/sitemap.xml from the shared route list in
 * `src/seo/siteRoutes.ts` — the same list `prerender-routes.ts` emits a real
 * `dist/<route>/index.html` for, so every URL advertised here answers 200.
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { canonicalUrl } from '../../src/seo/routeMeta';
import { siteRoutesFromData } from './siteRoutesFromData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'public/sitemap.xml');
const DATA_DIR = join(ROOT, 'public/data');

function urlEntry(loc: string, priority: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function main(): void {
  const routes = siteRoutesFromData(DATA_DIR);
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((r) => urlEntry(canonicalUrl(r.path), r.priority)),
    '</urlset>',
  ];

  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${OUT} (${routes.length} URLs)`);
}

main();
