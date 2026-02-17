#!/usr/bin/env npx tsx
/**
 * Fetch nflverse data and write public/data/draft-{year}.json
 * Sources: draft_picks, snap_counts_{season}, injuries_{season}
 *
 * Builds per-season data: gamesPlayed, snapShare, injuryReportWeeks.
 * Retention uses snap data (primary team) or injury data (team on report) when no snaps.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const MAX_SEASON = 2025;

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
  LA: 'LAR', // nflverse snap_counts uses LA for Rams (LAC = Chargers)
  SD: 'LAC',
  OAK: 'LV',
  LVR: 'LV', // nflverse uses LVR for Las Vegas Raiders (2020+)
  /** nflverse uses different abbrevs; normalize to match teams.ts */
  KAN: 'KC',
  GNB: 'GB',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
};

function normalizeTeam(team: string): string {
  return FRANCHISE_MAP[team] ?? team;
}

interface SeasonSnapData {
  gamesPlayed: number;
  snapShare: number;
  /** Primary team (most snaps) for retention check */
  primaryTeam: string;
}

/**
 * Aggregate per (pfr_id, season): gamesPlayed, snapShare, primaryTeam.
 * snapShare = avg of max(offense_pct, defense_pct, st_pct) per game (unit share, 0-1).
 * Includes special teams so kickers/punters/LS get proper contribution.
 */
async function loadSnapData(
  seasons: number[],
): Promise<Map<string, Map<number, SeasonSnapData>>> {
  const result = new Map<string, Map<number, SeasonSnapData>>();

  for (const season of seasons) {
    const url = `${BASE}/snap_counts/snap_counts_${season}.csv`;
    let csv: string;
    try {
      csv = await fetchCsv(url);
    } catch (e) {
      console.warn(`  Skip snap_counts_${season}: ${e}`);
      continue;
    }

    const rows = parseCsv(csv);
    const playerAccum = new Map<
      string,
      { gamesPlayed: number; shareSum: number; teamSnaps: Map<string, number> }
    >();

    for (const row of rows) {
      const pfrId = row.pfr_player_id ?? '';
      const team = row.team ?? '';
      if (!pfrId) continue;

      const off = parseInt(row.offense_snaps ?? '0', 10) || 0;
      const def = parseInt(row.defense_snaps ?? '0', 10) || 0;
      const st = parseInt(row.st_snaps ?? '0', 10) || 0;
      const snaps = off + def + st;
      if (snaps === 0) continue;

      const offPct = parseFloat(row.offense_pct ?? '0') || 0;
      const defPct = parseFloat(row.defense_pct ?? '0') || 0;
      const stPct = parseFloat(row.st_pct ?? '0') || 0;
      const share = Math.max(offPct, defPct, stPct);

      let acc = playerAccum.get(pfrId);
      if (!acc) {
        acc = { gamesPlayed: 0, shareSum: 0, teamSnaps: new Map() };
        playerAccum.set(pfrId, acc);
      }
      acc.gamesPlayed += 1;
      acc.shareSum += share;
      if (team) {
        acc.teamSnaps.set(team, (acc.teamSnaps.get(team) ?? 0) + snaps);
      }
    }

    for (const [pfrId, acc] of playerAccum) {
      let primaryTeam = '';
      let maxSnaps = 0;
      for (const [team, snaps] of acc.teamSnaps) {
        if (snaps > maxSnaps) {
          maxSnaps = snaps;
          primaryTeam = team;
        }
      }
      let pm = result.get(pfrId);
      if (!pm) {
        pm = new Map();
        result.set(pfrId, pm);
      }
      pm.set(season, {
        gamesPlayed: acc.gamesPlayed,
        snapShare: acc.gamesPlayed > 0 ? acc.shareSum / acc.gamesPlayed : 0,
        primaryTeam,
      });
    }
  }

  return result;
}

interface InjurySeasonData {
  injuryReportWeeks: number;
  primaryTeam: string;
}

/** Load injuries data: gsis_id -> season -> { injuryReportWeeks, primaryTeam } */
async function loadInjuryData(
  seasons: number[],
): Promise<Map<string, Map<number, InjurySeasonData>>> {
  const result = new Map<string, Map<number, InjurySeasonData>>();

  for (const season of seasons) {
    const url = `${BASE}/injuries/injuries_${season}.csv`;
    let csv: string;
    try {
      csv = await fetchCsv(url);
    } catch {
      continue;
    }

    const rows = parseCsv(csv);
    const accum = new Map<
      string,
      { weeks: Set<number>; teamCount: Map<string, number> }
    >();

    for (const row of rows) {
      const gsisId = (row.gsis_id ?? '').trim();
      if (!gsisId) continue;

      const week = parseInt(row.week ?? '0', 10) || 0;
      const team = row.team ?? '';

      let acc = accum.get(gsisId);
      if (!acc) {
        acc = { weeks: new Set(), teamCount: new Map() };
        accum.set(gsisId, acc);
      }
      acc.weeks.add(week);
      if (team) {
        acc.teamCount.set(team, (acc.teamCount.get(team) ?? 0) + 1);
      }
    }

    for (const [gsisId, acc] of accum) {
      let primaryTeam = '';
      let maxCount = 0;
      for (const [team, count] of acc.teamCount) {
        if (count > maxCount) {
          maxCount = count;
          primaryTeam = team;
        }
      }
      let pm = result.get(gsisId);
      if (!pm) {
        pm = new Map();
        result.set(gsisId, pm);
      }
      pm.set(season, {
        injuryReportWeeks: acc.weeks.size,
        primaryTeam,
      });
    }
  }

  return result;
}

