import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  teamScrimmagePlaysFromRow,
  teamStPlaysFromRow,
} from './snapCountTotals';

/** Minimal snap_counts row shape for season denominator aggregation */
export interface SnapCountCsvRow {
  game_id?: string;
  team?: string;
  offense_snaps?: string;
  defense_snaps?: string;
  st_snaps?: string;
  offense_pct?: string;
  defense_pct?: string;
  st_pct?: string;
}

/**
 * Per franchise, sum team scrimmage capacity (off+def) and scrim+ST capacity
 * across every distinct (game, team) in the file. Used as full-season
 * denominators for season load share.
 */
export function buildTeamSeasonDenominatorTotals(rows: SnapCountCsvRow[]): {
  scrimByTeam: Map<string, number>;
  fullByTeam: Map<string, number>;
  /** Distinct games (regular + postseason) per normalized franchise */
  gameCountByTeam: Map<string, number>;
} {
  const scrimByTeam = new Map<string, number>();
  const fullByTeam = new Map<string, number>();
  const gameCountByTeam = new Map<string, number>();
  const seenGameTeam = new Set<string>();

  for (const row of rows) {
    const gid = (row.game_id ?? '').trim();
    const rawTeam = (row.team ?? '').trim();
    if (!gid || !rawTeam) continue;

    const kt = `${gid}|${rawTeam}`;
    if (seenGameTeam.has(kt)) continue;
    seenGameTeam.add(kt);

    const off = parseInt(row.offense_snaps ?? '0', 10) || 0;
    const def = parseInt(row.defense_snaps ?? '0', 10) || 0;
    const st = parseInt(row.st_snaps ?? '0', 10) || 0;
    const offPct = parseFloat(row.offense_pct ?? '0') || 0;
    const defPct = parseFloat(row.defense_pct ?? '0') || 0;
    const stPct = parseFloat(row.st_pct ?? '0') || 0;

    const scrim = teamScrimmagePlaysFromRow(off, offPct, def, defPct);
    const stDen = teamStPlaysFromRow(st, stPct);
    const nt = normalizeNflverseTeam(rawTeam);

    scrimByTeam.set(nt, (scrimByTeam.get(nt) ?? 0) + scrim);
    fullByTeam.set(nt, (fullByTeam.get(nt) ?? 0) + scrim + stDen);
    gameCountByTeam.set(nt, (gameCountByTeam.get(nt) ?? 0) + 1);
  }

  return { scrimByTeam, fullByTeam, gameCountByTeam };
}

/**
 * Denominator for `gamesPlayedShare`: how many games the relevant franchise
 * played that NFL season (regular + postseason), from distinct `game_id` rows
 * in snap_counts. Fallback order: primary team (snaps) → injury team →
 * drafting team → league max franchise games in that season.
 */
export function resolveTeamGamesDenominator(options: {
  franchiseGameCounts: Map<string, number> | undefined;
  maxFranchiseGamesInSeason: number;
  primaryTeamRaw: string;
  injuryTeamRaw: string;
  draftingTeamNormalized: string;
  normalizeTeam: (raw: string) => string;
}): number {
  const {
    franchiseGameCounts,
    maxFranchiseGamesInSeason,
    primaryTeamRaw,
    injuryTeamRaw,
    draftingTeamNormalized,
    normalizeTeam,
  } = options;

  const fromMap = (raw: string): number | undefined => {
    const t = normalizeTeam(raw);
    if (!t) return undefined;
    const g = franchiseGameCounts?.get(t);
    return g != null && g > 0 ? g : undefined;
  };

  const gPrimary = fromMap(primaryTeamRaw);
  if (gPrimary != null) return gPrimary;
  const gInj = fromMap(injuryTeamRaw);
  if (gInj != null) return gInj;
  if (draftingTeamNormalized) {
    const g = franchiseGameCounts?.get(draftingTeamNormalized);
    if (g != null && g > 0) return g;
  }
  return Math.max(1, maxFranchiseGamesInSeason);
}

/**
 * Season load share: prefer full-season team denominator when the player was on
 * one franchise all year; otherwise ratio of sums from games played (trades).
 */
export function resolveCumulativeLoadShare(options: {
  cumNum: number;
  cumDenGamesPlayed: number;
  fullSeasonTeamDen: number;
  useFullSeasonDenominator: boolean;
}): number {
  const {
    cumNum,
    cumDenGamesPlayed,
    fullSeasonTeamDen,
    useFullSeasonDenominator,
  } = options;
  if (useFullSeasonDenominator && fullSeasonTeamDen > 0) {
    return cumNum / fullSeasonTeamDen;
  }
  if (cumDenGamesPlayed > 0) return cumNum / cumDenGamesPlayed;
  return 0;
}

/**
 * Reduce full-season denominator for weeks we treat as injury-excused absences,
 * so Load is not penalized for games missed while on the report (capped by
 * actual games missed vs `teamGames`).
 */
export function injuryAdjustedFullSeasonDenominator(options: {
  fullSeasonTeamDen: number;
  gameCount: number;
  injuryReportWeeks: number;
  teamGames: number;
  gamesPlayed: number;
  cumDenGamesPlayed: number;
}): number {
  const {
    fullSeasonTeamDen,
    gameCount,
    injuryReportWeeks,
    teamGames,
    gamesPlayed,
    cumDenGamesPlayed,
  } = options;

  const missedGames = Math.max(0, teamGames - gamesPlayed);
  const excusedWeeks = Math.min(Math.max(0, injuryReportWeeks), missedGames);
  if (excusedWeeks <= 0 || gameCount <= 0 || fullSeasonTeamDen <= 0) {
    return fullSeasonTeamDen;
  }

  const avgPerGame = fullSeasonTeamDen / gameCount;
  const adjusted = fullSeasonTeamDen - excusedWeeks * avgPerGame;
  return Math.max(adjusted, cumDenGamesPlayed);
}

/**
 * Full-season load share with optional injury adjustment (single-franchise seasons).
 */
export function resolveCumulativeLoadShareWithInjury(options: {
  cumNum: number;
  cumDenGamesPlayed: number;
  fullSeasonTeamDen: number;
  useFullSeasonDenominator: boolean;
  injuryReportWeeks: number;
  teamGames: number;
  gamesPlayed: number;
  gameCount: number;
}): number {
  let fullDen = options.fullSeasonTeamDen;
  if (
    options.useFullSeasonDenominator &&
    options.injuryReportWeeks > 0 &&
    options.gameCount > 0
  ) {
    fullDen = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: options.fullSeasonTeamDen,
      gameCount: options.gameCount,
      injuryReportWeeks: options.injuryReportWeeks,
      teamGames: options.teamGames,
      gamesPlayed: options.gamesPlayed,
      cumDenGamesPlayed: options.cumDenGamesPlayed,
    });
  }
  return resolveCumulativeLoadShare({
    cumNum: options.cumNum,
    cumDenGamesPlayed: options.cumDenGamesPlayed,
    fullSeasonTeamDen: fullDen,
    useFullSeasonDenominator: options.useFullSeasonDenominator,
  });
}
