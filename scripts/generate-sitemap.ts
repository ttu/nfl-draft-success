/**
 * Writes public/sitemap.xml for indexable routes. Year bounds must match App.tsx /
 * AppHeader; positions are derived from public/data/draft-*.json (same idea as
 * collectDraftPositions).
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TEAMS } from '../src/data/teams';
import { canonicalPositionCode } from '../src/lib/positionDraft';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/sitemap.xml');
const DATA_DIR = join(ROOT, 'public/data');

const BASE = 'https://www.nfldraftsuccess.com';
/** Keep in sync with App.tsx / AppHeader */
const YEAR_MIN = 2018;
const YEAR_MAX = 2026;

function collectPositionsFromDraftFiles(): string[] {
  const byCanon = new Map<string, string>();
  const files = readdirSync(DATA_DIR).filter(
    (f) => f.startsWith('draft-') && f.endsWith('.json'),
  );
  for (const f of files) {
    const rawJson = readFileSync(join(DATA_DIR, f), 'utf8');
    const j = JSON.parse(rawJson) as { picks?: Array<{ position?: string }> };
    for (const p of j.picks ?? []) {
      const raw = (p.position ?? '').trim();
      if (!raw) continue;
      const canon = canonicalPositionCode(raw);
      if (!byCanon.has(canon)) byCanon.set(canon, canon);
    }
  }
  return [...byCanon.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

function urlEntry(loc: string, priority: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function main(): void {
  const positions = collectPositionsFromDraftFiles();
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntry(`${BASE}/`, '1.0'),
  ];

  for (const t of TEAMS) {
    lines.push(urlEntry(`${BASE}/${encodeURIComponent(t.id)}`, '0.9'));
  }

  for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
    lines.push(urlEntry(`${BASE}/year/${y}`, '0.85'));
  }

  for (const pos of positions) {
    lines.push(urlEntry(`${BASE}/position/${encodeURIComponent(pos)}`, '0.85'));
  }

  lines.push('</urlset>');
  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(
    `Wrote ${OUT} (${TEAMS.length} teams, ${YEAR_MAX - YEAR_MIN + 1} years, ${positions.length} positions)`,
  );
}

main();
