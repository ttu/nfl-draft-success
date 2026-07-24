import { normalizeNflverseTeam } from './nflverseFranchise';

/** The subset of nflverse `games.csv` columns the aggregation reads. */
export interface GamesCsvRow {
  season: string;
  /** REG for regular season; WC / DIV / CON / SB for the postseason. */
  game_type: string;
  home_team: string;
  away_team: string;
  /** Home-team margin (home_score − away_score); empty for unplayed games. */
  result: string;
}

/** One team's outcomes for a single season. */
export interface TeamSeasonRecord {
  year: number;
  wins: number;
  losses: number;
  ties: number;
  madePlayoffs: boolean;
  reachedSB: boolean;
  wonSB: boolean;
}

/** A team's per-season outcomes, as stored in `team-success.json`. */
export interface TeamSeasonRecords {
  teamId: string;
  seasons: TeamSeasonRecord[];
}

/** Shape of `public/data/team-success.json`, written by generate-team-success. */
export interface TeamSuccessData {
  /** Span of seasons stored (each team may have fewer if any went unplayed). */
  from: number;
  to: number;
  teams: TeamSeasonRecords[];
}

/** A team's outcomes aggregated over a selected window, joined to draft scores. */
export interface TeamSuccess {
  teamId: string;
  /** Seasons with played games in the window (the playoff-apps denominator). */
  seasons: number;
  wins: number;
  losses: number;
  ties: number;
  /** Regular-season winning percentage over the window, ties as a half (0–1). */
  winPct: number;
  /** Seasons in the window the team reached the postseason. */
  playoffApps: number;
  sbApps: number;
  sbWins: number;
}

interface SeasonAccum {
  wins: number;
  losses: number;
  ties: number;
  madePlayoffs: boolean;
  reachedSB: boolean;
  wonSB: boolean;
}

function emptySeason(): SeasonAccum {
  return {
    wins: 0,
    losses: 0,
    ties: 0,
    madePlayoffs: false,
    reachedSB: false,
    wonSB: false,
  };
}

/**
 * Apply one played game to its two teams' season accumulators. `margin` is the
 * home-team margin: positive means the home team won, negative the away team.
 */
function applyGame(
  homeAcc: SeasonAccum,
  awayAcc: SeasonAccum,
  gameType: string,
  margin: number,
): void {
  if (gameType === 'REG') {
    if (margin > 0) {
      homeAcc.wins += 1;
      awayAcc.losses += 1;
    } else if (margin < 0) {
      awayAcc.wins += 1;
      homeAcc.losses += 1;
    } else {
      homeAcc.ties += 1;
      awayAcc.ties += 1;
    }
    return;
  }

  // Any non-REG game is a postseason appearance for both teams.
  homeAcc.madePlayoffs = true;
  awayAcc.madePlayoffs = true;

  if (gameType === 'SB') {
    homeAcc.reachedSB = true;
    awayAcc.reachedSB = true;
    if (margin > 0) homeAcc.wonSB = true;
    else if (margin < 0) awayAcc.wonSB = true;
  }
}

/**
 * Fold nflverse `games.csv` rows into per-team, per-season records for seasons
 * in `[from, to]`. Storing by season (rather than a single window aggregate)
 * lets the app recompute outcomes for whatever year range the user selects.
 *
 * `result` is the home-team margin, so a positive value is a home win and a
 * negative value an away win. Unplayed games (blank result) are ignored, so a
 * season with no played games simply produces no record.
 */
export function buildSeasonRecords(
  rows: GamesCsvRow[],
  from: number,
  to: number,
): TeamSeasonRecords[] {
  // teamId -> season -> accumulator
  const byTeam = new Map<string, Map<number, SeasonAccum>>();
  const seasonFor = (team: string, season: number): SeasonAccum => {
    let seasons = byTeam.get(team);
    if (!seasons) {
      seasons = new Map();
      byTeam.set(team, seasons);
    }
    let acc = seasons.get(season);
    if (!acc) {
      acc = emptySeason();
      seasons.set(season, acc);
    }
    return acc;
  };

  for (const row of rows) {
    const season = parseInt(row.season, 10);
    if (Number.isNaN(season) || season < from || season > to) continue;
    if (row.result === '' || row.result == null) continue;
    const margin = parseInt(row.result, 10);
    if (Number.isNaN(margin)) continue;

    const home = normalizeNflverseTeam(row.home_team);
    const away = normalizeNflverseTeam(row.away_team);
    applyGame(
      seasonFor(home, season),
      seasonFor(away, season),
      row.game_type,
      margin,
    );
  }

  return Array.from(byTeam.entries())
    .map(([teamId, seasons]) => ({
      teamId,
      seasons: Array.from(seasons.entries())
        .map(([year, acc]) => ({ year, ...acc }))
        .sort((a, b) => a.year - b.year),
    }))
    .sort((a, b) => a.teamId.localeCompare(b.teamId));
}

/**
 * Aggregate stored per-season records into one {@link TeamSuccess} per team over
 * the selected `[from, to]` window: a combined regular-season win rate plus
 * counts of playoff appearances, Super Bowl appearances and Super Bowl wins.
 * Teams with no played seasons in the window are omitted.
 */
export function teamSuccessForWindow(
  teams: TeamSeasonRecords[],
  from: number,
  to: number,
): TeamSuccess[] {
  const result: TeamSuccess[] = [];
  for (const team of teams) {
    const seasons = team.seasons.filter((s) => s.year >= from && s.year <= to);
    if (seasons.length > 0) {
      result.push(sumSeasons(team.teamId, seasons));
    }
  }
  return result;
}

/** Combine a team's in-window season records into a single {@link TeamSuccess}. */
function sumSeasons(teamId: string, seasons: TeamSeasonRecord[]): TeamSuccess {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let playoffApps = 0;
  let sbApps = 0;
  let sbWins = 0;
  for (const s of seasons) {
    wins += s.wins;
    losses += s.losses;
    ties += s.ties;
    if (s.madePlayoffs) playoffApps += 1;
    if (s.reachedSB) sbApps += 1;
    if (s.wonSB) sbWins += 1;
  }
  const games = wins + losses + ties;
  return {
    teamId,
    seasons: seasons.length,
    wins,
    losses,
    ties,
    winPct: games > 0 ? (wins + ties * 0.5) / games : 0,
    playoffApps,
    sbApps,
    sbWins,
  };
}
