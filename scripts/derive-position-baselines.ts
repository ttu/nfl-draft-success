#!/usr/bin/env npx tsx
/**
 * Derive per-position snap-share baselines and write
 * src/data/position-baselines.json.
 *
 * A baseline is the snap share of a clearly full-time starter at that position
 * — the p90 of "qualifying" seasons (player appeared in >= 50% of team games,
 * so we measure role size rather than injury absence). Scoring divides a
 * season's snap share by this baseline so that "Core Starter" means the same
 * thing at every position; see docs/calculations.md and
 * docs/superpowers/specs/2026-07-17-position-adjusted-snap-scoring-research.md.
 *
 * The derivation logic lives in `src/lib/deriveBaselines.ts`; this file is the
 * I/O wrapper. Note that it reads RAW snap shares — reading them through
 * `snapShareForRoleTier` would divide by the baselines being rewritten here and
 * collapse every position to 1.0 in one run.
 *
 * Kickers, punters and long snappers are deliberately EXCLUDED: snap share does
 * not measure specialist workload at all (their share is measured against a
 * scrimmage-shaped denominator), so normalizing it would be meaningless.
 *
 * Run: npx tsx scripts/derive-position-baselines.ts
 * Also runs automatically as part of `pnpm update-data`, before the rankings
 * are regenerated — the rankings depend on the scores these baselines produce.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DraftClass } from '../src/types';
import { deriveBaselinesFromClasses } from '../src/lib/deriveBaselines';
import {
  BASELINE_PERCENTILE,
  MIN_QUALIFYING_SEASONS,
  QUALIFYING_GAMES_SHARE,
} from '../src/lib/positionBaseline';
import type { PositionBaselinesData } from '../src/types';

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

  const { baselines, skipped } = deriveBaselinesFromClasses(classes);

  const output: PositionBaselinesData = {
    generatedAt: new Date().toISOString().slice(0, 10),
    method: `p${BASELINE_PERCENTILE * 100} of seasons with gamesPlayed/teamGames >= ${QUALIFYING_GAMES_SHARE}`,
    baselines,
  };

  const outPath = path.join(
    process.cwd(),
    'src',
    'data',
    'position-baselines.json',
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  const count = Object.keys(baselines).length;
  console.log(
    `Wrote ${outPath} (${count} positions from ${files.length} classes)`,
  );
  for (const [pos, base] of Object.entries(baselines).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${pos.padEnd(5)} ${(base * 100).toFixed(1)}%`);
  }
  if (skipped.length > 0) {
    console.log(
      `  skipped (fewer than ${MIN_QUALIFYING_SEASONS} qualifying seasons): ${skipped.join(', ')}`,
    );
  }
}

main();
