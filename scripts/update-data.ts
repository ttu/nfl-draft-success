#!/usr/bin/env npx tsx
/**
 * Fetch nflverse data and write public/data/draft-{year}.json
 * Sources: draft_picks, snap_counts_{season}, injuries_{season}
 *
 * Builds per-season data: gamesPlayed, snapShare, cumulativeSnapShare, injuryReportWeeks.
 * Retention uses snap data (primary team) or injury data (team on report) when no snaps.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  isSpecialTeamsSpecialistPosition,
  perGameSnapShareForRole,
} from '../src/lib/perGameSnapShare';
import {
  playerSnapsForCumulativeLoad,
  teamDenominatorForCumulativeLoad,
} from '../src/lib/snapCountTotals';
import { normalizeNflverseTeam } from '../src/lib/nflverseFranchise';
import {
  buildTeamSeasonDenominatorTotals,
  resolveCumulativeLoadShare,
  resolveCumulativeLoadShareWithInjury,
  resolveTeamGamesDenominator,
} from '../src/lib/teamSeasonDenominator';

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

function normalizeTeam(team: string): string {
  return normalizeNflverseTeam(team);
}

/** Optional; used when merging injuries to adjust full-season load denominator */
interface SeasonLoadMeta {
  cumNum: number;
  fullSeasonTeamDen: number;
  cumDenGamesPlayed: number;
  useFullSeason: boolean;
  gameCount: number;
}

interface SeasonSnapData {
  gamesPlayed: number;
  /** Average per-game role share among games with snaps (display) */
  snapShare: number;
  /** Base season load (before injury adjustment); see loadMeta */
  cumulativeSnapShare: number;
  /** Primary team (most snaps) for retention check */
  primaryTeam: string;
  /** Present when full-season denominator applies (single franchise); merge step applies injury */
  loadMeta?: SeasonLoadMeta;
}

/** nflverse players.csv fields used when aggregating snap rows */
interface NflversePlayerMeta {
  position_group: string;
  position: string;
}

/**
 * Aggregate per (pfr_id, season): gamesPlayed, snapShare, cumulativeSnapShare, primaryTeam.
 * Per-game share: max(off, def, st) for K/P/LS (SPEC); else max(off, def) so
 * ST-only snaps do not inflate positional players (see perGameSnapShareForRole).
 */
async function loadSnapData(
  seasons: number[],
  metaByPfrId: Map<string, NflversePlayerMeta>,
): Promise<{
  snapData: Map<string, Map<number, SeasonSnapData>>;
  franchiseGameCountsBySeason: Map<number, Map<string, number>>;
  maxFranchiseGamesBySeason: Map<number, number>;
}> {
  const result = new Map<string, Map<number, SeasonSnapData>>();
  const franchiseGameCountsBySeason = new Map<number, Map<string, number>>();
  const maxFranchiseGamesBySeason = new Map<number, number>();

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
    const { scrimByTeam, fullByTeam, gameCountByTeam } =
      buildTeamSeasonDenominatorTotals(rows);

    franchiseGameCountsBySeason.set(season, new Map(gameCountByTeam));
    let maxFranchiseG = 0;
    for (const c of gameCountByTeam.values()) {
      if (c > maxFranchiseG) maxFranchiseG = c;
    }
    maxFranchiseGamesBySeason.set(season, Math.max(1, maxFranchiseG));

    const playerAccum = new Map<
      string,
      {
        gamesPlayed: number;
        shareSum: number;
        cumNum: number;
        cumDen: number;
        teamSnaps: Map<string, number>;
      }
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
      const meta = metaByPfrId.get(pfrId);
      const share = perGameSnapShareForRole(
        offPct,
        defPct,
        stPct,
        meta?.position_group,
        meta?.position,
      );
      const isSpec = isSpecialTeamsSpecialistPosition(
        meta?.position_group,
        meta?.position,
      );
      const cumNum = playerSnapsForCumulativeLoad(off, def, st, isSpec);
      const cumDen = teamDenominatorForCumulativeLoad(
        off,
        offPct,
        def,
        defPct,
        st,
        stPct,
        isSpec,
      );

      let acc = playerAccum.get(pfrId);
      if (!acc) {
        acc = {
          gamesPlayed: 0,
          shareSum: 0,
          cumNum: 0,
          cumDen: 0,
          teamSnaps: new Map(),
        };
        playerAccum.set(pfrId, acc);
      }
      acc.gamesPlayed += 1;
      acc.shareSum += share;
      acc.cumNum += cumNum;
      acc.cumDen += cumDen;
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
      const meta = metaByPfrId.get(pfrId);
      const isSpec = isSpecialTeamsSpecialistPosition(
        meta?.position_group,
        meta?.position,
      );
      const pt = primaryTeam ? normalizeTeam(primaryTeam) : '';
      const fullSeasonTeamDen = isSpec
        ? (fullByTeam.get(pt) ?? 0)
        : (scrimByTeam.get(pt) ?? 0);
      const useFullSeasonDen =
        acc.teamSnaps.size <= 1 && pt !== '' && fullSeasonTeamDen > 0;
      const gameCount = gameCountByTeam.get(pt) ?? 0;

      const baseLoad = resolveCumulativeLoadShare({
        cumNum: acc.cumNum,
        cumDenGamesPlayed: acc.cumDen,
        fullSeasonTeamDen,
        useFullSeasonDenominator: useFullSeasonDen,
      });

      pm.set(season, {
        gamesPlayed: acc.gamesPlayed,
        snapShare: acc.gamesPlayed > 0 ? acc.shareSum / acc.gamesPlayed : 0,
        cumulativeSnapShare: baseLoad,
        primaryTeam,
        ...(useFullSeasonDen
          ? {
              loadMeta: {
                cumNum: acc.cumNum,
                fullSeasonTeamDen,
                cumDenGamesPlayed: acc.cumDen,
                useFullSeason: true,
                gameCount,
              },
            }
          : {}),
      });
    }
  }

  return {
    snapData: result,
    franchiseGameCountsBySeason,
    maxFranchiseGamesBySeason,
  };
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