/** Load pfr_id -> headshot URL from nflverse players */
async function loadPlayerHeadshots(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const url = `${BASE}/players/players.csv`;
  const csv = await fetchCsv(url);
  const rows = parseCsv(csv);
  for (const row of rows) {
    const pfrId = (row.pfr_id ?? '').trim();
    const headshot = (row.headshot ?? '').trim();
    if (pfrId && headshot) result.set(pfrId, headshot);
  }
  return result;
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Fetching draft_picks...');
  const draftCsv = await fetchCsv(`${BASE}/draft_picks/draft_picks.csv`);
  const draftRows = parseCsv(draftCsv);

  console.log('Fetching player headshots...');
  const headshots = await loadPlayerHeadshots();

  const snapSeasons = Array.from(
    { length: MAX_SEASON - 2012 + 1 },
    (_, i) => 2012 + i,
  );
  console.log('Fetching snap_counts (2012–' + MAX_SEASON + ')...');
  const snapData = await loadSnapData(snapSeasons);

  const injurySeasons = Array.from(
    { length: MAX_SEASON - 2009 + 1 },
    (_, i) => 2009 + i,
  );
  console.log('Fetching injuries (2009–' + MAX_SEASON + ')...');
  const injuryData = await loadInjuryData(injurySeasons);

  /** Max games played by any player per season; for ongoing seasons < 17 */
  const maxGamesBySeason = new Map<number, number>();
  for (const [, seasonMap] of snapData) {
    for (const [s, data] of seasonMap) {
      maxGamesBySeason.set(
        s,
        Math.max(maxGamesBySeason.get(s) ?? 0, data.gamesPlayed),
      );
    }
  }

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
      headshotUrl?: string;
      seasons: Array<{
        year: number;
        gamesPlayed: number;
        teamGames: number;
        snapShare: number;
        retained: boolean;
        injuryReportWeeks?: number;
      }>;
    }> = [];

    for (const row of yearPicks) {
      const pfrId =
        row.pfr_player_id ?? row.pfr_id ?? row.player_id ?? row.gsis_id ?? '';
      const gsisId = (row.gsis_id ?? '').trim();
      const teamId = normalizeTeam(row.team ?? row.draft_team ?? '');
      const espnId = row.espn_id ?? row.espnid;

      const playerSnaps = snapData.get(pfrId);
      const playerInjuries = gsisId ? injuryData.get(gsisId) : undefined;
      const seasons: Array<{
        year: number;
        gamesPlayed: number;
        teamGames: number;
        snapShare: number;
        retained: boolean;
        injuryReportWeeks?: number;
      }> = [];

      for (let s = year; s <= MAX_SEASON; s++) {
        const data = playerSnaps?.get(s);
        const injData = playerInjuries?.get(s);
        const gamesPlayed = data?.gamesPlayed ?? 0;
        const maxPlayed = maxGamesBySeason.get(s) ?? 17;
        const teamGames = Math.max(1, Math.min(17, maxPlayed));
        const snapShare = data?.snapShare ?? 0;
        const injuryReportWeeks = injData?.injuryReportWeeks ?? 0;
        const primaryTeam = data?.primaryTeam ?? '';
        const injuryTeam = injData?.primaryTeam ?? '';

        let retained =
          primaryTeam !== '' ? normalizeTeam(primaryTeam) === teamId : false;

        if (!retained && primaryTeam === '' && injuryTeam !== '') {
          retained = normalizeTeam(injuryTeam) === teamId;
        }

        if (!retained && primaryTeam === '' && injuryTeam === '') {
          const nextData = playerSnaps?.get(s + 1);
          const prevData = playerSnaps?.get(s - 1);
          const nextInjury = playerInjuries?.get(s + 1);
          const prevInjury = playerInjuries?.get(s - 1);
          const nextTeam =
            nextData?.primaryTeam ?? nextInjury?.primaryTeam ?? '';
          const prevTeam =
            prevData?.primaryTeam ?? prevInjury?.primaryTeam ?? '';
          if (
            normalizeTeam(nextTeam) === teamId ||
            normalizeTeam(prevTeam) === teamId
          ) {
            retained = true;
          }
        }

        seasons.push({
          year: s,
          gamesPlayed,
          teamGames,
          snapShare,
          retained,
          ...(injuryReportWeeks > 0 ? { injuryReportWeeks } : {}),
        });
      }

      if (seasons.length === 0) {
        seasons.push({
          year,
          gamesPlayed: 0,
          teamGames: 17,
          snapShare: 0,
          retained: false,
        });
      }

      const headshotUrl = pfrId ? headshots.get(pfrId) : undefined;
      picks.push({
        playerId: pfrId || `unknown-${year}-${picks.length}`,
        playerName:
          row.pfr_player_name ?? row.player_name ?? row.player ?? 'Unknown',
        position: row.pos ?? row.position ?? '?',
        round: parseInt(row.round ?? '0', 10) || 1,
        overallPick: parseInt(row.pick ?? row.overall ?? '0', 10) || 1,
        teamId,
        ...(espnId ? { espnId } : {}),
        ...(headshotUrl ? { headshotUrl } : {}),
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
