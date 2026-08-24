/**
 * Emits a real HTML file for every indexable route, after `vite build`.
 *
 * Without this, `dist/` holds a single `index.html` and GitHub Pages answers
 * every deep link with `404.html` under an HTTP 404. Humans never noticed —
 * the SPA boots from the fallback — but crawlers drop a 404, so no team, year
 * or position page could be indexed and every shared link showed the generic
 * card. Each route now gets `dist/<route>/index.html`: the same document Vite
 * built, with the head rewritten for that route.
 *
 * Each route is written twice, because static hosts disagree about which file
 * answers an extensionless URL: `<route>/index.html` serves `/TB/`, and the
 * sibling `<route>.html` serves `/TB` — the form the sitemap advertises, the
 * canonical claims, and people actually share. Without the sibling, a host that
 * only resolves directories answers `/TB` with a 301 to `/TB/`, and a canonical
 * pointing at a redirecting URL is a hint Google discards. Both files carry the
 * same canonical, so the duplicate consolidates on one URL either way.
 *
 * `404.html` stays as the fallback for routes not listed here (player pages,
 * typos); the SPA still boots from it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveRouteMeta } from '../../src/seo/routeMeta';
import { applyRouteMetaToHtml } from '../../src/seo/routeHeadHtml';
import { siteRoutesFromData } from './siteRoutesFromData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DIST = join(ROOT, 'dist');
const DATA_DIR = join(ROOT, 'public/data');

/**
 * Path segments a URL maps to on disk. Decoded, because a static host decodes
 * the request path before it looks a file up.
 */
function routeSegments(path: string): string[] {
  const segments = path
    .split('/')
    .filter((s) => s !== '')
    .map((s) => decodeURIComponent(s));
  if (segments.some((s) => s === '.' || s === '..' || s.includes('/'))) {
    throw new Error(`prerender: refusing to write unsafe route path ${path}`);
  }
  return segments;
}

function main(): void {
  const indexPath = join(DIST, 'index.html');
  const template = readFileSync(indexPath, 'utf8');
  const routes = siteRoutesFromData(DATA_DIR);

  for (const route of routes) {
    const meta = resolveRouteMeta(route.path);
    // A route the app cannot describe would ship the generic card under its own
    // URL, which is the bug this script exists to fix. Fail the build instead.
    if (meta.canonicalPath !== route.path) {
      throw new Error(
        `prerender: ${route.path} resolves to canonical ${meta.canonicalPath}; sitemap and metadata disagree`,
      );
    }

    const html = applyRouteMetaToHtml(template, meta);
    if (route.path === '/') {
      writeFileSync(indexPath, html, 'utf8');
      continue;
    }
    const segments = routeSegments(route.path);
    const parent = join(DIST, ...segments.slice(0, -1));
    const leaf = segments[segments.length - 1];

    mkdirSync(join(parent, leaf), { recursive: true });
    writeFileSync(join(parent, leaf, 'index.html'), html, 'utf8');
    writeFileSync(join(parent, `${leaf}.html`), html, 'utf8');
  }

  // SPA fallback for everything else. Generated here rather than in the deploy
  // workflow so `pnpm preview` and any other host behave like production.
  writeFileSync(join(DIST, '404.html'), readFileSync(indexPath), 'utf8');

  console.log(`Pre-rendered ${routes.length} routes into ${DIST}`);
}

main();
