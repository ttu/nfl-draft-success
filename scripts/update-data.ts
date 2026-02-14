#!/usr/bin/env npx tsx
/**
 * Fetch nflverse data and write public/data/draft-{year}.json
 * Sources: draft_picks, snap_counts_{year}
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

interface CsvRow {
  [k: string]: string;
}

function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as CsvRow[];
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

const FRANCHISE_MAP: Record<string, string> = {
  STL: 'LAR',
  SD: 'LAC',
  OAK: 'LV',
};

function normalizeTeam(team: string): string {
  return FRANCHISE_MAP[team] ?? team;
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Fetching draft_picks...');
  const draftCsv = await fetchCsv(`${BASE}/draft_picks/draft_picks.csv`);
  const draftRows = parseCsv(draftCsv);

  for (const year of YEARS) {
    console.log(`Processing ${year}...`);

    const yearPicks = draftRows.filter(
      (r) => parseInt(r.season ?? r.draft_year ?? r.year ?? '0', 10) === year,
    );

    const picks: Array<{
      playerId: string;
      playerName: string;
      position: string;
      round: number;
      overallPick: number;
      teamId: string;
      espnId?: string;
      seasons: Array<{
        year: number;
        gamesPlayed: number;
        teamGames: number;
        snapShare: number;
        retained: boolean;
      }>;
    }> = [];

    for (const row of yearPicks) {
      const pfrId =
        row.pfr_player_id ?? row.pfr_id ?? row.player_id ?? row.gsis_id ?? '';
      const teamId = normalizeTeam(row.team ?? row.draft_team ?? '');
      const espnId = row.espn_id ?? row.espnid;

      const gamesPlayed = parseInt(row.games ?? '0', 10) || 0;
      const seasons = [
        {
          year,
          gamesPlayed,
          teamGames: 17,
          snapShare: gamesPlayed > 0 ? Math.min(gamesPlayed / 17, 1) : 0,
          retained: true,
        },
      ];

      picks.push({
        playerId: pfrId || `unknown-${year}-${picks.length}`,
        playerName:
          row.pfr_player_name ?? row.player_name ?? row.player ?? 'Unknown',
        position: row.pos ?? row.position ?? '?',
        round: parseInt(row.round ?? '0', 10) || 1,
        overallPick: parseInt(row.pick ?? row.overall ?? '0', 10) || 1,
        teamId,
        ...(espnId ? { espnId } : {}),
        seasons,
      });
    }

    const draftClass = { year, picks };
    const outPath = path.join(outDir, `draft-${year}.json`);
    fs.writeFileSync(outPath, JSON.stringify(draftClass, null, 2));
    console.log(`  Wrote ${picks.length} picks to ${outPath}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
