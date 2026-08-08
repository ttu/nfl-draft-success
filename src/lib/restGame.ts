/**
 * Detecting the game a clinched playoff team rested through.
 *
 * A team that has locked its seed sits its starters in the final regular-season
 * game. The player was available; the coach chose to sit him. Nothing else in
 * the pipeline forgives that — `seasonEndingAbsence.ts` deliberately refuses to
 * read a one-game tail as an injury, since a one-game gap is usually a rest day
 * or a healthy scratch. So a rest game falls through every excuse we have, and
 * costs the player both availability and load.
 *
 * We infer it from the team's own snap data rather than from computed clinch
 * status, which would mean reconstructing standings, seeding, and NFL
 * tiebreakers. The playoff appearance is a guard on that signal, not a
 * substitute for it: without it the rule also fires on a 3-13 team looking at
 * young players in week 18, and on one that has simply lost half its roster by
 * then.
 */

import type { Season } from '../types';
import { normalizeNflverseTeam } from './nflverseFranchise';

/** First season of the 17-game schedule, which added a week 18. */
const FIRST_18_WEEK_SEASON = 2021;

/**
 * Median share a player must hold across the team's other regular-season games
 * to count as a regular whose finale usage is worth measuring.
 */
export const REST_GAME_STARTER_SHARE = 0.5;

/**
 * Regulars a roster must have before the drop means anything. Below this the
 * rule fails closed — sparse data should not erase a game.
 */
export const MIN_REST_GAME_REGULARS = 10;

/**
 * How far the regulars' median finale usage must fall, relative to their own
 * season norm, before the game reads as rest rather than a normal week.
 *
 * Calibrated against the 82 playoff teams of 2019-2024, whose median ratios
 * separate cleanly at this value. Below it sit only real rests, down to a
 * partial one like Baltimore 2023 at 0.59 (Jackson and six others sat while the
 * roster played on); the nearest team above is New Orleans 2019 at 0.77, who
 * played Brees in a game that decided their seed. A clean sweep of the starting
 * lineup is the rarer shape, so a bar tight enough to demand one would miss
 * most of what it is for.
 */
export const REST_GAME_RATIO_THRESHOLD = 0.7;

/**
 * Regular-season games besides the finale needed before a season norm means
 * anything. A truncated or in-progress file has no norm to fall from.
 */
export const MIN_REST_GAME_NORM_WEEKS = 6;

/** Minimal snap_counts row shape for rest detection. */
export interface RestGameCsvRow {
  game_id?: string;
  team?: string;
  week?: string;
  pfr_player_id?: string;
  offense_pct?: string;
  defense_pct?: string;
}

/** The finale a franchise rested through. */
export interface RestGame {
  /** Normalized franchise code */
  team: string;
  week: number;
  gameId: string;
}

