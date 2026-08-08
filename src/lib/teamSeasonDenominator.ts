import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  teamScrimmagePlaysFromRow,
  teamStPlaysFromRow,
} from './snapCountTotals';

/** Minimal snap_counts row shape for season denominator aggregation */
export interface SnapCountCsvRow {
  game_id?: string;
  team?: string;
  week?: string;
  offense_snaps?: string;
  defense_snaps?: string;
  st_snaps?: string;
  offense_pct?: string;
  defense_pct?: string;
  st_pct?: string;
}

/** Totals from {@link buildTeamSeasonDenominatorTotals} for season load denominators */
export interface TeamSeasonDenominatorTotals {
  scrimByTeam: Map<string, number>;
  fullByTeam: Map<string, number>;
  /** Distinct games (regular + postseason) per normalized franchise */
  gameCountByTeam: Map<string, number>;
  /** Distinct weeks played per normalized franchise, for absence detection */
  weeksByTeam: Map<string, Set<number>>;
  /**
   * One game's capacity, keyed `${team}|${week}`, so a single game can be
   * subtracted from the season denominator — what a rest game needs.
   */
  capacityByTeamWeek: Map<string, TeamGameCapacity>;
}

/** Snap capacity of one team-game, on both denominator bases. */
export interface TeamGameCapacity {
  /** Offense + defense plays */
  scrim: number;
  /** Scrimmage plus special teams, the specialist basis */
  full: number;
}

/**
 * Per franchise, sum team scrimmage capacity (off+def) and scrim+ST capacity
 * across every distinct (game, team) in the file. Used as full-season
 * denominators for season load share.
 */
export function buildTeamSeasonDenominatorTotals(
  rows: SnapCountCsvRow[],
): TeamSeasonDenominatorTotals {
  const scrimByTeam = new Map<string, number>();
  const fullByTeam = new Map<string, number>();
  const gameCountByTeam = new Map<string, number>();
  const weeksByTeam = new Map<string, Set<number>>();
  const capacityByTeamWeek = new Map<string, TeamGameCapacity>();
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

    const week = parseInt(row.week ?? '', 10);
    if (Number.isFinite(week)) {
      let weeks = weeksByTeam.get(nt);
      if (!weeks) {
        weeks = new Set();
        weeksByTeam.set(nt, weeks);
      }
      weeks.add(week);
      capacityByTeamWeek.set(`${nt}|${week}`, {
        scrim,
        full: scrim + stDen,
      });
    }
  }

  return {
    scrimByTeam,
    fullByTeam,
    gameCountByTeam,
    weeksByTeam,
    capacityByTeamWeek,
  };
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
 *
 * Two signals, whichever is stronger: weeks on the injury report, and games
 * missed from a season-ending absence (see {@link ./seasonEndingAbsence}),
 * which is the only signal for a player who went on IR and so vanished from the
 * report altogether. They are not summed — both describe the same absence.
 */
export function injuryAdjustedFullSeasonDenominator(options: {
  fullSeasonTeamDen: number;
  gameCount: number;
  injuryReportWeeks: number;
  /** Games missed after a player disappeared for the rest of the season */
  seasonEndingAbsenceGames?: number;
  teamGames: number;
  gamesPlayed: number;
  cumDenGamesPlayed: number;
  /** Team games the rest rule erases (0 or 1) */
  restTeamGames?: number;
  /** Rest games the player actually appeared in (0 or 1) */
  restPlayerGames?: number;
}): number {
  const {
    fullSeasonTeamDen,
    gameCount,
    injuryReportWeeks,
    seasonEndingAbsenceGames = 0,
    teamGames,
    gamesPlayed,
    cumDenGamesPlayed,
    restTeamGames = 0,
    restPlayerGames = 0,
  } = options;

  // Games missed are counted over the schedule the rest rule leaves behind. A
  // rested finale is erased downstream, so excusing it here as well would
  // discount the same absence twice — the same reason the two injury signals
  // are maxed rather than summed.
  const missedGames = Math.max(
    0,
    teamGames - restTeamGames - (gamesPlayed - restPlayerGames),
  );
  const excusedWeeks = Math.min(
    Math.max(0, injuryReportWeeks, seasonEndingAbsenceGames),
    missedGames,
  );
  if (excusedWeeks <= 0 || gameCount <= 0 || fullSeasonTeamDen <= 0) {
    return fullSeasonTeamDen;
  }

  const avgPerGame = fullSeasonTeamDen / gameCount;
  const adjusted = fullSeasonTeamDen - excusedWeeks * avgPerGame;
  return Math.max(adjusted, cumDenGamesPlayed);
}

/** A season load share together with the denominator that produced it. */
export interface CumulativeLoad {
  share: number;
  /**
   * What `share` divides by: the injury-adjusted full-season capacity, or the
   * sum of per-game denominators for a traded season. Stored on the Season so
   * the engine can reopen the ratio to subtract a rest game.
   */
  denominator: number;
}

/**
 * Full-season load share with optional injury adjustment (single-franchise
 * seasons), reporting the denominator it divided by.
 */
export function resolveCumulativeLoadWithInjury(options: {
  cumNum: number;
  cumDenGamesPlayed: number;
  fullSeasonTeamDen: number;
  useFullSeasonDenominator: boolean;
  injuryReportWeeks: number;
  /** Games missed after a player disappeared for the rest of the season */
  seasonEndingAbsenceGames?: number;
  teamGames: number;
  gamesPlayed: number;
  gameCount: number;
  /** Team games the rest rule erases (0 or 1) */
  restTeamGames?: number;
  /** Rest games the player actually appeared in (0 or 1) */
  restPlayerGames?: number;
}): CumulativeLoad {
  const seasonEndingAbsenceGames = options.seasonEndingAbsenceGames ?? 0;
  const applyInjuryAdjustmentToFullSeasonDen =
    options.useFullSeasonDenominator &&
    (options.injuryReportWeeks > 0 || seasonEndingAbsenceGames > 0) &&
    options.gameCount > 0;
  const fullDen = applyInjuryAdjustmentToFullSeasonDen
    ? injuryAdjustedFullSeasonDenominator({
        fullSeasonTeamDen: options.fullSeasonTeamDen,
        gameCount: options.gameCount,
        injuryReportWeeks: options.injuryReportWeeks,
        seasonEndingAbsenceGames,
        teamGames: options.teamGames,
        gamesPlayed: options.gamesPlayed,
        cumDenGamesPlayed: options.cumDenGamesPlayed,
        restTeamGames: options.restTeamGames,
        restPlayerGames: options.restPlayerGames,
      })
    : options.fullSeasonTeamDen;

  const useFullSeason = options.useFullSeasonDenominator && fullDen > 0;
  return {
    share: resolveCumulativeLoadShare({
      cumNum: options.cumNum,
      cumDenGamesPlayed: options.cumDenGamesPlayed,
      fullSeasonTeamDen: fullDen,
      useFullSeasonDenominator: options.useFullSeasonDenominator,
    }),
    denominator: useFullSeason ? fullDen : options.cumDenGamesPlayed,
  };
}

/**
 * Full-season load share with optional injury adjustment, share only.
 *
 * @deprecated Prefer {@link resolveCumulativeLoadWithInjury}, which also reports
 * the denominator a rest game has to be subtracted from.
 */
export function resolveCumulativeLoadShareWithInjury(
  options: Parameters<typeof resolveCumulativeLoadWithInjury>[0],
): number {
  return resolveCumulativeLoadWithInjury(options).share;
}
