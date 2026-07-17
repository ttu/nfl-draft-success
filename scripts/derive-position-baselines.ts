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
import { snapShareForRoleTier } from '../src/lib/snapShareForTier';
import {
  BASELINE_FLOOR,
  BASELINE_PERCENTILE,
  MIN_QUALIFYING_SEASONS,
  QUALIFYING_GAMES_SHARE,
  isBaselineExemptPosition,
} from '../src/lib/positionBaseline';
import type { PositionBaselinesData } from '../src/types';

/** Linear-interpolated percentile of an unsorted sample. */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^draft-\d{4}\.json$/.test(f));

  if (files.length === 0) {
    throw new Error(`No draft-{year}.json files found in ${dataDir}`);
  }

  // Collect the tier snap share of every qualifying season, grouped by the
  // draft position label — the same vocabulary scoring looks baselines up by.
  const sharesByPosition = new Map<string, number[]>();
  for (const file of files) {
    const draftClass: DraftClass = JSON.parse(
      fs.readFileSync(path.join(dataDir, file), 'utf-8'),
    );
    for (const pick of draftClass.picks) {
      if (isBaselineExemptPosition(pick.position)) continue;
      for (const season of pick.seasons) {
        if (season.teamGames <= 0) continue;
        if (season.gamesPlayed / season.teamGames < QUALIFYING_GAMES_SHARE) {
          continue;
        }
        const share = snapShareForRoleTier(season, pick.position);
        const list = sharesByPosition.get(pick.position);
        if (list) list.push(share);
        else sharesByPosition.set(pick.position, [share]);
      }
    }
  }

  const baselines: Record<string, number> = {};
  const skipped: string[] = [];
  for (const [position, shares] of [...sharesByPosition].sort()) {
    if (shares.length < MIN_QUALIFYING_SEASONS) {
      skipped.push(`${position} (n=${shares.length})`);
      continue;
    }
    const raw = percentile(shares, BASELINE_PERCENTILE);
    // Round to 3dp for a readable, diff-friendly artifact.
    baselines[position] =
      Math.round(Math.max(raw, BASELINE_FLOOR) * 1000) / 1000;
  }

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
