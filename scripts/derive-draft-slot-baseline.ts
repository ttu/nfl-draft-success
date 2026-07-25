#!/usr/bin/env npx tsx
/**
 * Derive the draft-slot expectation curve and write
 * src/data/draft-slot-baseline.json.
 *
 * The raw draft score rewards picks for playing, but playing time is mostly
 * handed out by draft capital (early picks are expected to play). This smooths
 * the observed scores of mature classes over `ln(overallPick)` into a knot table
 * so the app can show how far above or below its slot each pick actually landed
 * — the "over slot" residual that isolates drafting skill from draft capital. See
 * `src/lib/draftSlotBaseline.ts` and `src/lib/deriveDraftSlotBaseline.ts`.
 *
 * Reads local draft JSON only (no network), so it is safe to run at build time.
 * Run: npx tsx scripts/derive-draft-slot-baseline.ts
 * Also runs automatically as part of `pnpm update-data`.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DraftClass, DraftSlotBaselineData } from '../src/types';
import {
  DRAFT_SLOT_MATURITY_LAG,
  deriveDraftSlotCurve,
} from '../src/lib/deriveDraftSlotBaseline';
import {
  DRAFT_SLOT_BANDWIDTH,
  expectedScore,
} from '../src/lib/draftSlotBaseline';

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^draft-\d{4}\.json$/.test(f));

  if (files.length === 0) {
    throw new Error(`No draft-{year}.json files found in ${dataDir}`);
  }

  const classes: DraftClass[] = files.map((file) =>
    JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8')),
  );

  const { curve, pointCount, matureFrom, matureTo } =
    deriveDraftSlotCurve(classes);
  if (matureFrom == null || matureTo == null || pointCount === 0) {
    throw new Error(
      'No mature draft classes with season data to fit the slot baseline.',
    );
  }

  const output: DraftSlotBaselineData = {
    generatedAt: new Date().toISOString().slice(0, 10),
    method:
      `local-linear smoothing of pick score over ln(overallPick), bandwidth ` +
      `${DRAFT_SLOT_BANDWIDTH}, forced non-increasing; classes ≥ ${DRAFT_SLOT_MATURITY_LAG} yrs old`,
    matureFrom,
    matureTo,
    pointCount,
    knots: curve.knots.map(({ overallPick, expected }) => ({
      overallPick,
      expected: +expected.toFixed(2),
    })),
  };

  const outPath = path.join(
    process.cwd(),
    'src',
    'data',
    'draft-slot-baseline.json',
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `Wrote ${outPath} — ${output.knots.length}-knot expectation curve ` +
      `from ${pointCount} picks in ${matureFrom}–${matureTo}`,
  );
  for (const p of [1, 5, 10, 32, 64, 100, 200]) {
    console.log(
      `  pick ${String(p).padStart(3)} → ${expectedScore(curve, p).toFixed(1)}`,
    );
  }
}

main();
