import { useState } from 'react';
import { formatOverSlot } from '../../../lib/formatOverSlot';
import {
  explainDraftScore,
  type ScoreExplanationRow,
  type SeasonScoreExplanation,
} from '../../../lib/explainDraftScore';
import { splitTrailingFaRun } from '../../../lib/playerJourney';
import type { DraftPick } from '../../../types';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pts = (v: number) => v.toFixed(1);

/**
 * Every figure in this panel is rounded to one decimal *before* being added,
 * not after.
 *
 * A panel whose whole claim is "here is the arithmetic" must add up on screen.
 * Rounding each term independently off the exact values does not: 34.27 and
 * 7.06 print as 34.3 and 7.1, which a reader sums to 41.4 beside a season score
 * printed as 41.3. Being 0.1 closer to the float is worth nothing next to
 * arithmetic the reader can check, so the displayed terms are the source of
 * truth for every total built from them.
 *
 * The headline the page shows elsewhere still comes from the real score, and
 * the "→ N shown" note bridges the two if they ever disagree.
 */
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Collapsible "show the math" panel under the career table: the pick's own
 * numbers walked through the score formula, one season at a time, then the
 * division and the draft-slot subtraction.
 *
 * It sits below the table rather than beside the headline because every input
 * it names — Load, GP, the per-season Score — is a column the reader has just
 * looked at, and the walkthrough is only legible next to them.
 */
