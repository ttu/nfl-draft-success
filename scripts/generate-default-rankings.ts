#!/usr/bin/env npx tsx
/**
 * Pre-compute default rankings (2021-2025) so the landing page
 * can render instantly without downloading ~1MB of draft data.
 *
 * Run: npx tsx scripts/generate-default-rankings.ts
 * Also runs automatically as part of `npm run update-data`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getFiveYearScore } from '../src/lib/getFiveYearScore';
import { TEAMS } from '../src/data/teams';
import type { DraftClass } from '../src/types';

const DEFAULT_FROM = 2021;
const DEFAULT_TO = 2025;

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const years = Array.from(
    { length: DEFAULT_TO - DEFAULT_FROM + 1 },
    (_, i) => DEFAULT_FROM + i,
  );

  const draftClasses: DraftClass[] = years.map((year) => {
    const filePath = path.join(dataDir, `draft-${year}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  });

  const teamScores = TEAMS.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    ...getFiveYearScore(draftClasses, t.id, { draftingTeamOnly: true }),
  }));

  teamScores.sort((a, b) => b.score - a.score);

  const rankings = [];
  let rank = 1;
  let prevScore = Infinity;
  for (let i = 0; i < teamScores.length; i++) {
    if (teamScores[i].score < prevScore) rank = i + 1;
    prevScore = teamScores[i].score;
    rankings.push({ ...teamScores[i], rank });
  }

  const output = { from: DEFAULT_FROM, to: DEFAULT_TO, rankings };
  const outPath = path.join(dataDir, 'default-rankings.json');
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(
    `Wrote default rankings to ${outPath} (${rankings.length} teams)`,
  );
}

main();
