#!/usr/bin/env npx tsx
/**
 * Pre-compute the draft-success scores for the fixed lagged draft window
 * (see src/lib/laggedWindow.ts) so the methodology's "does the score predict
 * winning?" scatter and the team card can join them to the later win rate
 * without downloading four draft classes at runtime.
 *
 * Reads local draft JSON only (no network), so it is safe to run at build time.
 * Run: npx tsx scripts/generate-lagged-rankings.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { getRollingDraftScore } from '../src/lib/getRollingDraftScore';
import { TEAMS } from '../src/data/teams';
import { LAGGED_WINDOWS } from '../src/lib/laggedWindow';
import type { DraftClass } from '../src/types';

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const { draftFrom, draftTo } = LAGGED_WINDOWS;
  const years = Array.from(
    { length: draftTo - draftFrom + 1 },
    (_, i) => draftFrom + i,
  );

  const draftClasses: DraftClass[] = years.map((year) =>
    JSON.parse(
      fs.readFileSync(path.join(dataDir, `draft-${year}.json`), 'utf-8'),
    ),
  );

  const rankings = TEAMS.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    score: getRollingDraftScore(draftClasses, t.id, { draftingTeamOnly: true })
      .score,
  })).sort((a, b) => b.score - a.score);

  const output = { from: draftFrom, to: draftTo, rankings };
  const outPath = path.join(dataDir, 'lagged-draft-rankings.json');
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(
    `Wrote lagged draft rankings (${draftFrom}–${draftTo}) for ${rankings.length} teams to ${outPath}`,
  );
}

main();
