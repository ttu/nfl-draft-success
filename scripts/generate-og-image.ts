#!/usr/bin/env npx tsx
/**
 * Generate og-image.png (1200x630) for Open Graph and Twitter Cards.
 * Run: npm run generate-og-image
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const sharp = await import('sharp');
  const svgPath = path.join(process.cwd(), 'public', 'og-image.svg');
  const outPath = path.join(process.cwd(), 'public', 'og-image.png');
  const svg = fs.readFileSync(svgPath);
  await sharp.default(svg).png().toFile(outPath);
  console.log('Generated', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