/** Load headshots and position meta from nflverse players */
async function loadNflversePlayers(): Promise<{
  headshots: Map<string, string>;
  metaByPfrId: Map<string, NflversePlayerMeta>;
}> {
  const headshots = new Map<string, string>();
  const metaByPfrId = new Map<string, NflversePlayerMeta>();
  const url = `${BASE}/players/players.csv`;
  const csv = await fetchCsv(url);
  const rows = parseCsv(csv);
  for (const row of rows) {
    const pfrId = (row.pfr_id ?? '').trim();
    if (!pfrId) continue;
    const headshot = (row.headshot ?? '').trim();
    if (headshot) headshots.set(pfrId, headshot);
    metaByPfrId.set(pfrId, {
      position_group: (row.position_group ?? '').trim(),
      position: (row.position ?? '').trim(),
    });
  }
  return { headshots, metaByPfrId };
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Fetching draft_picks...');
  const draftCsv = await fetchCsv(`${BASE}/draft_picks/draft_picks.csv`);
  const draftRows = parseCsv(draftCsv);

  console.log('Fetching nflverse players (headshots + positions)...');
  const { headshots, metaByPfrId } = await loadNflversePlayers();

  const snapSeasons = Array.from(
    { length: MAX_SEASON - 2012 + 1 },
    (_, i) => 2012 + i,
  );
  console.log('Fetching snap_counts (2012–' + MAX_SEASON + ')...');
  const { snapData, franchiseGameCountsBySeason, maxFranchiseGamesBySeason } =
    await loadSnapData(snapSeasons, metaByPfrId);

  const injurySeasons = Array.from(
    { length: MAX_SEASON - 2009 + 1 },
    (_, i) => 2009 + i,
  );
  console.log('Fetching injuries (2009–' + MAX_SEASON + ')...');
  const injuryData = await loadInjuryData(injurySeasons);

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
        cumulativeSnapShare: number;
        retained: boolean;
        injuryReportWeeks?: number;
        currentTeam?: string;
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
        cumulativeSnapShare: number;
        retained: boolean;
        injuryReportWeeks?: number;
        currentTeam?: string;
      }> = [];

      for (let s = year; s <= MAX_SEASON; s++) {
        const data = playerSnaps?.get(s);
        const injData = playerInjuries?.get(s);
        const gamesPlayed = data?.gamesPlayed ?? 0;
        const primaryTeam = data?.primaryTeam ?? '';
        const injuryTeam = injData?.primaryTeam ?? '';
        const teamGames = resolveTeamGamesDenominator({
          franchiseGameCounts: franchiseGameCountsBySeason.get(s),
          maxFranchiseGamesInSeason: maxFranchiseGamesBySeason.get(s) ?? 17,
          primaryTeamRaw: primaryTeam,
          injuryTeamRaw: injuryTeam,
          draftingTeamNormalized: teamId,
          normalizeTeam,
        });
        const snapShare = data?.snapShare ?? 0;
        const injuryReportWeeks = injData?.injuryReportWeeks ?? 0;
        let cumulativeSnapShare = data?.cumulativeSnapShare ?? snapShare;
        if (data?.loadMeta?.useFullSeason) {
          cumulativeSnapShare = resolveCumulativeLoadShareWithInjury({
            cumNum: data.loadMeta.cumNum,
            cumDenGamesPlayed: data.loadMeta.cumDenGamesPlayed,
            fullSeasonTeamDen: data.loadMeta.fullSeasonTeamDen,
            useFullSeasonDenominator: true,
            injuryReportWeeks,
            teamGames,
            gamesPlayed,
            gameCount: data.loadMeta.gameCount,
          });
        }
        if (snapShare > 0 && cumulativeSnapShare > snapShare) {
          cumulativeSnapShare = snapShare;
        }

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

        // Determine currentTeam for departed players
        const currentTeamId = !retained
          ? primaryTeam !== ''
            ? normalizeTeam(primaryTeam)
            : injuryTeam !== ''
              ? normalizeTeam(injuryTeam)
              : undefined
          : undefined;

        seasons.push({
          year: s,
          gamesPlayed,
          teamGames,
          snapShare,
          cumulativeSnapShare,
          retained,
          ...(injuryReportWeeks > 0 ? { injuryReportWeeks } : {}),
          ...(currentTeamId ? { currentTeam: currentTeamId } : {}),
        });
      }

      if (seasons.length === 0) {
        seasons.push({
          year,
          gamesPlayed: 0,
          teamGames: maxFranchiseGamesBySeason.get(year) ?? 17,
          snapShare: 0,
          cumulativeSnapShare: 0,
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
