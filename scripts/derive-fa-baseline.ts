#!/usr/bin/env npx tsx
/**
 * Derive the undrafted free-agent expectation and write
 * src/data/fa-baseline.json.
 *
 * Reads local `public/data/fa-{year}.json` only (no network), so it is safe to
 * run at build time. Run: npx tsx scripts/derive-fa-baseline.ts
 * Also runs automatically as part of `pnpm update-data`.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FreeAgentBaselineData } from '../src/types';
import { stampFreeAgentYear } from '../src/lib/freeAgentClass';
import { deriveFreeAgentBaseline } from '../src/lib/deriveFreeAgentBaseline';
import { DRAFT_SLOT_MATURITY_LAG } from '../src/lib/deriveDraftSlotBaseline';

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^fa-\d{4}\.json$/.test(f));

  if (files.length === 0) {
    throw new Error(`No fa-{year}.json files found in ${dataDir}`);
  }

  const classes = files.map((file) =>
    stampFreeAgentYear(
      JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8')),
    ),
  );

  // The maturity cutoff must be measured back from the same reference the
  // draft-slot curve uses — the newest draft class — or the two expectations
  // disagree about what "settled" means. Read from the draft filenames rather
  // than the free-agent classes: those stop at the newest *played* season,
  // while draft classes run one year further.
  const latestDraftClassYear = Math.max(
    ...fs
      .readdirSync(dataDir)
      .map((f) => /^draft-(\d{4})\.json$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1])),
  );
  if (!Number.isFinite(latestDraftClassYear)) {
    throw new Error(`No draft-{year}.json files found in ${dataDir}`);
  }

  const { expected, playerCount, matureFrom, matureTo } =
    deriveFreeAgentBaseline(classes, latestDraftClassYear);
  if (matureFrom == null || matureTo == null || playerCount === 0) {
    throw new Error(
      'No mature free-agent classes with season data to fit the baseline.',
    );
  }

  const output: FreeAgentBaselineData = {
    generatedAt: new Date().toISOString().slice(0, 10),
    method:
      `mean draft score of undrafted players with season data; ` +
      `classes ≥ ${DRAFT_SLOT_MATURITY_LAG} yrs old`,
    matureFrom,
    matureTo,
    playerCount,
    expected: +expected.toFixed(2),
  };

  const outPath = path.join(process.cwd(), 'src', 'data', 'fa-baseline.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(
    `Wrote ${outPath} — expected ${output.expected} from ${playerCount} ` +
      `free agents in ${matureFrom}–${matureTo}`,
  );
}

main();
