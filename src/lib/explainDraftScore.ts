import type { DraftPick, Season } from '../types';
import { apprenticeSeasonCount } from './apprenticeship';
import {
  getSeasonScore,
  SNAP_WEIGHT,
  AVAILABILITY_WEIGHT,
} from './getSeasonScore';
import { getPlayerDraftScore, getFilteredSeasons } from './getPlayerRole';
import { expectedScoreForPick } from './draftSlotBaseline';
import {
  rawSnapShareForRoleTier,
  snapShareForRoleTier,
} from './snapShareForTier';
import {
  getPositionBaseline,
  isBaselineExemptPosition,
} from './positionBaseline';
import {
  rookieWindow,
  scoredSeasonCount,
  scoredWindowYears,
} from './rookieWindow';
import { playedSeasons } from './seasonPlayed';

/**
 * How many games an injury excused from a season's Load denominator.
 *
 * Present only when the season carries an injury signal *and* that signal
 * excuses at least one game — a block claiming "0 games excused" would invite
 * the reader to look for an adjustment that never happened.
 */
export interface InjuryAdjustmentExplanation {
  /**
   * Weeks he appeared on the weekly injury report. A *displayed* stat only:
   * being listed does not mean sitting out, so this counts report presence
   * rather than games lost and no longer sizes the forgiveness.
   */
  injuryReportWeeks: number;
  /**
   * Games between his last snap and the end of the season — the pre-2016
   * snap-shape heuristic, and on those seasons the figure that *does* size the
   * forgiveness, because there is no reserve feed to intersect.
   */
  seasonEndingAbsenceGames: number;
  /**
   * Weeks he spent on a reserve list. Like `injuryReportWeeks`, a displayed
   * stat: it is a week count, not a count of games lost.
   */
  reserveWeeks: number;
  /**
   * Games the Load denominator actually forgave — `Season.excusedGames` (the
   * weeks he missed that were documented as injured), or the season-ending
   * heuristic on pre-2016 seasons, whichever the denominator used.
   */
  excusedGames: number;
  /**
   * Which figure sized `excusedGames`, and so which one the note may name:
   * `'documented-weeks'` for the missed ∩ documented intersection, or
   * `'season-ending-absence'` for the pre-2016 snap-shape heuristic.
   */
  basis: 'documented-weeks' | 'season-ending-absence';
  /** Team games Load is measured against: `teamGames - excusedGames`. */
  loadDenominatorGames: number;
}

/** One season's score broken into the terms that produced it. */
export interface SeasonScoreExplanation {
  year: number;
  /** Whether this season feeds the numerator (always true in career mode). */
  counted: boolean;
  /** Team the player was with, when it is not the drafting team. */
  currentTeam?: string;
  /** Tier share before position adjustment (0–1). */
  rawShare: number;
  /** Full-time-starter share at this position; 1 when exempt. */
  positionBaseline: number;
  /** True for K/P/LS, whose snap share is not comparable to a scrimmage bar. */
  baselineExempt: boolean;
  /** `rawShare / positionBaseline`, clamped to a full-time workload. */
  normalizedShare: number;
  /** Points contributed by workload: `normalizedShare × SNAP_WEIGHT × 100`. */
  snapPoints: number;
  gamesPlayed: number;
  teamGames: number;
  /** Points contributed by availability, on the same 0–100 scale. */
  availabilityPoints: number;
  /** The season score, straight from {@link getSeasonScore}. */
  score: number;
  injury?: InjuryAdjustmentExplanation;
  /**
   * True when the team rested through its clinched finale, which is why
   * `teamGames` reads one short of the schedule the franchise actually played.
   */
  restedFinale: boolean;
}

/** A rookie-window year the pick has no season row for: scored as zero. */
export interface GapYearExplanation {
  year: number;
}

export type ScoreExplanationRow =
  | ({ kind: 'season' } & SeasonScoreExplanation)
  | ({ kind: 'gap' } & GapYearExplanation)
  /**
   * A season spent learning behind a veteran, before the window opens. Its own
   * kind rather than a `counted: false` season, because the two say different
   * things: an uncounted season is one the drafting team did not get, an
   * apprentice season is one it got and chose not to use.
   */
  | ({ kind: 'apprentice' } & SeasonScoreExplanation);