export function ScoreBreakdown({
  pick,
  draftingTeamOnly,
}: {
  pick: DraftPick;
  draftingTeamOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const explanation = explainDraftScore(pick, draftingTeamOnly);
  if (!explanation) return null;

  const { rows, denominator, usesRookieWindow, windowLength, score } =
    explanation;
  // Rebuilt from the rounded terms rather than taken from `explanation.total`,
  // so the addition shown on screen resolves. See `round1`.
  const addends = rows
    .filter((r) => r.kind !== 'season' || r.counted)
    .map((r) => (r.kind === 'season' ? displayedSeasonScore(r) : 0));
  const total = round1(addends.reduce((a, b) => a + b, 0));
  const dividedScore = round1(total / denominator);
  const headlineScore = Math.round(score);
  // Over slot must match the hero badge to the decimal — it is the number the
  // reader came here to check. So the subtraction is balanced on the slot
  // expectation instead: it is the only figure in the line that appears nowhere
  // else, and absorbing ~0.05 of rounding into a smoothed curve value costs
  // less than printing a subtraction that does not resolve.
  const shownOverSlot = round1(explanation.overSlot);
  const shownExpected = round1(dividedScore - shownOverSlot);
  // Mirrors the career table: consecutive unsigned years at the end of a career
  // are one entry, not one apiece. Only uncounted ones — a counted season is an
  // addend in the sum below, and every addend must have a row behind it.
  const { before: shownRows, run: faRun } = splitTrailingFaRun(
    rows,
    isUncountedFreeAgentRow,
  );

  return (
    <div className="score-breakdown">
      <button
        type="button"
        className="score-breakdown__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        data-testid="score-breakdown-toggle"
      >
        {expanded ? 'Hide the math' : 'Show the math'}
      </button>

      {expanded && (
        <div className="score-breakdown__body" data-testid="score-breakdown">
          <ol className="score-breakdown__seasons">
            {shownRows.map((row) => (
              <BreakdownRow key={row.year} row={row} />
            ))}
            {faRun.length > 0 && (
              <FreeAgentRunEntry
                fromYear={faRun[0].year}
                toYear={faRun[faRun.length - 1].year}
              />
            )}
          </ol>

          <div className="score-breakdown__sum">
            <span className="score-breakdown__sum-terms mono tnum">
              {addends.map(pts).join(' + ')} = {pts(total)}
            </span>
            <span className="score-breakdown__sum-divide mono">
              ÷ {denominatorLabel(denominator, usesRookieWindow, windowLength)}
            </span>
            <span className="score-breakdown__sum-result mono tnum">
              = {pts(dividedScore)}
              {headlineScore !== dividedScore && (
                <span className="score-breakdown__rounded">
                  {' '}
                  → {headlineScore} shown
                </span>
              )}
            </span>
          </div>

          <div className="score-breakdown__overslot mono tnum">
            {pts(dividedScore)} − {pts(shownExpected)} expected at pick{' '}
            {explanation.overallPick} ={' '}
            <strong>{formatOverSlot(shownOverSlot)}</strong> over slot
          </div>
        </div>
      )}
    </div>
  );
}

function denominatorLabel(
  denominator: number,
  usesRookieWindow: boolean,
  windowLength?: number,
): string {
  if (!usesRookieWindow) {
    return `${denominator} season${denominator === 1 ? '' : 's'} played`;
  }
  // A clamped denominator is the one readers query most: a pick drafted last
  // year is measured against one season, not five, and saying only "5-season
  // window" next to a division by 1 reads as an error.
  if (windowLength !== undefined && denominator < windowLength) {
    return `${denominator} season${denominator === 1 ? '' : 's'} elapsed, of a ${windowLength}-season rookie window`;
  }
  // A pick who outlasted his rookie deal is divided by his actual tenure, not
  // by the window — calling six seasons a "6-season rookie window" would state
  // a contract term that does not exist for his round.
  if (windowLength !== undefined && denominator > windowLength) {
    return `${denominator} seasons with the drafting team, past his ${windowLength}-season rookie window`;
  }
  return `${denominator}-season rookie window`;
}

/** A season's score as the panel prints it: the sum of its two rounded terms. */
function displayedSeasonScore(season: SeasonScoreExplanation): number {
  return round1(round1(season.snapPoints) + round1(season.availabilityPoints));
}

/**
 * A season the drafting team lost the player for, to nobody: he was on no NFL
 * roster that year. It scores zero for them like any other season away, but
 * "played for another team" would be a claim about a year he did not play.
 */
function isUncountedFreeAgentRow(row: ScoreExplanationRow): boolean {
  return (
    row.kind === 'season' &&
    !row.counted &&
    row.currentTeam === undefined &&
    row.gamesPlayed === 0
  );
}

/** The years a career trailed off in, as one entry. See `FreeAgentRunRow`. */
function FreeAgentRunEntry({
  fromYear,
  toYear,
}: {
  fromYear: number;
  toYear: number;
}) {
  return (
    <li
      className="score-breakdown__season score-breakdown__season--uncounted"
      data-testid={`score-breakdown-fa-run-${fromYear}-${toYear}`}
    >
      <div className="score-breakdown__season-head">
        {/* En dash, not a hyphen: this is a span of years, not a compound. */}
        <span className="score-breakdown__year mono tnum">
          {fromYear}–{toYear}
        </span>
        <span className="score-breakdown__season-score mono tnum">—</span>
      </div>
      <div className="score-breakdown__uncounted-note">
        Not on a roster — not counted toward the drafting team's score.
      </div>
    </li>
  );
}

function BreakdownRow({ row }: { row: ScoreExplanationRow }) {
  if (row.kind === 'gap') {
    return (
      <li className="score-breakdown__season score-breakdown__season--gap">
        <span className="score-breakdown__year mono tnum">{row.year}</span>
        <span className="score-breakdown__gap-note">
          no season on the roster — counts as 0
        </span>
      </li>
    );
  }
  return <SeasonBreakdown season={row} />;
}

/**
 * Where an uncounted season was spent. A free agent has no `currentTeam`, and
 * saying he "played for another team" would claim a year of football that never
 * happened — the distinction the reader needs is *why* the season scored zero.
 */
function whereHeWas(season: SeasonScoreExplanation): string {
  if (season.currentTeam) return `Played for ${season.currentTeam}`;
  return season.gamesPlayed === 0
    ? 'Not on a roster'
    : 'Played for another team';
}

function SeasonBreakdown({ season }: { season: SeasonScoreExplanation }) {
  const {
    year,
    counted,
    rawShare,
    positionBaseline,
    baselineExempt,
    normalizedShare,
    snapPoints,
    gamesPlayed,
    teamGames,
    availabilityPoints,
    injury,
  } = season;

  return (
    <li
      className={`score-breakdown__season${counted ? '' : ' score-breakdown__season--uncounted'}`}
      data-testid={`score-breakdown-season-${year}`}
    >
      <div className="score-breakdown__season-head">
        <span className="score-breakdown__year mono tnum">{year}</span>
        <span className="score-breakdown__season-score mono tnum">
          {counted ? pts(displayedSeasonScore(season)) : '—'}
        </span>
      </div>

      {counted ? (
        <div className="score-breakdown__terms">
          <div className="score-breakdown__term">
            <span className="score-breakdown__term-label">Load</span>
            <span className="score-breakdown__term-math mono tnum">
              {/* Exempt positions divide by nothing, so restating the same
                  percentage on both sides of an "=" would be noise. */}
              {baselineExempt ? (
                <>{pct(rawShare)} × 0.7</>
              ) : (
                <>
                  {pct(rawShare)} ÷ {positionBaseline.toFixed(3)} position bar ={' '}
                  {pct(normalizedShare)} × 0.7
                </>
              )}
            </span>
            <span className="score-breakdown__term-points mono tnum">
              {pts(round1(snapPoints))}
            </span>
          </div>
          <div className="score-breakdown__term">
            <span className="score-breakdown__term-label">Availability</span>
            <span className="score-breakdown__term-math mono tnum">
              {gamesPlayed} of {teamGames} games ={' '}
              {pct(teamGames > 0 ? gamesPlayed / teamGames : 0)} × 0.3
            </span>
            <span className="score-breakdown__term-points mono tnum">
              {pts(round1(availabilityPoints))}
            </span>
          </div>
          {injury && (
            <InjuryNote
              injury={injury}
              gamesPlayed={gamesPlayed}
              teamGames={teamGames}
            />
          )}
        </div>
      ) : (
        <div className="score-breakdown__uncounted-note">
          {whereHeWas(season)} — not counted toward the drafting team's score.
        </div>
      )}
    </li>
  );
}

/**
 * Why Load is not simply avg snap × games played: an injury shrinks the
 * denominator it is measured against.
 *
 * The second sentence is the one that earns this block. Readers reach it having
 * noticed a season is marked IR and scored badly anyway, and the answer is that
 * only Load is forgiven — availability is deliberately not, so a season-ending
 * injury still costs its 30% share.
 */
function InjuryNote({
  injury,
  gamesPlayed,
  teamGames,
}: {
  injury: NonNullable<SeasonScoreExplanation['injury']>;
  gamesPlayed: number;
  teamGames: number;
}) {
  const { injuryReportWeeks, seasonEndingAbsenceGames, excusedGames } = injury;
  // Name only the signal that won. Reporting both invites the reader to add
  // them, which is exactly the mistake the max() is there to prevent.
  const reportWeeks = `${injuryReportWeeks} week${injuryReportWeeks === 1 ? '' : 's'} on the injury report`;
  const signal =
    seasonEndingAbsenceGames > injuryReportWeeks
      ? `${seasonEndingAbsenceGames} games after his last snap`
      : reportWeeks;

  return (
    <p className="score-breakdown__injury" data-testid="score-breakdown-injury">
      Injury: Load measures him against{' '}
      <strong className="tnum">
        {injury.loadDenominatorGames} of {teamGames}
      </strong>{' '}
      team games — {excusedGames} excused ({signal}). Availability is not
      adjusted:{' '}
      <span className="tnum">
        {gamesPlayed} of {teamGames}
      </span>{' '}
      stands.
    </p>
  );
}