/** Last regular-season week, before the postseason continues the numbering. */
export function regularSeasonWeeks(season: number): number {
  return season >= FIRST_18_WEEK_SEASON ? 18 : 17;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** One team-week: who played and how much. */
interface TeamWeek {
  gameId: string;
  /** pfr id -> per-game role share */
  shares: Map<string, number>;
}

/** Group snap rows by normalized franchise, then by week. */
function groupByTeamWeek(
  rows: RestGameCsvRow[],
): Map<string, Map<number, TeamWeek>> {
  const byTeam = new Map<string, Map<number, TeamWeek>>();

  for (const row of rows) {
    const rawTeam = (row.team ?? '').trim();
    const gameId = (row.game_id ?? '').trim();
    const pfrId = (row.pfr_player_id ?? '').trim();
    const week = parseInt(row.week ?? '', 10);
    if (!rawTeam || !gameId || !pfrId || !Number.isFinite(week)) continue;

    const team = normalizeNflverseTeam(rawTeam);
    let weeks = byTeam.get(team);
    if (!weeks) {
      weeks = new Map();
      byTeam.set(team, weeks);
    }
    let teamWeek = weeks.get(week);
    if (!teamWeek) {
      teamWeek = { gameId, shares: new Map() };
      weeks.set(week, teamWeek);
    }

    const offPct = parseFloat(row.offense_pct ?? '0') || 0;
    const defPct = parseFloat(row.defense_pct ?? '0') || 0;
    teamWeek.shares.set(pfrId, Math.max(offPct, defPct));
  }

  return byTeam;
}

/** The rest game for one franchise, or undefined when the finale was normal. */
function detectTeamRestGame(
  team: string,
  weeks: Map<number, TeamWeek>,
  season: number,
): RestGame | undefined {
  const lastRegularWeek = regularSeasonWeeks(season);
  const played = [...weeks.keys()];

  const madePlayoffs = played.some((w) => w > lastRegularWeek);
  if (!madePlayoffs) return undefined;

  const regularWeeks = played.filter((w) => w <= lastRegularWeek);
  const finalWeek = Math.max(...regularWeeks);
  const otherWeeks = regularWeeks.filter((w) => w !== finalWeek);
  if (otherWeeks.length < MIN_REST_GAME_NORM_WEEKS) return undefined;

  const finale = weeks.get(finalWeek);
  if (!finale) return undefined;

  // An absent player counts as zero, so a starter who missed a stretch is
  // measured on the whole schedule rather than only the games he dressed for.
  const shareIn = (week: number, pfrId: string): number =>
    weeks.get(week)?.shares.get(pfrId) ?? 0;

  const rosterIds = new Set<string>();
  for (const week of otherWeeks) {
    for (const pfrId of weeks.get(week)?.shares.keys() ?? []) {
      rosterIds.add(pfrId);
    }
  }

  const ratios: number[] = [];
  for (const pfrId of rosterIds) {
    const norm = median(otherWeeks.map((w) => shareIn(w, pfrId)));
    if (norm < REST_GAME_STARTER_SHARE) continue;
    ratios.push(shareIn(finalWeek, pfrId) / norm);
  }
  if (ratios.length < MIN_REST_GAME_REGULARS) return undefined;

  // Median on both axes: two stars on IR cannot fake a rest week, and one
  // stubborn ironman cannot mask a real one.
  if (median(ratios) >= REST_GAME_RATIO_THRESHOLD) return undefined;

  return { team, week: finalWeek, gameId: finale.gameId };
}

/**
 * Franchises that rested through their finale, keyed by normalized team code.
 *
 * Judged per franchise, never per game: the opponent played that game for real.
 */
export function detectRestGames(
  rows: RestGameCsvRow[],
  season: number,
): Map<string, RestGame> {
  const restGames = new Map<string, RestGame>();

  for (const [team, weeks] of groupByTeamWeek(rows)) {
    const rest = detectTeamRestGame(team, weeks, season);
    if (rest) restGames.set(team, rest);
  }

  return restGames;
}

/**
 * The season with its rest game removed: the schedule reads one game shorter,
 * and the player's own totals drop whatever that game contributed.
 *
 * Erasure is the whole rule — availability, average share and load all lose the
 * game together. Excusing the absence while keeping the snaps would let a token
 * one-series appearance score better than a full rest, though both are the same
 * coaching decision, and would push the shares above 1.0 by measuring a
 * numerator and denominator over different sets of games.
 *
 * Seasons without a rest game are returned as they came.
 */
export function withoutRestGame(season: Season): Season {
  const rest = season.restGame;
  if (!rest) return season;

  const gamesPlayed = Math.max(0, season.gamesPlayed - rest.playerGames);
  const teamGames = Math.max(0, season.teamGames - 1);

  const shareSum = season.snapShare * season.gamesPlayed - rest.playerShareSum;
  const snapShare = gamesPlayed > 0 ? Math.max(0, shareSum / gamesPlayed) : 0;

  return {
    ...season,
    gamesPlayed,
    teamGames,
    snapShare,
    cumulativeSnapShare: adjustedLoad(season, snapShare),
  };
}

/**
 * Load reopened against the shrunken denominator, then re-capped at the
 * adjusted average share. The cap has to come after the subtraction: rest moves
 * both terms, so capping the stored values would compare an adjusted load
 * against an unadjusted average.
 *
 * Older data carrying no `loadDenominator` keeps its stored load — the ratio
 * cannot be reopened without the denominator that produced it.
 */
function adjustedLoad(season: Season, snapShare: number): number | undefined {
  const rest = season.restGame;
  const stored = season.cumulativeSnapShare;
  if (!rest || stored == null) return stored;

  const denominator = season.loadDenominator;
  let load = stored;
  if (denominator != null && denominator - rest.teamSnaps > 0) {
    const numerator = stored * denominator - rest.playerSnaps;
    load = Math.max(0, numerator / (denominator - rest.teamSnaps));
  }

  return snapShare > 0 && load > snapShare ? snapShare : load;
}
