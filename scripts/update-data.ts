#!/usr/bin/env npx tsx
/**
 * Fetch nflverse data and write public/data/draft-{year}.json
 * Sources: draft_picks, snap_counts_{season}, injuries_{season}
 *
 * Builds per-season data: gamesPlayed, snapShare, cumulativeSnapShare, injuryReportWeeks.
 * Retention uses snap data (primary team) or injury data (team on report) when no snaps.
 * Load excuses games missed to a season-ending absence, which is the only signal
 * for players who went on IR and so vanished from the injury report.
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
  teamDefensePlaysFromRow,
  teamOffensePlaysFromRow,
  teamStPlaysFromRow,
} from '../src/lib/snapCountTotals';
import { normalizeNflverseTeam } from '../src/lib/nflverseFranchise';
import {
  buildTeamSeasonDenominatorTotals,
  fullSeasonDenominatorFor,
  gameDenominatorFor,
  loadPhaseOf,
  resolveCumulativeLoadShare,
  resolveCumulativeLoadWithInjury,
  resolveTeamGamesDenominator,
  type TeamGameCapacity,
  type TeamSeasonDenominatorTotals,
} from '../src/lib/teamSeasonDenominator';
import { detectRestGames, type RestGame } from '../src/lib/restGame';
import type { RestGameSlice } from '../src/types';
import { normalizeDraftPosition } from '../src/lib/normalizeDraftPosition';
import { seasonEndingAbsenceGames } from '../src/lib/seasonEndingAbsence';
import { resolveLatestPlayedSeason } from '../src/lib/latestPlayedSeason';
import { accumulateReserveWeeks } from '../src/lib/reserveWeeks';
import { excusedAbsenceGames } from '../src/lib/absenceWeeks';

const BASE = 'https://github.com/nflverse/nflverse-data/releases/download';
/** First season nflverse publishes snap counts for. */
const FIRST_SNAP_SEASON = 2012;
/** First season nflverse publishes an injury report for. */
const FIRST_INJURY_SEASON = 2009;
/**
 * First season nflverse weekly rosters record reserve status reliably.
 *
 * Not a publication date — the releases go back to 2012 — but a quality floor.
 * Before 2016 only ~200-250 players per season carry any reserve week against
 * a league reality of 500-700, and their weeks are placed wrong: the mean
 * reserve week is 6.8, ahead of the season's midpoint, when injuries in fact
 * accumulate towards the end (2016+ seasons mean 10.0). Tyler Eifert's 2014,
 * a week-1 injury that ended his year, is a single row. Luke Joeckel's 2013 IR
 * stint is recorded against weeks 1-5, the weeks he played.
 *
 * Applied to 2013-2015 the reserve signal strips excusal from 150 player-seasons
 * and grants it to 40 — data loss, not correction. Those seasons keep the
 * snap-shape heuristic in `src/lib/seasonEndingAbsence.ts` instead.
 */
const FIRST_RESERVE_SEASON = 2016;
/**
 * Earliest draft class this site tracks.
 *
 * Floored at 2013 by snap coverage: scoring a class needs snap counts from its
 * rookie season on, and nflverse starts at FIRST_SNAP_SEASON. 2013 rather than
 * 2012 leaves a season of margin and makes the pre-2018 range a clean mirror of
 * the lagged window (2013–2016 drafts → 2017–2020 wins).
 */
const FIRST_DRAFT_YEAR = 2013;

interface CsvRow {
  [k: string]: string;
}

function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as CsvRow[];
}

