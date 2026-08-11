import { normalizeNflverseTeam } from './nflverseFranchise';
import {
  teamDefensePlaysFromRow,
  teamOffensePlaysFromRow,
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
  /**
   * Full-season offensive capacity per franchise — the denominator for an
   * offensive player, who can only ever accumulate offensive snaps.
   */
  offByTeam: Map<string, number>;
  /** Full-season defensive capacity per franchise, likewise for defenders. */
  defByTeam: Map<string, number>;
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

/**
 * Snap capacity of one team-game, on every denominator basis.
 *
 * A player accumulates snaps in one phase only, so his load has to divide by
 * that phase alone. Dividing an offensive player's snaps by `scrim` caps him at
 * roughly half however much he plays: Quenton Nelson took every one of Indy's
 * 1136 offensive snaps in 2018 and reported 51%. It also injects the team's
 * own offense/defense split into a player-level number — two linemen who never
 * left the field read 45.3% and 53.3% purely because of how often their
 * defenses were on the pitch.
 */
export interface TeamGameCapacity {
  /** Offensive plays — the denominator for an offensive player. */
  off: number;
  /** Defensive plays — the denominator for a defender. */
  def: number;
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
/**
 * The strongest percentage seen for each phase of one team-game, with the snap
 * count that produced it. Percentages arrive rounded, so the largest share
 * inverts into team capacity with the least relative error.
 */
interface GameCapacityAccum {
  offSnaps: number;
  offPct: number;
  defSnaps: number;
  defPct: number;
  stSnaps: number;
  stPct: number;
  week: number;
}

function emptyGameCapacity(): GameCapacityAccum {
  return {
    offSnaps: 0,
    offPct: 0,
    defSnaps: 0,
    defPct: 0,
    stSnaps: 0,
    stPct: 0,
    week: Number.NaN,
  };
}

/**
 * Fold every player row of one team-game into that game's capacity.
 *
 * A row only carries the phases its player was on the field for, so a game has
 * to be read across rows: taking it from the first row alone dropped whichever
 * phase that player did not play, and with it roughly half the denominator.
 */
function collectGameCapacities(
  rows: SnapCountCsvRow[],
): Map<string, GameCapacityAccum> {
  const byGameTeam = new Map<string, GameCapacityAccum>();

  for (const row of rows) {
    const gid = (row.game_id ?? '').trim();
    const rawTeam = (row.team ?? '').trim();
    if (!gid || !rawTeam) continue;

    const key = `${gid}|${rawTeam}`;
    let g = byGameTeam.get(key);
    if (!g) {
      g = emptyGameCapacity();
      byGameTeam.set(key, g);
    }

    const offPct = parseFloat(row.offense_pct ?? '0') || 0;
    if (offPct > g.offPct) {
      g.offPct = offPct;
      g.offSnaps = parseInt(row.offense_snaps ?? '0', 10) || 0;
    }
    const defPct = parseFloat(row.defense_pct ?? '0') || 0;
    if (defPct > g.defPct) {
      g.defPct = defPct;
      g.defSnaps = parseInt(row.defense_snaps ?? '0', 10) || 0;
    }
    const stPct = parseFloat(row.st_pct ?? '0') || 0;
    if (stPct > g.stPct) {
      g.stPct = stPct;
      g.stSnaps = parseInt(row.st_snaps ?? '0', 10) || 0;
    }

    const week = parseInt(row.week ?? '', 10);
    if (Number.isFinite(week)) g.week = week;
  }

  return byGameTeam;
}

/** Scrimmage and full capacity implied by one game's collected percentages. */
export function gameCapacityOf(g: {
  offSnaps: number;
  offPct: number;
  defSnaps: number;
  defPct: number;
  stSnaps: number;
  stPct: number;
}): TeamGameCapacity {
  const off = teamOffensePlaysFromRow(g.offSnaps, g.offPct);
  const def = teamDefensePlaysFromRow(g.defSnaps, g.defPct);
  const scrim = off + def;
  return {
    off,
    def,
    scrim,
    full: scrim + teamStPlaysFromRow(g.stSnaps, g.stPct),
  };
}

export function buildTeamSeasonDenominatorTotals(
  rows: SnapCountCsvRow[],
): TeamSeasonDenominatorTotals {
  const offByTeam = new Map<string, number>();
  const defByTeam = new Map<string, number>();
  const scrimByTeam = new Map<string, number>();
  const fullByTeam = new Map<string, number>();
  const gameCountByTeam = new Map<string, number>();
  const weeksByTeam = new Map<string, Set<number>>();
  const capacityByTeamWeek = new Map<string, TeamGameCapacity>();

  for (const [key, g] of collectGameCapacities(rows)) {
    const rawTeam = key.slice(key.indexOf('|') + 1);
    const nt = normalizeNflverseTeam(rawTeam);
    const capacity = gameCapacityOf(g);
    const { off, def, scrim, full } = capacity;

    offByTeam.set(nt, (offByTeam.get(nt) ?? 0) + off);
    defByTeam.set(nt, (defByTeam.get(nt) ?? 0) + def);
    scrimByTeam.set(nt, (scrimByTeam.get(nt) ?? 0) + scrim);
    fullByTeam.set(nt, (fullByTeam.get(nt) ?? 0) + full);
    gameCountByTeam.set(nt, (gameCountByTeam.get(nt) ?? 0) + 1);

    if (Number.isFinite(g.week)) {
      let weeks = weeksByTeam.get(nt);
      if (!weeks) {
        weeks = new Set();
        weeksByTeam.set(nt, weeks);
      }
      weeks.add(g.week);
      capacityByTeamWeek.set(`${nt}|${g.week}`, capacity);
    }
  }

  return {
    offByTeam,
    defByTeam,
    scrimByTeam,
    fullByTeam,
    gameCountByTeam,
    weeksByTeam,
    capacityByTeamWeek,
  };
}

/**
 * Which phase's capacity a player's load divides by, from the snaps he actually
 * took rather than his position label — labels are occasionally wrong, and a
 * player who moved sides mid-career would otherwise be measured against the
 * wrong phase for one of them. Ties fall to offence; they only arise when a
 * non-specialist took no scrimmage snaps at all, where the numerator is zero
 * either way.
 */
export function loadPhaseOf(offenseSnaps: number, defenseSnaps: number) {
  return defenseSnaps > offenseSnaps ? ('def' as const) : ('off' as const);
}

/**
 * The full-season denominator for one player: his own phase's capacity, or
 * scrimmage-plus-ST for a kicker, punter or long snapper, whose numerator
 * spans every phase.
 */
export function fullSeasonDenominatorFor(options: {
  totals: TeamSeasonDenominatorTotals;
  team: string;
  isSpecialist: boolean;
  offenseSnaps: number;
  defenseSnaps: number;
}): number {
  const { totals, team, isSpecialist, offenseSnaps, defenseSnaps } = options;
  if (isSpecialist) return totals.fullByTeam.get(team) ?? 0;
  return loadPhaseOf(offenseSnaps, defenseSnaps) === 'def'
    ? (totals.defByTeam.get(team) ?? 0)
    : (totals.offByTeam.get(team) ?? 0);
}

/** The same choice against one team-game's capacity. */
export function gameDenominatorFor(options: {
  capacity: TeamGameCapacity;
  isSpecialist: boolean;
  offenseSnaps: number;
  defenseSnaps: number;
}): number {
  const { capacity, isSpecialist, offenseSnaps, defenseSnaps } = options;
  if (isSpecialist) return capacity.full;
  return loadPhaseOf(offenseSnaps, defenseSnaps) === 'def'
    ? capacity.def
    : capacity.off;
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