export interface DraftScoreExplanation {
  /** Season and gap rows in chronological order. */
  rows: ScoreExplanationRow[];
  /** Sum of the counted season scores. */
  total: number;
  /** What `total` is divided by. */
  denominator: number;
  /** True when the denominator is the rookie window rather than seasons played. */
  usesRookieWindow: boolean;
  /**
   * Seasons spent on the bench before the window opened; 0 for almost every
   * pick. Lets the panel explain why its first row is not the draft year.
   */
  apprenticeSeasons: number;
  /** The pick's full window length; absent in career mode, which has none. */
  windowLength?: number;
  /** `total / denominator` — the headline score. */
  score: number;
  overallPick: number;
  /** What the draft slot alone predicted. */
  expectedAtSlot: number;
  /** `score - expectedAtSlot`. */
  overSlot: number;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Games an injury excused from this season's Load denominator, read from the
 * season rather than re-derived, so the panel cannot print a figure the score
 * disagrees with.
 *
 * `Season.excusedGames` is the authoritative count: the weeks he missed that
 * were documented by the injury report or the reserve list. Re-deriving it here
 * from `injuryReportWeeks` and `reserveWeeks` is not possible — those are week
 * counts, and a player is routinely listed in a week he plays — which is why
 * the data script stores the intersection instead.
 *
 * Pre-2016 seasons have no reserve feed to intersect, so they carry
 * `seasonEndingAbsenceGames` instead and the denominator `max()`es it in; this
 * mirrors that, and records which of the two it took in `basis`.
 */
function explainInjury(
  s: Season,
  position: string,
): InjuryAdjustmentExplanation | undefined {
  const injuryReportWeeks = s.injuryReportWeeks ?? 0;
  const seasonEndingAbsenceGames = s.seasonEndingAbsenceGames ?? 0;
  const reserveWeeks = s.reserveWeeks ?? 0;
  const documentedExcusedGames = s.excusedGames ?? 0;
  if (
    injuryReportWeeks === 0 &&
    seasonEndingAbsenceGames === 0 &&
    reserveWeeks === 0 &&
    documentedExcusedGames === 0
  )
    return undefined;
  // A season with no snaps has a Load of zero whatever the denominator, so
  // there is no forgiveness to describe. Reporting "1 week excused" against a
  // player who missed all nineteen games advertises an adjustment that did
  // nothing, which reads as the score having been softened when it was not.
  //
  // Snaps, not games, is the test: a rookie who dressed for one game and never
  // took a snap still prints Load 0.0%, so the note would sit beside a figure
  // the excusal demonstrably did not move.
  if (s.gamesPlayed === 0 || rawSnapShareForRoleTier(s, position) === 0)
    return undefined;

  // The same expression the denominator applies: the documented intersection
  // and the pre-2016 heuristic are both counts of games missed, so the larger
  // wins, and the cap only ever binds on the heuristic — the intersection is a
  // subset of the missed weeks by construction.
  const missedGames = Math.max(0, s.teamGames - s.gamesPlayed);
  const excusedGames = Math.min(
    Math.max(documentedExcusedGames, seasonEndingAbsenceGames),
    missedGames,
  );
  if (excusedGames === 0) return undefined;

  return {
    injuryReportWeeks,
    seasonEndingAbsenceGames,
    reserveWeeks,
    excusedGames,
    basis:
      seasonEndingAbsenceGames > documentedExcusedGames
        ? 'season-ending-absence'
        : 'documented-weeks',
    loadDenominatorGames: s.teamGames - excusedGames,
  };
}

function explainSeason(
  s: Season,
  position: string,
  counted: boolean,
): SeasonScoreExplanation {
  const normalizedShare = clamp01(snapShareForRoleTier(s, position));
  const availability =
    s.teamGames > 0 ? clamp01(s.gamesPlayed / s.teamGames) : 0;

  return {
    year: s.year,
    counted,
    currentTeam: s.currentTeam,
    rawShare: rawSnapShareForRoleTier(s, position),
    positionBaseline: getPositionBaseline(position),
    baselineExempt: isBaselineExemptPosition(position),
    normalizedShare,
    snapPoints: normalizedShare * SNAP_WEIGHT * 100,
    gamesPlayed: s.gamesPlayed,
    teamGames: s.teamGames,
    availabilityPoints: availability * AVAILABILITY_WEIGHT * 100,
    // Taken from the scorer rather than recomposed from the terms above, so the
    // number shown here is the number the rest of the app used.
    score: getSeasonScore(s, position),
    injury: explainInjury(s, position),
    restedFinale: s.restGame != null,
  };
}

/**
 * The arithmetic behind a pick's draft score, term by term, for the "show the
 * math" panel on the player page.
 *
 * Every figure is read from the functions that compute the real score rather
 * than re-derived, so the panel cannot disagree with the headline it sits
 * under. `explainDraftScore.test.ts` pins that as an invariant.
 *
 * Returns `null` when there is nothing to explain — no played seasons, or none
 * with the drafting team in drafting-team mode.
 */
export function explainDraftScore(
  pick: DraftPick,
  draftingTeamOnly: boolean,
): DraftScoreExplanation | null {
  const played = playedSeasons(pick);
  const counted = getFilteredSeasons(pick, draftingTeamOnly);
  if (counted.length === 0) return null;

  const countedYears = new Set(counted.map((s) => s.year));
  const windowYears = draftingTeamOnly ? scoredWindowYears(pick) : [];
  const inWindow = new Set(windowYears);
  const apprenticeSeasons = apprenticeSeasonCount(pick);
  const isApprentice = (year: number) =>
    year < pick.draftYear + apprenticeSeasons;

  const seasonRows: ScoreExplanationRow[] = played
    // A season the drafting team did not get, played after the window closed,
    // is not part of this division in either half — it adds nothing to the
    // numerator and nothing to the denominator. Listing it anyway leaves seven
    // rows above a divisor of four, which reads as the arithmetic being wrong.
    // Uncounted seasons *inside* the window stay: they are precisely why the
    // denominator exceeds the number of seasons that scored.
    //
    // Apprentice seasons stay too, though they are in neither half. They sit
    // *before* the window rather than after it, so dropping them would open the
    // panel three years after the draft with nothing to say why.
    .filter(
      (s) =>
        countedYears.has(s.year) ||
        isApprentice(s.year) ||
        !draftingTeamOnly ||
        inWindow.has(s.year),
    )
    .map((s) =>
      isApprentice(s.year)
        ? {
            kind: 'apprentice' as const,
            ...explainSeason(s, pick.position, false),
          }
        : {
            kind: 'season' as const,
            ...explainSeason(s, pick.position, countedYears.has(s.year)),
          },
    );

  // Gap rows exist to make the denominator visible: a pick divided by five
  // seasons but showing three rows reads as broken arithmetic. Only in
  // drafting-team mode, the only mode whose denominator is the window — in
  // career mode a gap row would claim a penalty the score never applied.
  const gapRows: ScoreExplanationRow[] = windowYears
    .filter((y) => !pick.seasons.some((s) => s.year === y))
    .map((year) => ({ kind: 'gap' as const, year }));

  const rows = [...seasonRows, ...gapRows].sort((a, b) => a.year - b.year);
  const total = rows.reduce(
    (acc, r) => (r.kind === 'season' && r.counted ? acc + r.score : acc),
    0,
  );
  const score = getPlayerDraftScore(pick, { draftingTeamOnly });
  const expectedAtSlot = expectedScoreForPick(pick.overallPick);

  return {
    rows,
    total,
    // The same choice `computePlayerDraftScore` makes: the rookie window when
    // measuring a drafting team, plain seasons played in career mode, whose
    // numerator spans clubs the drafting team never had a claim on.
    denominator: draftingTeamOnly
      ? scoredSeasonCount(pick, counted.length)
      : counted.length,
    usesRookieWindow: draftingTeamOnly,
    apprenticeSeasons,
    // The window the pick is actually measured against, shortened by any bench
    // years — the same length `scoredSeasonCount` uses, so the panel's stated
    // window and its divisor cannot disagree.
    windowLength: draftingTeamOnly
      ? Math.max(0, rookieWindow(pick.round) - apprenticeSeasons)
      : undefined,
    score,
    overallPick: pick.overallPick,
    expectedAtSlot,
    overSlot: score - expectedAtSlot,
  };
}
