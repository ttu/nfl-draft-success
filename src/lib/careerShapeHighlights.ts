import type { DraftClass, DraftPick, Role, Season, Team } from '../types';
import { withoutApprenticeSeasons } from './apprenticeship';
import {
  classifyRole,
  CORE_TIER_THRESHOLD,
  SIGNIFICANT_TIER_THRESHOLD,
} from './classifyRole';
import { getSeasonScore } from './getSeasonScore';
import { normalizeSnapShareForPosition } from './positionBaseline';
import { isAtLeastRole } from './roleDisplay';
import { MIN_SEASON_ENDING_ABSENCE_GAMES } from './seasonEndingAbsence';
import { playedSeasons } from './seasonPlayed';
import { seasonTag } from './seasonTag';
import { snapShareForRoleTier } from './snapShareForTier';

/**
 * A player row ranked by a list's own quantity, rather than by the over-slot
 * residual that {@link PlayerHighlight} carries. Each list formats its own
 * numbers at the source so the view stays free of per-list branching.
 */
export interface RankedPlayer {
  pick: DraftPick;
  team: Team | undefined;
  draftYear: number;
  /** The quantity the list ranked on; tests and tie-breaks read this. */
  value: number;
  /** `value` rendered for the right-hand column, e.g. `+76`. */
  headline: string;
  /** Supporting context for the meta line, e.g. `12% → 88%`. */
  detail: string;
}

/** The four career-shape lists. */
export interface CareerShapeHighlights {
  dayOneStarters: RankedPlayer[];
  lateBloomers: RankedPlayer[];
  ironMen: RankedPlayer[];
  snakebit: RankedPlayer[];
}

/** Played seasons needed before a rise from the bench to a peak means anything. */
export const MIN_BLOOM_SEASONS = 3;

/**
 * Seasons a player must open his career buried before rising counts as blooming.
 *
 * Without it the list was a rise from *anywhere*, and against real data 883
 * picks qualified — the top twenty a wall of identical `+100`s, most of them
 * players whose rookie year simply never happened. Blooming late means having
 * waited, and one quiet rookie season is not a wait; it is a rookie season.
 */
export const MIN_WAIT_SEASONS = 2;

/**
 * Usage below which a season counts as waiting: anything short of a significant
 * contributor's share, i.e. he was on the roster and not really on the field.
 */
export const WAIT_TIER_CEILING = SIGNIFICANT_TIER_THRESHOLD;

/**
 * Share of team games a player must have been there for before a low-usage
 * season reads as waiting rather than as missing.
 *
 * Travis Kelce is the case that forced this: one game as a rookie, then a
 * decade of full-time football. Counting that year as a 0% baseline manufactures
 * a +100 bloom out of an absence — he was hurt, not buried. Seasons under this
 * floor are stepped over entirely (see {@link leadingWaitSeasons}), which needs
 * no injury data and so treats injury, IR, and inactives alike.
 */
export const WAIT_AVAILABILITY_SHARE = 0.5;

/**
 * Full-time seasons a late bloomer must hold before the rise counts as blooming.
 *
 * Without it the list rewards a spike: Darrick Forrest rose from 2% as a rookie
 * to one starting season and a five-game run at 99%, then fell back to 10% and
 * out of the league — and read as a +97 bloom. Rising is only half the claim;
 * the list says he *became* a starter, so he has to have stayed one.
 */
export const MIN_SUSTAINED_PEAK_SEASONS = 2;

/** Shortest run of full, contributing seasons that counts as an iron-man streak. */
export const MIN_IRON_MAN_STREAK = 3;

/** Career games below which "great when he played" is too small a sample. */
export const MIN_SNAKEBIT_GAMES = 8;

/**
 * Share of team games a player must appear in for the season to read as fully
 * available: 16 of a 17-game season. Rest games are already subtracted upstream
 * (`draftClass.ts`), so a rested finale cannot push a season under this.
 */
export const FULL_AVAILABILITY_GAMES_SHARE = 0.94;

/** How many players each list holds. Matches the highlight lists' expanded size. */
export const CAREER_SHAPE_LIST_MAX = 20;

/** Played seasons in ascending year order. */
function careerSeasons(pick: DraftPick): Season[] {
  return [...playedSeasons(pick)].sort((a, b) => a.year - b.year);
}

