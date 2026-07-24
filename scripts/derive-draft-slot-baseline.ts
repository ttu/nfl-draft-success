#!/usr/bin/env npx tsx
/**
 * Derive the draft-slot expectation curve and write
 * src/data/draft-slot-baseline.json.
 *
 * The raw draft score rewards picks for playing, but playing time is mostly
 * handed out by draft capital (early picks are expected to play). This fits
 * `expected = a + b·ln(overallPick)` from mature classes so the app can show how
 * far above or below its slot each pick actually landed — the "over slot"
 * residual that isolates drafting skill from draft capital. See
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
  deriveDraftSlotFit,
} from '../src/lib/deriveDraftSlotBaseline';
import { expectedScore } from '../src/lib/draftSlotBaseline';

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

  const { fit, pointCount, matureFrom, matureTo } = deriveDraftSlotFit(classes);
  if (matureFrom == null || matureTo == null || pointCount === 0) {
    throw new Error(
      'No mature draft classes with season data to fit the slot baseline.',
    );
  }

  const output: DraftSlotBaselineData = {
    generatedAt: new Date().toISOString().slice(0, 10),
    method: `OLS of pick score on ln(overallPick); classes ≥ ${DRAFT_SLOT_MATURITY_LAG} yrs old`,
    matureFrom,
    matureTo,
    pointCount,
    a: fit.a,
    b: fit.b,
  };

  const outPath = path.join(
    process.cwd(),
    'src',
    'data',
    'draft-slot-baseline.json',
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `Wrote ${outPath} — expected = ${fit.a.toFixed(2)} + ${fit.b.toFixed(2)}·ln(pick) ` +
      `from ${pointCount} picks in ${matureFrom}–${matureTo}`,
  );
  for (const p of [1, 32, 100, 200]) {
    console.log(
      `  pick ${String(p).padStart(3)} → ${expectedScore(fit, p).toFixed(1)}`,
    );
  }
}

main();