/** A non-OK HTTP response, carrying the status so callers can tell a genuine
 * "not published yet" 404 apart from a transient upstream failure. */
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status}: ${url}`);
    this.name = 'HttpError';
  }
}

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status, url);
  return res.text();
}

/**
 * Fetch one season's CSV, treating a 404 as "not published yet" and returning
 * undefined. Any other failure is a network blip or upstream error, which is
 * never the same thing as an absent season: for `required` feeds it aborts the
 * run rather than let a whole season quietly drop out of the data.
 */
async function fetchSeasonCsv(
  url: string,
  label: string,
  { required }: { required: boolean },
): Promise<string | undefined> {
  try {
    return await fetchCsv(url);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      console.warn(`  Skip ${label}: not published (404)`);
      return undefined;
    }
    if (required) {
      throw new Error(`Failed to load ${label}: ${String(e)}`, { cause: e });
    }
    console.warn(`  Skip ${label}: ${String(e)}`);
    return undefined;
  }
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
  /** Team games missed after the player disappeared for the rest of the season */
  seasonEndingAbsenceGames: number;
  /**
   * Team weeks the player did not appear in, already rest-adjusted. Carried as
   * weeks rather than a count because the excusal intersects them with the
   * documented-injury weeks; see {@link ../src/lib/absenceWeeks}.
   */
  missedWeeks: number[];
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
  /** Denominator behind `cumulativeSnapShare`, before any injury adjustment */
  loadDenominator: number;
  /** Present when the player's primary team rested through its finale */
  restGame?: RestGameSlice;
}

/** nflverse players.csv fields used when aggregating snap rows */
interface NflversePlayerMeta {
  position_group: string;
  position: string;
}

/** Running per-player totals for one season, before averaging/normalisation. */
interface PlayerSnapAccum {
  gamesPlayed: number;
  shareSum: number;
  cumNum: number;
  /**
   * Games-played denominators on each phase, kept in parallel because the
   * phase a season belongs to is only known once every row is in. Specialists
   * accumulate scrimmage+ST into {@link cumDenFull} instead.
   */
  cumDenOff: number;
  cumDenDef: number;
  cumDenFull: number;
  /** Scrimmage snaps by phase, which decide the phase for the whole season. */
  offSnaps: number;
  defSnaps: number;
  teamSnaps: Map<string, number>;
  /** Weeks the player took a snap, for season-ending absence detection */
  weeks: Set<number>;
  /**
   * What he contributed in each franchise's rested finale, keyed by normalized
   * team. Kept per team because only his primary team's rest game shortens the
   * schedule he is measured against.
   */
  restByTeam: Map<string, PlayerRestAccum>;
}

/** One player's contribution to a single rested finale. */
interface PlayerRestAccum {
  playerGames: number;
  shareSum: number;
  playerSnaps: number;
  /** His own denominator contribution, per phase, for the games-played basis */
  cumDenOff: number;
  cumDenDef: number;
  cumDenFull: number;
}

/** The three parallel per-phase denominators either accumulator carries. */
interface PhaseDenominators {
  cumDenOff: number;
  cumDenDef: number;
  cumDenFull: number;
}

/**
 * Pick the games-played denominator matching the phase the player's season
 * belongs to — the same choice `fullSeasonDenominatorFor` makes against the
 * full-season totals, so the two bases never disagree about which phase a
 * player is measured on.
 */
function phaseDenominator(
  d: PhaseDenominators | undefined,
  isSpec: boolean,
  offSnaps: number,
  defSnaps: number,
): number {
  if (!d) return 0;
  if (isSpec) return d.cumDenFull;
  return loadPhaseOf(offSnaps, defSnaps) === 'def' ? d.cumDenDef : d.cumDenOff;
}

/**
 * Fold one season's snap rows into per-player totals. Rows without a pfr id or
 * with zero snaps contribute nothing (a player on the sheet but not on the
 * field has not "played" the game).
 */
/**
 * Denominator for one player-game.
 *
 * The capacity has to come from every row of that team-game, not this player's
 * own row: a player only carries the phases he was on the field for, so reading
 * it from one row dropped the other phase entirely and roughly halved the
 * denominator. The single-row form remains as a fallback for rows whose week
 * cannot be keyed.
 */
function perGameDenominator(params: {
  totals: TeamSeasonDenominatorTotals;
  team: string;
  week: number;
  isSpec: boolean;
  off: number;
  offPct: number;
  def: number;
  defPct: number;
  st: number;
  stPct: number;
}): TeamGameCapacity {
  const { totals, team, week } = params;
  const capacity = team
    ? totals.capacityByTeamWeek.get(`${normalizeTeam(team)}|${week}`)
    : undefined;
  if (capacity) return capacity;

  // Fallback for a row whose week cannot be keyed: invert this player's own
  // percentages. Only the phase he played is recoverable that way, which is
  // exactly the phase his load will divide by.
  const offCap = teamOffensePlaysFromRow(params.off, params.offPct);
  const defCap = teamDefensePlaysFromRow(params.def, params.defPct);
  const scrim = offCap + defCap;
  return {
    off: offCap,
    def: defCap,
    scrim,
    full: scrim + teamStPlaysFromRow(params.st, params.stPct),
  };
}

function accumulatePlayerSnaps(
  rows: CsvRow[],
  metaByPfrId: Map<string, NflversePlayerMeta>,
  restGames: Map<string, RestGame>,
  totals: TeamSeasonDenominatorTotals,
): Map<string, PlayerSnapAccum> {
  const playerAccum = new Map<string, PlayerSnapAccum>();

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

    let acc = playerAccum.get(pfrId);
    if (!acc) {
      acc = {
        gamesPlayed: 0,
        shareSum: 0,
        cumNum: 0,
        cumDenOff: 0,
        cumDenDef: 0,
        cumDenFull: 0,
        offSnaps: 0,
        defSnaps: 0,
        teamSnaps: new Map(),
        weeks: new Set(),
        restByTeam: new Map(),
      };
      playerAccum.set(pfrId, acc);
    }
    const week = parseInt(row.week ?? '', 10);
    if (Number.isFinite(week)) acc.weeks.add(week);
    const playerSnaps = playerSnapsForCumulativeLoad(off, def, st, isSpec);
    const playerDen = perGameDenominator({
      totals,
      team,
      week,
      isSpec,
      off,
      offPct,
      def,
      defPct,
      st,
      stPct,
    });
    acc.gamesPlayed += 1;
    acc.shareSum += share;
    acc.cumNum += playerSnaps;
    acc.offSnaps += off;
    acc.defSnaps += def;
    acc.cumDenOff += playerDen.off;
    acc.cumDenDef += playerDen.def;
    acc.cumDenFull += playerDen.full;
    if (team) {
      acc.teamSnaps.set(team, (acc.teamSnaps.get(team) ?? 0) + snaps);

      const nt = normalizeTeam(team);
      if (restGames.get(nt)?.week === week) {
        const rest = acc.restByTeam.get(nt) ?? {
          playerGames: 0,
          shareSum: 0,
          playerSnaps: 0,
          cumDenOff: 0,
          cumDenDef: 0,
          cumDenFull: 0,
        };
        rest.playerGames += 1;
        rest.shareSum += share;
        rest.playerSnaps += playerSnaps;
        rest.cumDenOff += playerDen.off;
        rest.cumDenDef += playerDen.def;
        rest.cumDenFull += playerDen.full;
        acc.restByTeam.set(nt, rest);
      }
    }
  }

  return playerAccum;
}

/**
 * The team with the highest tally in `byTeam` ('' when empty). Ties keep the
 * first team encountered, matching insertion order of the source rows.
 */
function primaryTeamOf(byTeam: Map<string, number>): string {
  let primaryTeam = '';
  let max = 0;
  for (const [team, value] of byTeam) {
    if (value > max) {
      max = value;
      primaryTeam = team;
    }
  }
  return primaryTeam;
}

/**
 * What the rested finale contributed to one player's season totals, so the
 * engine can subtract the same game from every one of them.
 *
 * `teamSnaps` tracks whichever denominator the season actually used: the team's
 * capacity for that game on a full-season denominator, but only the player's
 * own contribution on the games-played basis a traded season falls back to —
 * which is zero when he did not play, since nothing of that game entered the
 * denominator in the first place.
 */
function restGameSlice(params: {
  rest: RestGame;
  acc: PlayerSnapAccum;
  team: string;
  useFullSeasonDen: boolean;
  isSpec: boolean;
  totals: TeamSeasonDenominatorTotals;
}): RestGameSlice {
  const { rest, acc, team, useFullSeasonDen, isSpec, totals } = params;
  const played = acc.restByTeam.get(team);
  const capacity = totals.capacityByTeamWeek.get(`${team}|${rest.week}`);
  // The same phase the season's denominator used, or the subtraction would
  // take a defensive game out of an offensive denominator.
  const teamCapacity = capacity
    ? gameDenominatorFor({
        capacity,
        isSpecialist: isSpec,
        offenseSnaps: acc.offSnaps,
        defenseSnaps: acc.defSnaps,
      })
    : 0;
  const playedDen = phaseDenominator(
    played,
    isSpec,
    acc.offSnaps,
    acc.defSnaps,
  );

  return {
    playerGames: played?.playerGames ?? 0,
    playerShareSum: played?.shareSum ?? 0,
    playerSnaps: played?.playerSnaps ?? 0,
    teamSnaps: useFullSeasonDen ? teamCapacity : playedDen,
  };
}

/** Season totals for one player, normalised against their team's denominator. */
function finalizePlayerSeason(
  acc: PlayerSnapAccum,
  meta: NflversePlayerMeta | undefined,
  totals: TeamSeasonDenominatorTotals,
  restGames: Map<string, RestGame>,
): SeasonSnapData {
  const primaryTeam = primaryTeamOf(acc.teamSnaps);
  const isSpec = isSpecialTeamsSpecialistPosition(
    meta?.position_group,
    meta?.position,
  );
  const pt = primaryTeam ? normalizeTeam(primaryTeam) : '';
  // His own phase's capacity: an offensive player can only ever take offensive
  // snaps, so measuring him against offence + defence halves him however much
  // he plays, and mixes his team's snap split into his own number.
  const fullSeasonTeamDen = fullSeasonDenominatorFor({
    totals,
    team: pt,
    isSpecialist: isSpec,
    offenseSnaps: acc.offSnaps,
    defenseSnaps: acc.defSnaps,
  });
  const cumDen = phaseDenominator(acc, isSpec, acc.offSnaps, acc.defSnaps);
  // A single-team season can be measured against the team's whole season;
  // a traded player's games do not share one denominator.
  const useFullSeasonDen =
    acc.teamSnaps.size <= 1 && pt !== '' && fullSeasonTeamDen > 0;
  const gameCount = totals.gameCountByTeam.get(pt) ?? 0;
  const rest = pt ? restGames.get(pt) : undefined;
  // Absence is measured against the schedule the rest rule leaves behind:
  // sitting out a rested finale is not the start of a season-ending injury.
  const teamWeeks = new Set(totals.weeksByTeam.get(pt) ?? []);
  if (rest) teamWeeks.delete(rest.week);
  // Only meaningful for a single-franchise season: a traded player's "absence"
  // from one team's remaining schedule is a transaction, not an injury.
  const absenceGames = useFullSeasonDen
    ? seasonEndingAbsenceGames({ playerWeeks: acc.weeks, teamWeeks })
    : 0;
  // A bye week is not in `teamWeeks`, so it can never read as missed — which is
  // why the excusal needs no special rule for byes.
  const missedWeeks = [...teamWeeks].filter((week) => !acc.weeks.has(week));

  const baseLoad = resolveCumulativeLoadShare({
    cumNum: acc.cumNum,
    cumDenGamesPlayed: cumDen,
    fullSeasonTeamDen,
    useFullSeasonDenominator: useFullSeasonDen,
  });

  return {
    gamesPlayed: acc.gamesPlayed,
    snapShare: acc.gamesPlayed > 0 ? acc.shareSum / acc.gamesPlayed : 0,
    cumulativeSnapShare: baseLoad,
    primaryTeam,
    loadDenominator: useFullSeasonDen ? fullSeasonTeamDen : cumDen,
    ...(rest
      ? {
          restGame: restGameSlice({
            rest,
            acc,
            team: pt,
            useFullSeasonDen,
            isSpec,
            totals,
          }),
        }
      : {}),
    ...(useFullSeasonDen
      ? {
          loadMeta: {
            cumNum: acc.cumNum,
            fullSeasonTeamDen,
            cumDenGamesPlayed: cumDen,
            useFullSeason: true,
            gameCount,
            seasonEndingAbsenceGames: absenceGames,
            missedWeeks,
          },
        }
      : {}),
  };
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
    // Snaps drive every score, so a transient failure must not pass silently.
    const csv = await fetchSeasonCsv(url, `snap_counts_${season}`, {
      required: true,
    });
    if (csv === undefined) continue;

    const rows = parseCsv(csv);
    const totals = buildTeamSeasonDenominatorTotals(rows);
    const restGames = detectRestGames(rows, season);
    const { gameCountByTeam } = totals;
    if (restGames.size > 0) {
      const teams = [...restGames.keys()].sort().join(', ');
      console.log(`  ${season}: rested finale for ${teams}`);
    }

    franchiseGameCountsBySeason.set(season, new Map(gameCountByTeam));
    let maxFranchiseG = 0;
    for (const c of gameCountByTeam.values()) {
      if (c > maxFranchiseG) maxFranchiseG = c;
    }
    maxFranchiseGamesBySeason.set(season, Math.max(1, maxFranchiseG));

    for (const [pfrId, acc] of accumulatePlayerSnaps(
      rows,
      metaByPfrId,
      restGames,
      totals,
    )) {
      let pm = result.get(pfrId);
      if (!pm) {
        pm = new Map();
        result.set(pfrId, pm);
      }
      pm.set(
        season,
        finalizePlayerSeason(acc, metaByPfrId.get(pfrId), totals, restGames),
      );
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
  /**
   * The weeks behind `injuryReportWeeks`. The count is a displayed stat; the
   * set is what the excusal intersects with the weeks actually missed.
   */
  injuryWeeks: Set<number>;
  primaryTeam: string;
}

/** Load injuries data: gsis_id -> season -> { injuryReportWeeks, primaryTeam } */
/** Distinct weeks a player appeared on an injury report, and their teams. */
interface InjuryAccum {
  weeks: Set<number>;
  teamCount: Map<string, number>;
}

/** Fold one season's injury rows per player. Weeks are a set: a player can
 * appear on several reports in one week without it counting twice. */
function accumulateInjuryReports(rows: CsvRow[]): Map<string, InjuryAccum> {
  const accum = new Map<string, InjuryAccum>();

  for (const row of rows) {
    const gsisId = (row.gsis_id ?? '').trim();
    if (!gsisId) continue;

    // A missing or unparsable week used to fall back to 0, which entered the
    // set as a real week and inflated injuryReportWeeks by one.
    const week = parseInt(row.week ?? '', 10);
    const hasWeek = Number.isFinite(week) && week > 0;
    const team = row.team ?? '';

    let acc = accum.get(gsisId);
    if (!acc) {
      acc = { weeks: new Set(), teamCount: new Map() };
      accum.set(gsisId, acc);
    }
    if (hasWeek) acc.weeks.add(week);
    if (team) {
      acc.teamCount.set(team, (acc.teamCount.get(team) ?? 0) + 1);
    }
  }

  return accum;
}

async function loadInjuryData(
  seasons: number[],
): Promise<Map<string, Map<number, InjurySeasonData>>> {
  const result = new Map<string, Map<number, InjurySeasonData>>();

  for (const season of seasons) {
    const url = `${BASE}/injuries/injuries_${season}.csv`;
    // Injury reports only soften the load denominator, so a missing season
    // degrades gracefully. It still must be visible: the old silent skip read
    // identically to a season where nobody was ever listed as injured.
    const csv = await fetchSeasonCsv(url, `injuries_${season}`, {
      required: false,
    });
    if (csv === undefined) continue;

    for (const [gsisId, acc] of accumulateInjuryReports(parseCsv(csv))) {
      let pm = result.get(gsisId);
      if (!pm) {
        pm = new Map();
        result.set(gsisId, pm);
      }
      pm.set(season, {
        injuryReportWeeks: acc.weeks.size,
        injuryWeeks: acc.weeks,
        primaryTeam: primaryTeamOf(acc.teamCount),
      });
    }
  }

  return result;
}

/**
 * Load reserve weeks: gsis_id -> season -> the weeks spent on a reserve list.
 *
 * The heaviest fetch in this script — roughly 13MB per season — because the
 * weekly roster release carries every player on every roster for every week.
 *
 * `loadedSeasons` names the seasons whose CSV actually arrived. The fetch is
 * tolerant, so "no reserve rows for this player" and "the feed never spoke for
 * this season" are otherwise indistinguishable — and they must not be, because
 * the second case has to fall back to the pre-2016 heuristic.
 */
async function loadReserveData(seasons: number[]): Promise<{
  byPlayer: Map<string, Map<number, Set<number>>>;
  loadedSeasons: Set<number>;
}> {
  const byPlayer = new Map<string, Map<number, Set<number>>>();
  const loadedSeasons = new Set<number>();

  for (const season of seasons) {
    const url = `${BASE}/weekly_rosters/roster_weekly_${season}.csv`;
    // Same tolerance as injuries: reserve weeks only soften a denominator, so a
    // season that has not published yet must read as "nobody was on reserve",
    // never as a build failure.
    const csv = await fetchSeasonCsv(url, `roster_weekly_${season}`, {
      required: false,
    });
    if (csv === undefined) continue;
    loadedSeasons.add(season);

    for (const [gsisId, weeks] of accumulateReserveWeeks(parseCsv(csv))) {
      let pm = byPlayer.get(gsisId);
      if (!pm) {
        pm = new Map();
        byPlayer.set(gsisId, pm);
      }
      pm.set(season, weeks);
    }
  }

  return { byPlayer, loadedSeasons };
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

/**
 * Where every drafted player sits on a roster for the upcoming season, keyed
 * both ways because neither id is complete on its own.
 *
 * `gsis_id` is the reliable key here — the roster release carries one for
 * essentially every row, while `pfr_id` is missing from roughly 40% of them.
 * Matching on `pfr_id` alone reads established players as unrostered, which
 * downstream would score as departure.
 */
interface OffseasonRosterIndex {
  season: number;
  teamByGsisId: Map<string, string>;
  teamByPfrId: Map<string, string>;
}

/**
 * Fetch the roster for the season after the newest played one, so a pick traded
 * or released over the offseason reads as departed before Week 1.
 *
 * Returns `undefined` when the release does not exist yet: rosters publish part
 * way through the offseason, and until then picks simply carry no snapshot and
 * fall back to season data.
 */
async function loadOffseasonRoster(
  season: number,
): Promise<OffseasonRosterIndex | undefined> {
  const url = `${BASE}/rosters/roster_${season}.csv`;
  let rows: CsvRow[];
  try {
    rows = parseCsv(await fetchCsv(url));
  } catch (err) {
    console.log(`  No ${season} roster published yet (${String(err)})`);
    return undefined;
  }

  const teamByGsisId = new Map<string, string>();
  const teamByPfrId = new Map<string, string>();
  for (const row of rows) {
    const team = normalizeTeam(row.team ?? '');
    if (!team) continue;
    const gsisId = (row.gsis_id ?? '').trim();
    const pfrId = (row.pfr_id ?? '').trim();
    if (gsisId) teamByGsisId.set(gsisId, team);
    if (pfrId) teamByPfrId.set(pfrId, team);
  }
  console.log(
    `  ${rows.length} ${season} roster rows (${teamByGsisId.size} by gsis, ${teamByPfrId.size} by pfr)`,
  );
  return { season, teamByGsisId, teamByPfrId };
}

/** One season of a drafted player's career, as written to draft-<year>.json. */
interface PickSeason {
  year: number;
  gamesPlayed: number;
  teamGames: number;
  snapShare: number;
  cumulativeSnapShare: number;
  retained: boolean;
  injuryReportWeeks?: number;
  /** Weeks spent on a reserve list; only from FIRST_RESERVE_SEASON */
  reserveWeeks?: number;
  /** Team games missed after the player disappeared for the rest of the season */
  seasonEndingAbsenceGames?: number;
  /** Games the load denominator actually forgave; see {@link ../src/types}. */
  excusedGames?: number;
  /** Present when the player's primary team rested through its finale */
  restGame?: RestGameSlice;
  /** Denominator behind `cumulativeSnapShare`; only travels with `restGame` */
  loadDenominator?: number;
  currentTeam?: string;
}

/** A drafted player and their tracked seasons, as written to draft-<year>.json. */
interface DraftPick {
  playerId: string;
  playerName: string;
  position: string;
  round: number;
  overallPick: number;
  teamId: string;
  espnId?: string;
  headshotUrl?: string;
  seasons: PickSeason[];
}

/** Per-season lookups shared across every pick in a draft class. */
interface SeasonLookups {
  franchiseGameCountsBySeason: Map<number, Map<string, number>>;
  maxFranchiseGamesBySeason: Map<number, number>;
}

/**
 * Whether a player was still with their drafting team in season `s`.
 *
 * Snap data is the primary signal, injury reports the fallback. When a player
 * is absent from both (injured all year, practice squad), we infer retention
 * from the adjacent seasons: bracketed by the drafting team means they never
 * left.
 */
function resolveRetained(params: {
  primaryTeam: string;
  injuryTeam: string;
  teamId: string;
  season: number;
  playerSnaps?: Map<number, SeasonSnapData>;
  playerInjuries?: Map<number, InjurySeasonData>;
}): boolean {
  const {
    primaryTeam,
    injuryTeam,
    teamId,
    season,
    playerSnaps,
    playerInjuries,
  } = params;

  if (primaryTeam !== '') return normalizeTeam(primaryTeam) === teamId;
  if (injuryTeam !== '') return normalizeTeam(injuryTeam) === teamId;

  const nextTeam =
    playerSnaps?.get(season + 1)?.primaryTeam ??
    playerInjuries?.get(season + 1)?.primaryTeam ??
    '';
  const prevTeam =
    playerSnaps?.get(season - 1)?.primaryTeam ??
    playerInjuries?.get(season - 1)?.primaryTeam ??
    '';
  return (
    normalizeTeam(nextTeam) === teamId || normalizeTeam(prevTeam) === teamId
  );
}

/**
 * The era gate: does this season take its injury signal from the roster feed?
 *
 * `seasonEndingAbsenceGames` is computed unconditionally in loadSnapData and
 * carried on loadMeta, so this is where it stops being written: from
 * FIRST_RESERVE_SEASON the roster feed measures the same absence directly and
 * better, and a season must never carry both — which one it carries is how a
 * reader tells the eras apart.
 *
 * The condition is "the reserve feed actually spoke for this season", not
 * merely "this season is recent enough that it should have". The roster fetch
 * is tolerant of a missing or failed CSV, so gating on the year alone would let
 * one 404 strip *both* signals from a season — zero reserve weeks and a
 * suppressed heuristic — which is worse than either era's own behaviour. When
 * the feed is silent the season falls back to the pre-2016 heuristic.
 */
function usesReserveSignal(
  season: number,
  loadedReserveSeasons: ReadonlySet<number>,
): boolean {
  return season >= FIRST_RESERVE_SEASON && loadedReserveSeasons.has(season);
}

/**
 * Games this season's load forgives: the weeks he missed that the injury report
 * or the reserve list documents as injury.
 *
 * The two feeds are unioned, not maxed, because a player placed on injured
 * reserve is removed from the weekly injury report — they are consecutive
 * halves of one absence. Ronnie Stanley 2021 is the shape: injury report weeks
 * 1–6, reserve weeks 7–18, no overlap, 16 games missed. `max()` forgave 11; the
 * union forgives all 16. Week 8 was Baltimore's bye and is in neither set,
 * which is exactly why intersecting with `missedWeeks` — built from the team's
 * own weeks — needs no special rule for byes.
 *
 * `undefined` loadMeta means the season is not scored against a full-season
 * denominator (traded, or no primary team), where there is nothing to forgive.
 */
function excusedGamesForSeason(params: {
  loadMeta?: SeasonLoadMeta;
  injuryWeeks?: ReadonlySet<number>;
  /** Only supplied when the era gate lets the reserve feed speak. */
  reserveWeeks?: ReadonlySet<number>;
}): number {
  const { loadMeta, injuryWeeks, reserveWeeks } = params;
  if (!loadMeta) return 0;
  return excusedAbsenceGames({
    missedWeeks: loadMeta.missedWeeks,
    injuryWeeks,
    reserveWeeks,
  });
}

/** The injury figures one season stores, and the one its denominator uses. */
interface SeasonInjurySignals {
  /** Weeks on the weekly injury report — a displayed stat only. */
  injuryReportWeeks: number;
  /** Weeks on a reserve list — a displayed stat only, and era-gated. */
  reserveWeeks: number;
  /** The 2013–2015 fallback; never written alongside `reserveWeeks`. */
  absenceGames: number;
  /** What the denominator actually forgives; see {@link excusedGamesForSeason}. */
  excusedGames: number;
}

/**
 * Resolve one season's injury signals, applying the era gate in one place.
 *
 * The injury report speaks in every season. The reserve feed speaks only from
 * FIRST_RESERVE_SEASON and only where its CSV actually loaded, and where it
 * does, the pre-2016 snap-shape heuristic falls silent — see
 * {@link usesReserveSignal}.
 */
function resolveInjurySignals(params: {
  season: number;
  loadMeta?: SeasonLoadMeta;
  injData?: InjurySeasonData;
  playerReserve?: Map<number, Set<number>>;
  loadedReserveSeasons: ReadonlySet<number>;
}): SeasonInjurySignals {
  const { season, loadMeta, injData, playerReserve, loadedReserveSeasons } =
    params;
  const useReserve = usesReserveSignal(season, loadedReserveSeasons);
  const reserveWeeks = useReserve ? playerReserve?.get(season) : undefined;

  return {
    injuryReportWeeks: injData?.injuryReportWeeks ?? 0,
    reserveWeeks: reserveWeeks?.size ?? 0,
    absenceGames: useReserve ? 0 : (loadMeta?.seasonEndingAbsenceGames ?? 0),
    excusedGames: excusedGamesForSeason({
      loadMeta,
      injuryWeeks: injData?.injuryWeeks,
      reserveWeeks,
    }),
  };
}

/** Build one season record for a pick, resolving denominators and retention. */
function buildPickSeason(params: {
  season: number;
  teamId: string;
  playerSnaps?: Map<number, SeasonSnapData>;
  playerInjuries?: Map<number, InjurySeasonData>;
  playerReserve?: Map<number, Set<number>>;
  loadedReserveSeasons: ReadonlySet<number>;
  lookups: SeasonLookups;
}): PickSeason {
  const {
    season,
    teamId,
    playerSnaps,
    playerInjuries,
    playerReserve,
    loadedReserveSeasons,
    lookups,
  } = params;

  const data = playerSnaps?.get(season);
  const injData = playerInjuries?.get(season);
  const gamesPlayed = data?.gamesPlayed ?? 0;
  const primaryTeam = data?.primaryTeam ?? '';
  const injuryTeam = injData?.primaryTeam ?? '';
  const teamGames = resolveTeamGamesDenominator({
    franchiseGameCounts: lookups.franchiseGameCountsBySeason.get(season),
    maxFranchiseGamesInSeason:
      lookups.maxFranchiseGamesBySeason.get(season) ?? 17,
    primaryTeamRaw: primaryTeam,
    injuryTeamRaw: injuryTeam,
    draftingTeamNormalized: teamId,
    normalizeTeam,
  });
  const snapShare = data?.snapShare ?? 0;
  const { injuryReportWeeks, reserveWeeks, absenceGames, excusedGames } =
    resolveInjurySignals({
      season,
      loadMeta: data?.loadMeta,
      injData,
      playerReserve,
      loadedReserveSeasons,
    });

  const restGame = data?.restGame;
  let cumulativeSnapShare = data?.cumulativeSnapShare ?? snapShare;
  let loadDenominator = data?.loadDenominator ?? 0;
  if (data?.loadMeta?.useFullSeason) {
    const load = resolveCumulativeLoadWithInjury({
      cumNum: data.loadMeta.cumNum,
      cumDenGamesPlayed: data.loadMeta.cumDenGamesPlayed,
      fullSeasonTeamDen: data.loadMeta.fullSeasonTeamDen,
      useFullSeasonDenominator: true,
      excusedGames,
      seasonEndingAbsenceGames: absenceGames,
      teamGames,
      gamesPlayed,
      gameCount: data.loadMeta.gameCount,
      restTeamGames: restGame ? 1 : 0,
      restPlayerGames: restGame?.playerGames ?? 0,
    });
    cumulativeSnapShare = load.share;
    loadDenominator = load.denominator;
  }
  // Cumulative load is a season-long average; it cannot exceed the per-game
  // share. A rest season is left uncapped here and capped by `withoutRestGame`
  // instead: rest moves both terms, and capping now would clamp the load
  // against an average that still counts the rested game.
  if (!restGame && snapShare > 0 && cumulativeSnapShare > snapShare) {
    cumulativeSnapShare = snapShare;
  }

  const retained = resolveRetained({
    primaryTeam,
    injuryTeam,
    teamId,
    season,
    playerSnaps,
    playerInjuries,
  });

  // Departed players are shown with the team they actually played for.
  const departedTeam = primaryTeam !== '' ? primaryTeam : injuryTeam;
  const currentTeamId =
    !retained && departedTeam !== '' ? normalizeTeam(departedTeam) : undefined;

  return {
    year: season,
    gamesPlayed,
    teamGames,
    snapShare,
    cumulativeSnapShare,
    retained,
    ...(injuryReportWeeks > 0 ? { injuryReportWeeks } : {}),
    ...(absenceGames > 0 ? { seasonEndingAbsenceGames: absenceGames } : {}),
    ...(reserveWeeks > 0 ? { reserveWeeks } : {}),
    ...(excusedGames > 0 ? { excusedGames } : {}),
    // The denominator only travels with a rest game, which is the one thing
    // that needs to reopen the ratio.
    ...(restGame ? { restGame, loadDenominator } : {}),
    ...(currentTeamId ? { currentTeam: currentTeamId } : {}),
  };
}

/** Everything a draft class needs to turn one CSV row into a {@link DraftPick}. */
interface PickSources {
  snapData: Map<string, Map<number, SeasonSnapData>>;
  injuryData: Map<string, Map<number, InjurySeasonData>>;
  reserveData: Map<string, Map<number, Set<number>>>;
  /** Seasons whose weekly-roster CSV actually loaded; see {@link loadReserveData}. */
  loadedReserveSeasons: ReadonlySet<number>;
  headshots: Map<string, string>;
  lookups: SeasonLookups;
  /** Newest season with played games, derived from the snap-count releases. */
  maxSeason: number;
  /** Absent when no roster has been published for the upcoming season. */
  roster?: OffseasonRosterIndex;
}

/**
 * Build one pick from a draft_picks row, with a season record for every year
 * from the draft through the newest played season. Column names vary across
 * nflverse
 * releases, hence the `??` chains. `fallbackIndex` only names picks that have
 * no id at all.
 */
function buildDraftPick(
  row: CsvRow,
  year: number,
  fallbackIndex: number,
  sources: PickSources,
): DraftPick {
  const pfrId =
    row.pfr_player_id ?? row.pfr_id ?? row.player_id ?? row.gsis_id ?? '';
  const gsisId = (row.gsis_id ?? '').trim();
  const teamId = normalizeTeam(row.team ?? row.draft_team ?? '');
  const espnId = row.espn_id ?? row.espnid;

  const playerSnaps = sources.snapData.get(pfrId);
  const playerInjuries = gsisId ? sources.injuryData.get(gsisId) : undefined;
  const playerReserve = gsisId ? sources.reserveData.get(gsisId) : undefined;

  const seasons: PickSeason[] = [];
  for (let s = year; s <= sources.maxSeason; s++) {
    seasons.push(
      buildPickSeason({
        season: s,
        teamId,
        playerSnaps,
        playerInjuries,
        playerReserve,
        loadedReserveSeasons: sources.loadedReserveSeasons,
        lookups: sources.lookups,
      }),
    );
  }

  // Only classes that have played get one. The incoming class is on its
  // drafting team by definition, and the roster release does not list it yet
  // anyway — a row would read those picks as unrostered, meaning departed.
  if (sources.roster && year <= sources.maxSeason) {
    const offseason = buildOffseasonSeason({
      roster: sources.roster,
      gsisId,
      pfrId,
      teamId,
      seasons,
      maxSeason: sources.maxSeason,
    });
    if (offseason) seasons.push(offseason);
  }

  const headshotUrl = pfrId ? sources.headshots.get(pfrId) : undefined;
  return {
    playerId: pfrId || `unknown-${year}-${fallbackIndex}`,
    playerName:
      row.pfr_player_name ?? row.player_name ?? row.player ?? 'Unknown',
    position: normalizeDraftPosition(row.pos ?? row.position ?? '?'),
    round: parseInt(row.round ?? '0', 10) || 1,
    overallPick: parseInt(row.pick ?? row.overall ?? '0', 10) || 1,
    teamId,
    ...(espnId ? { espnId } : {}),
    ...(headshotUrl ? { headshotUrl } : {}),
    seasons,
  };
}

/**
 * A row for the upcoming season recording where a pick stands before a snap of
 * it has been played, or `undefined` when there is nothing worth saying.
 *
 * The row is deliberately a normal season with `teamGames: 0`, the marker for
 * "not played yet" (see `src/lib/seasonPlayed.ts`). That keeps a player's
 * career one uniform list, so departure flows through the same
 * `retained`/`currentTeam` fields as every other year — no parallel concept.
 *
 * Emitted only when it changes the picture: the player is on some roster, or he
 * finished `maxSeason` with his drafting team and now is not on one.
 * A pick who left years ago and is still out of the league gets nothing, since
 * his played seasons already say so and a fresh row would only add noise.
 */
function buildOffseasonSeason(params: {
  roster: OffseasonRosterIndex;
  gsisId: string;
  pfrId: string;
  teamId: string;
  seasons: PickSeason[];
  maxSeason: number;
}): PickSeason | undefined {
  const { roster, gsisId, pfrId, teamId, seasons, maxSeason } = params;
  const rosterTeam =
    (gsisId ? roster.teamByGsisId.get(gsisId) : undefined) ??
    (pfrId ? roster.teamByPfrId.get(pfrId) : undefined);

  const heldAtSeasonEnd = seasons.some(
    (s) => s.year === maxSeason && s.retained,
  );
  if (!rosterTeam && !heldAtSeasonEnd) return undefined;

  const retained = rosterTeam === teamId;
  return {
    year: roster.season,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    cumulativeSnapShare: 0,
    retained,
    // Left off when no team rosters him: unsigned and retired look identical
    // here, and the app reads a missing team as free agency either way.
    ...(!retained && rosterTeam ? { currentTeam: rosterTeam } : {}),
  };
}

/**
 * True when nflverse has published snap counts with rows for `season`.
 *
 * Rows, not merely a release: an empty or header-only file would otherwise
 * promote a season nobody has played.
 */
async function seasonHasSnapCounts(season: number): Promise<boolean> {
  const csv = await fetchCsv(`${BASE}/snap_counts/snap_counts_${season}.csv`);
  return parseCsv(csv).length > 0;
}

/** Seasons `from`..`to` inclusive. */
function seasonRange(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

async function main() {
  const outDir = path.join(process.cwd(), 'public', 'data');
  fs.mkdirSync(outDir, { recursive: true });

  // Derived, not hard-coded, so a mid-season run picks up the season in
  // progress on its own. A stale constant here would leave the pipeline
  // ignoring live games while still labelling them "not played yet".
  console.log('Resolving the newest played season...');
  const maxSeason = await resolveLatestPlayedSeason({
    floor: FIRST_SNAP_SEASON,
    ceiling: new Date().getUTCFullYear(),
    hasPlayedData: seasonHasSnapCounts,
  });
  // Roster state is only ever read for a season with no games yet, so it must
  // stay one clear of maxSeason: scoring divides by seasons that have been
  // *played*, and letting this leak into the window would deflate every
  // current pick's score.
  const rosterSeason = maxSeason + 1;
  console.log(`  Newest played season: ${maxSeason}`);

  console.log('Fetching draft_picks...');
  const draftCsv = await fetchCsv(`${BASE}/draft_picks/draft_picks.csv`);
  const draftRows = parseCsv(draftCsv);

  // Every class nflverse has drafted, so a new draft needs no code change.
  const draftYears = [
    ...new Set(
      draftRows
        .map((r) => parseInt(r.season ?? r.draft_year ?? r.year ?? '0', 10))
        .filter((y) => y >= FIRST_DRAFT_YEAR),
    ),
  ].sort((a, b) => a - b);
  // Without this, an empty list wrote `season-window.json` with undefined
  // bounds (JSON.stringify drops them), and the year selector and sitemap
  // silently lost every class instead of the run failing here.
  if (draftYears.length === 0) {
    throw new Error(
      `No draft classes at or after ${FIRST_DRAFT_YEAR} in ${draftRows.length} draft_picks rows`,
    );
  }
  console.log(`  Draft classes: ${draftYears[0]}–${draftYears.at(-1)}`);

  console.log('Fetching nflverse players (headshots + positions)...');
  const { headshots, metaByPfrId } = await loadNflversePlayers();

  const snapSeasons = seasonRange(FIRST_SNAP_SEASON, maxSeason);
  console.log(`Fetching snap_counts (${FIRST_SNAP_SEASON}–${maxSeason})...`);
  const { snapData, franchiseGameCountsBySeason, maxFranchiseGamesBySeason } =
    await loadSnapData(snapSeasons, metaByPfrId);
  const lookups: SeasonLookups = {
    franchiseGameCountsBySeason,
    maxFranchiseGamesBySeason,
  };

  const injurySeasons = seasonRange(FIRST_INJURY_SEASON, maxSeason);
  console.log(`Fetching injuries (${FIRST_INJURY_SEASON}–${maxSeason})...`);
  const injuryData = await loadInjuryData(injurySeasons);

  const reserveSeasons = seasonRange(FIRST_RESERVE_SEASON, maxSeason);
  console.log(
    `Fetching weekly rosters (${FIRST_RESERVE_SEASON}–${maxSeason})...`,
  );
  const { byPlayer: reserveData, loadedSeasons: loadedReserveSeasons } =
    await loadReserveData(reserveSeasons);

  console.log(`Fetching ${rosterSeason} rosters (offseason departures)...`);
  const roster = await loadOffseasonRoster(rosterSeason);

  const sources: PickSources = {
    snapData,
    injuryData,
    reserveData,
    loadedReserveSeasons,
    headshots,
    lookups,
    maxSeason,
    ...(roster ? { roster } : {}),
  };

  for (const year of draftYears) {
    console.log(`Processing ${year}...`);

    const yearPicks = draftRows.filter(
      (r) => parseInt(r.season ?? r.draft_year ?? r.year ?? '0', 10) === year,
    );

    const picks: DraftPick[] = [];
    for (const row of yearPicks) {
      picks.push(buildDraftPick(row, year, picks.length, sources));
    }

    const draftClass = { year, picks };
    const outPath = path.join(outDir, `draft-${year}.json`);
    fs.writeFileSync(outPath, JSON.stringify(draftClass, null, 2));
    console.log(`  Wrote ${picks.length} picks to ${outPath}`);
  }

  const metaPath = path.join(outDir, 'data-meta.json');
  const lastUpdated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(metaPath, JSON.stringify({ lastUpdated }, null, 2) + '\n');
  console.log(`  Wrote data stamp ${metaPath}`);

  // Scoring sizes each pick's rookie-contract window against the newest season
  // in the dataset, so it must know that season without waiting on a fetch. The
  // draft-class bounds ride along so the year selector and the sitemap offer
  // exactly the classes written above. This lands in src/data/ rather than
  // public/data/ deliberately: it is imported at build time, and an async load
  // would race the first score.
  const seasonWindowPath = path.join(
    process.cwd(),
    'src',
    'data',
    'season-window.json',
  );
  fs.writeFileSync(
    seasonWindowPath,
    JSON.stringify(
      {
        latestSeason: maxSeason,
        firstDraftYear: draftYears[0],
        latestDraftYear: draftYears.at(-1),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`  Wrote season window ${seasonWindowPath}`);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