/**
 * The seasons a player was plausibly in the league for: played seasons up to and
 * including the last one he took a snap in.
 *
 * The pipeline writes a row for **every** season in the loaded window, whether
 * or not the player was on a roster — a 2013 pick who never played again after
 * his rookie year still carries a dozen rows of `gamesPlayed: 0` against full
 * team schedules. Reading those as career is how "games missed" turned into
 * "years since you washed out".
 *
 * Trailing empty seasons drop off; an empty season **between** two played ones
 * stays, because a year lost to injury mid-career is exactly what the lists
 * about availability are trying to see.
 */
export function activeCareerSeasons(pick: DraftPick): Season[] {
  const seasons = careerSeasons(pick);
  let last = -1;
  for (let i = 0; i < seasons.length; i += 1) {
    if (seasons[i].gamesPlayed > 0) last = i;
  }
  return last < 0 ? [] : seasons.slice(0, last + 1);
}

/** The pick's rookie season, if he played one. */
function rookieSeason(pick: DraftPick): Season | undefined {
  return careerSeasons(pick).find((s) => s.year === pick.draftYear);
}

/** Whole-percent rendering of a 0–1 share. */
function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** The role a single season classifies as, on its own. */
export function seasonRole(season: Season, position: string): Role {
  return classifyRole(
    snapShareForRoleTier(season, position),
    season.teamGames > 0 ? season.gamesPlayed / season.teamGames : 0,
    position,
  );
}

/**
 * Whether a season counts toward an iron-man streak: the player was there for
 * effectively all of it, and was doing something when he was. Without the role
 * half, the list ranks core special-teamers, who dress every week by job
 * description.
 */
function isIronManSeason(season: Season, position: string): boolean {
  const available =
    season.teamGames > 0 &&
    season.gamesPlayed / season.teamGames >= FULL_AVAILABILITY_GAMES_SHARE &&
    (season.seasonEndingAbsenceGames ?? 0) < MIN_SEASON_ENDING_ABSENCE_GAMES;
  return (
    available &&
    isAtLeastRole(seasonRole(season, position), 'significant_contributor')
  );
}

/** A run of consecutive qualifying seasons, inclusive of both end years. */
interface IronManStreak {
  length: number;
  from: number;
  to: number;
}

/** The longest run of consecutive qualifying seasons, or null if none reaches the floor. */
function longestIronManStreak(
  seasons: Season[],
  position: string,
): IronManStreak | null {
  let best: IronManStreak | null = null;
  let run: IronManStreak | null = null;

  for (const season of seasons) {
    if (!isIronManSeason(season, position)) {
      run = null;
      continue;
    }
    run =
      run !== null && season.year === run.to + 1
        ? { length: run.length + 1, from: run.from, to: season.year }
        : { length: 1, from: season.year, to: season.year };
    if (run.length >= MIN_IRON_MAN_STREAK && run.length > (best?.length ?? 0)) {
      best = run;
    }
  }
  return best;
}

/** The pick-identifying half of a {@link RankedPlayer}, shared by every list. */
type RankedPlayerBase = Pick<RankedPlayer, 'pick' | 'team' | 'draftYear'>;

/** Collect a row a list only sometimes produces, keeping the caller branchless. */
function pushRow<T extends RankedPlayer>(list: T[], row: T | null): void {
  if (row !== null) list.push(row);
}

/** A day-one row carrying the career total that breaks its ties. */
interface DayOneRow extends RankedPlayer {
  careerScore: number;
}

/**
 * Rookie-year usage, for a pick who played a rookie year **and kept the job**.
 *
 * Starting week one is only half of it. Jonathan Mingo took 89% of the snaps as
 * a rookie and 42% the year after — he won a starting job and lost it, which is
 * a different story from the one this list tells. His second season has to have
 * held.
 *
 * A pick who has not played a second season yet is admitted: nothing has
 * contradicted him. That is deliberate — a day-one start is a claim about the
 * rookie year, and the newest class is exactly the data that supports it, which
 * is why the design rejected a maturity gate in the first place.
 */
function dayOneStarterRow(
  base: RankedPlayerBase,
  seasons: Season[],
): DayOneRow | null {
  const pick = base.pick;
  const rookie = rookieSeason(pick);
  if (rookie === undefined) return null;

  const secondSeason = seasons.find((s) => s.year > pick.draftYear);
  if (
    secondSeason !== undefined &&
    seasonRole(secondSeason, pick.position) !== 'core_starter'
  ) {
    return null;
  }

  const share = snapShareForRoleTier(rookie, pick.position);
  return {
    ...base,
    value: share,
    headline: pct(share),
    detail: 'rookie year',
    careerScore: careerScoreOf(seasons, pick.position),
  };
}

