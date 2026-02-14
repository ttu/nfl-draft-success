#!/usr/bin/env npx tsx
/**
 * Generate og-image.png (1200x630) for Open Graph and Twitter Cards.
 * Run: npm run generate-og-image
 */

import * as path from 'path';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a1a"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="80" y="80" width="1040" height="470" rx="12" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <text x="600" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#fff" text-anchor="middle">NFL Draft Success</text>
  <text x="600" y="360" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="rgba(255,255,255,0.7)" text-anchor="middle">See how each NFL team's draft picks perform</text>
  <text x="600" y="420" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="rgba(255,255,255,0.5)" text-anchor="middle">nfldraftsuccess.com</text>
</svg>`;

async function main() {
  const sharp = await import('sharp');
  const outPath = path.join(process.cwd(), 'public', 'og-image.png');
  await sharp.default(Buffer.from(SVG)).png().toFile(outPath);
  console.log('Generated', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