/**
 * Every season of the career added up, on the same 0–100 per-season scale the
 * rest of the app scores with.
 *
 * Summed rather than averaged on purpose. This only ever breaks ties, and the
 * ties are large — dozens of picks share a 100% rookie share — so the question
 * it answers is "who had the better career", where eight years of starting
 * should beat two. A mean inverts that.
 */
function careerScoreOf(seasons: Season[], position: string): number {
  return seasons.reduce((sum, s) => sum + getSeasonScore(s, position), 0);
}

/**
 * A late-bloomer row with the two quantities that break its ties.
 *
 * Rises bunch near the top — a player buried at 2% who later starts full-time
 * scores close to the maximum however long he lasted. Peak share and the number
 * of seasons he *held* the peak are what separate a twelve-year star from a
 * one-year wonder.
 */
interface LateBloomerRow extends RankedPlayer {
  peakShare: number;
  sustainedSeasons: number;
}

/**
 * The run of seasons a career opens buried: available for the season, and still
 * used below {@link WAIT_TIER_CEILING}.
 *
 * Seasons he was mostly absent for are **stepped over** rather than counted or
 * treated as the end of the wait — a year lost to injury in the middle of a wait
 * did not end it, and a year lost at the start of one never began it. The run
 * ends at the first season he was both available for and genuinely used in.
 */
function leadingWaitSeasons(seasons: Season[], position: string): Season[] {
  const wait: Season[] = [];
  for (const season of seasons) {
    const available =
      season.teamGames > 0 &&
      season.gamesPlayed / season.teamGames >= WAIT_AVAILABILITY_SHARE;
    if (!available) continue;
    if (snapShareForRoleTier(season, position) >= WAIT_TIER_CEILING) break;
    wait.push(season);
  }
  return wait;
}

/** The rise from a career spent waiting to career-peak usage, when there was one. */
function lateBloomerRow(
  base: RankedPlayerBase,
  career: Season[],
): LateBloomerRow | null {
  // A quarterback's bench years are the position's normal development path, not
  // a career he had to climb out of, so they leave the career the same way every
  // scoring path in the app already drops them. What is left has to stand on its
  // own: a vindicated apprentice only blooms here if he was buried *after*
  // taking over.
  const seasons = withoutApprenticeSeasons(base.pick, career);
  if (seasons.length < MIN_BLOOM_SEASONS) return null;

  const position = base.pick.position;

  const wait = leadingWaitSeasons(seasons, position);
  if (wait.length < MIN_WAIT_SEASONS) return null;
  const waitShare = snapShareForRoleTier(wait[0], position);

  // The peak has to be a job he held, not a week he had. Only seasons that
  // classify `core_starter` count — that tier already requires he was there for
  // half the games — so a five-game cameo at 99% cannot define a career high.
  const peakSeasons = seasons.filter(
    (s) => seasonRole(s, position) === 'core_starter',
  );
  if (peakSeasons.length < MIN_SUSTAINED_PEAK_SEASONS) return null;

  const peakShare = Math.max(
    ...peakSeasons.map((s) => snapShareForRoleTier(s, position)),
  );
  const rise = peakShare - waitShare;
  if (rise <= 0) return null;

  return {
    ...base,
    value: rise,
    headline: `+${Math.round(rise * 100)}`,
    // The wait leads: the headline already prints the rise, so when a narrow
    // screen truncates this line it should lose the redundant half, and how long
    // he sat is the half that says why he is on this list at all.
    detail: `${wait.length} yr${wait.length === 1 ? '' : 's'} buried · ${pct(
      waitShare,
    )} → ${pct(peakShare)}`,
    peakShare,
    sustainedSeasons: peakSeasons.length,
  };
}

/** The longest unbroken run of full, contributing seasons. */
function ironManRow(
  base: RankedPlayerBase,
  seasons: Season[],
): RankedPlayer | null {
  const streak = longestIronManStreak(seasons, base.pick.position);
  if (streak === null) return null;
  return {
    ...base,
    value: streak.length,
    headline: String(streak.length),
    detail: `full seasons · ${seasonTag(streak.from)}–${seasonTag(streak.to)}`,
  };
}

/**
 * Whether a season carries any evidence that absence was injury rather than
 * choice: time on the official injury report, or a year that ended early.
 *
 * Without this the list ranks benchings. A quarterback who lost his job is
 * absent for every game after it, which looks identical to a torn ACL in
 * `gamesPlayed` alone — and putting him on a list meant to say "he was good, he
 * was hurt" says the opposite of what it means to.
 */
function wasHurt(season: Season): boolean {
  return (
    (season.injuryReportWeeks ?? 0) > 0 ||
    (season.seasonEndingAbsenceGames ?? 0) > 0
  );
}

/**
 * Games lost to injury by a player who started whenever he was fit to.
 *
 * The share mean is per-game, not cumulative load: the claim is "he started the
 * games he dressed for", and cumulative load already divides by a season he did
 * not get. It averages over seasons **with snaps only** — a season missed in
 * full is a played season carrying 0%, and including it would disqualify exactly
 * the players this list exists to name. The missed-games total, by contrast,
 * reads every played season, because that lost year is the loss.
 */
function snakebitRow(
  base: RankedPlayerBase,
  seasons: Season[],
): RankedPlayer | null {
  const active = seasons.filter((s) => s.gamesPlayed > 0);
  const missedGames = seasons.reduce(
    (sum, s) => sum + (wasHurt(s) ? s.teamGames - s.gamesPlayed : 0),
    0,
  );
  const careerGames = seasons.reduce((sum, s) => sum + s.gamesPlayed, 0);
  if (
    seasons.length < 2 ||
    active.length === 0 ||
    missedGames <= 0 ||
    careerGames < MIN_SNAKEBIT_GAMES
  ) {
    return null;
  }

  const activeShare =
    active.reduce(
      (sum, s) =>
        sum + normalizeSnapShareForPosition(s.snapShare, base.pick.position),
      0,
    ) / active.length;
  if (activeShare < CORE_TIER_THRESHOLD) return null;

  return {
    ...base,
    value: missedGames,
    headline: String(missedGames),
    detail: `${pct(activeShare)} when active`,
  };
}

/**
 * The four career-shape highlights across the loaded window.
 *
 * Every list reads {@link playedSeasons} directly rather than
 * `getFilteredSeasons`: these measure usage and availability, not score. Late
 * bloomers then drops apprentice seasons on its own, because a quarterback
 * learning the job is not a career he had to climb out of.
 */
export function getCareerShapeHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
): CareerShapeHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const dayOneStarters: DayOneRow[] = [];
  const lateBloomers: LateBloomerRow[] = [];
  const ironMen: RankedPlayer[] = [];
  const snakebit: RankedPlayer[] = [];

  for (const draft of draftClasses) {
    for (const pick of draft.picks) {
      const base = {
        pick,
        team: teamById.get(pick.teamId),
        draftYear: draft.year,
      };

      const seasons = activeCareerSeasons(pick);

      pushRow(dayOneStarters, dayOneStarterRow(base, seasons));
      pushRow(lateBloomers, lateBloomerRow(base, seasons));
      pushRow(ironMen, ironManRow(base, seasons));
      pushRow(snakebit, snakebitRow(base, seasons));
    }
  }

  // Rookie share first, then the whole career: dozens of picks tie at 100%, and
  // among them the better career should lead. The pick number only settles what
  // both of those leave level.
  dayOneStarters.sort(
    (a, b) =>
      b.value - a.value ||
      b.careerScore - a.careerScore ||
      b.pick.overallPick - a.pick.overallPick,
  );
  lateBloomers.sort(
    (a, b) =>
      b.value - a.value ||
      b.peakShare - a.peakShare ||
      b.sustainedSeasons - a.sustainedSeasons,
  );
  ironMen.sort((a, b) => b.value - a.value || b.draftYear - a.draftYear);
  snakebit.sort(
    (a, b) =>
      b.value - a.value ||
      activeCareerSeasons(a.pick).length - activeCareerSeasons(b.pick).length,
  );

  return {
    dayOneStarters: dayOneStarters
      .slice(0, CAREER_SHAPE_LIST_MAX)
      .map(({ careerScore: _c, ...row }) => row),
    lateBloomers: lateBloomers
      .slice(0, CAREER_SHAPE_LIST_MAX)
      .map(({ peakShare: _p, sustainedSeasons: _s, ...row }) => row),
    ironMen: ironMen.slice(0, CAREER_SHAPE_LIST_MAX),
    snakebit: snakebit.slice(0, CAREER_SHAPE_LIST_MAX),
  };
}
