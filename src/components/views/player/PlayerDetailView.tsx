import { memo, useMemo, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TeamLogo,
  PlayerAvatar,
  RoleChip,
  teamColor,
  teamFg,
  roleDesignClass,
  roleLabel,
} from '../../design/Primitives';
import { CareerChart } from '../../design/CareerChart';
import { ScoreBreakdown } from './ScoreBreakdown';
import { TEAMS } from '../../../data/teams';
import {
  getFilteredSeasons,
  getPlayerRole,
  getPlayerDraftScore,
} from '../../../lib/getPlayerRole';
import { firstScoredYear } from '../../../lib/apprenticeship';
import { getPlayerDraftSkill } from '../../../lib/draftSlotBaseline';
import { formatOverSlot } from '../../../lib/formatOverSlot';
import { getSeasonScore } from '../../../lib/getSeasonScore';
import { scoredWindowYears } from '../../../lib/rookieWindow';
import { isPlayedSeason, isUnplayedSeason } from '../../../lib/seasonPlayed';
import { classifyRole, CORE_TIER_THRESHOLD } from '../../../lib/classifyRole';
import { snapShareForRoleTier } from '../../../lib/snapShareForTier';
import { activateOnKey } from '../../../lib/activateOnKey';
import {
  getPositionBaseline,
  isBaselineExemptPosition,
} from '../../../lib/positionBaseline';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import {
  getCurrentTeamIndicator,
  isFreeAgentSeason,
  splitTrailingFaRun,
} from '../../../lib/playerJourney';
import { getPfrUrl } from '../../../lib/playerDisplay';
import {
  getPositionCohort,
  type CohortMember,
} from '../../../lib/getPositionCohort';
import type { DraftClass, DraftPick, Role, Season } from '../../../types';

export interface PlayerDetailViewProps {
  pick: DraftPick;
  draftYear: number;
  draftClasses: DraftClass[];
  draftingTeamOnly: boolean;
}

function PlayerDetailViewImpl({
  pick,
  draftYear,
  draftClasses,
  draftingTeamOnly,
}: PlayerDetailViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const origin = searchParams.get('ref');
  const team = TEAMS.find((t) => t.id === pick.teamId);
  const color = teamColor(pick.teamId);
  const fg = teamFg(color);
  const role = getPlayerRole(pick, { draftingTeamOnly });
  const overallScore = Math.round(
    getPlayerDraftScore(pick, { draftingTeamOnly }),
  );
  const overSlot = getPlayerDraftSkill(pick, { draftingTeamOnly });
  const currentTeam = getCurrentTeamIndicator(pick);
  const positionExempt = isBaselineExemptPosition(pick.position);
  const positionBaseline = getPositionBaseline(pick.position);
  const fullTimeBarPct = Math.round(positionBaseline * 100);
  const coreStarterPct = Math.round(
    positionBaseline * CORE_TIER_THRESHOLD * 100,
  );
  const roleCls = roleDesignClass(role);
  const allSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);
  // Every count, chart and score below is about football played. The upcoming
  // season is held apart so it cannot be tallied as a season anyone played.
  const sortedSeasons = allSeasons.filter(isPlayedSeason);
  const upcomingSeason = allSeasons.find(isUnplayedSeason);

  // Rookie-window years with no season row at all. Only in drafting-team mode:
  // that is the only mode whose denominator is the window, so in career mode a
  // gap row would claim a penalty the score never applied.
  const windowYears = draftingTeamOnly ? scoredWindowYears(pick) : [];
  // Read from the scorer rather than counted here, so a season the score
  // excludes — played elsewhere, or spent learning behind a veteran — is not
  // announced as counted by the note under the table.
  const countedYears = new Set(
    getFilteredSeasons(pick, draftingTeamOnly).map((s) => s.year),
  );
  const countedSeasons = countedYears.size;
  // A quarterback's bench years are uncounted for a different reason than a
  // season played elsewhere, and the row marker has to say which.
  const apprenticeYears = new Set(
    sortedSeasons
      .filter((s) => s.year < firstScoredYear(pick))
      .map((s) => s.year),
  );
  // Checked against every row, not just played ones: the upcoming season
  // already has a row of its own, and a gap row for the same year would both
  // duplicate it and contradict it.
  const gapYears = windowYears.filter(
    (y) => !allSeasons.some((s) => s.year === y),
  );
  // One ordered list so gaps sit in their chronological place rather than in a
  // block at the end.
  const careerRows = [
    ...sortedSeasons.map((s) => ({ year: s.year, season: s })),
    ...gapYears.map((year) => ({ year, season: null })),
  ].sort((a, b) => a.year - b.year);
  // A career that trails off in free agency ends in identical empty rows —
  // same team, same zeros, same role — one per year he stayed unsigned. They
  // are folded into a single range row; only uncounted ones, so career mode,
  // where each of those zeros drags the average down and appears as an addend
  // in the math panel, keeps a row for every year it charges.
  const { before: shownRows, run: faRun } = splitTrailingFaRun(
    careerRows,
    ({ season }) =>
      draftingTeamOnly &&
      season !== null &&
      season.gamesPlayed === 0 &&
      isFreeAgentSeason(season, pick),
  );
  const pfrUrl = getPfrUrl(pick.playerId, pick.playerName);

  const { members: classmateRows, rank: positionRank } = useMemo(
    () =>
      getPositionCohort(draftClasses, draftYear, pick, { draftingTeamOnly }),
    [draftClasses, draftYear, pick, draftingTeamOnly],
  );

  return (
    <section className="player-view">
      <section
        className="player-hero"
        style={
          {
            ['--team' as never]: color,
            ['--team-fg' as never]: fg,
          } as CSSProperties
        }
      >
        <div className="player-hero__eyebrow">
          Draft <span className="tnum">{draftYear}</span>
        </div>
        <div className="player-hero__grid">
          <div className="player-hero__round">
            <div className="player-hero__round-label">Round {pick.round}</div>
          </div>
          <PlayerHeroBand pick={pick} />
          <PlayerHeroIdentity
            pick={pick}
            teamName={team?.name}
            currentTeam={currentTeam}
          />
          <PlayerHeroVerdict
            overallScore={overallScore}
            overSlot={overSlot}
            overallPick={pick.overallPick}
            role={role}
            roleCls={roleCls}
          />
        </div>
        <div className="player-glossary">
          <span className="kicker player-glossary__title">Glossary</span>
          <dl className="player-glossary__list">
            <dt>Avg snap</dt>
            <dd>
              In the games he played, the share of his team's plays he was on
              the field for — offensive plays for an offensive player, defensive
              plays for a defender — averaged across those games.
            </dd>
            <dt>Load</dt>
            <dd>
              How much of a full season he played for the team that drafted him.
              Weeks spent on the injury report, and games missed after an injury
              ended his season, don't count against him — so getting hurt
              doesn't drag Load down.
            </dd>
            <dt>Role</dt>
            <dd>
              His job that season — Core Starter, Significant Contributor, and
              so on. Based on Load, not Avg snap (kickers and punters are the
              exception).
            </dd>
            <dt>Over slot</dt>
            <dd>
              His Score minus what his draft position alone predicted. Positive
              means he outplayed where he was picked (a steal); negative means
              he fell short (a reach). Early picks are expected to score high,
              so the bar is higher the earlier he went.
            </dd>
            <dt>Position bar</dt>
            <dd>
              {positionExempt ? (
                <>
                  Snap share can't describe what a {pick.position} does, so he's
                  scored on raw snaps instead of against a position bar.
                </>
              ) : (
                <>
                  Starters play different amounts at different positions, so
                  everyone is measured against a full-time starter at their own
                  — ~{fullTimeBarPct}% of team snaps at {pick.position}. That's
                  what lets Role and Score mean the same thing everywhere. A{' '}
                  {pick.position} needs ~{coreStarterPct}%+ of snaps to count as
                  a Core Starter.
                </>
              )}
            </dd>
          </dl>
        </div>
      </section>

      <section className="player-career">
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: 22 }}>Career, season by season.</h2>
            {pfrUrl && (
              <a
                href={pfrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="player-career__pfr-link"
                data-testid="player-stats-link"
              >
                Career stats on Pro Football Reference
              </a>
            )}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            <CareerCountNote
              countedSeasons={countedSeasons}
              playedSeasons={sortedSeasons.length}
              apprenticeSeasons={apprenticeYears.size}
              windowYears={windowYears.length}
            />
          </div>
        </div>
        {sortedSeasons.length === 0 ? (
          <p
            className="mono"
            style={{ color: 'var(--ink-3)', fontSize: 12, padding: '20px 0' }}
          >
            No season data yet for this pick.
          </p>
        ) : (
          <div className="player-career__scroll">
            <table>
              <colgroup>
                {/* Fits the year plus the season-ending injury marker inline */}
                <col style={{ width: 112 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 70 }} />
                <col />
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Team</th>
                  <th className="right">GP</th>
                  <th className="right">Avg snap</th>
                  <th className="right career-load">Load</th>
                  <th>Role</th>
                  <th className="right">Score</th>
                  <th className="right hide-mobile">IR wks</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map(({ year, season }) =>
                  season ? (
                    <SeasonRow
                      key={year}
                      s={season}
                      pickTeamId={pick.teamId}
                      position={pick.position}
                      color={color}
                      counts={countedYears.has(season.year)}
                      uncountedReason={
                        apprenticeYears.has(season.year)
                          ? 'apprentice'
                          : 'elsewhere'
                      }
                    />
                  ) : (
                    <WindowGapRow key={year} year={year} />
                  ),
                )}
                {faRun.length > 0 && (
                  <FreeAgentRunRow
                    fromYear={faRun[0].year}
                    toYear={faRun[faRun.length - 1].year}
                  />
                )}
                {upcomingSeason && (
                  <UpcomingSeasonRow
                    s={upcomingSeason}
                    pickTeamId={pick.teamId}
                  />
                )}
              </tbody>
            </table>
          </div>
        )}
        {sortedSeasons.length > 0 && (
          <ScoreBreakdown pick={pick} draftingTeamOnly={draftingTeamOnly} />
        )}
      </section>

      <div className="player-charts">
        <section className="hero-chart">
          <div className="hero-chart__head">
            <div className="kicker">Snap share & load · by season</div>
          </div>
          <CareerChart
            seasons={sortedSeasons}
            color={color}
            position={pick.position}
          />
        </section>
        <section className="hero-chart">
          <div className="hero-chart__head">
            <div className="kicker">
              {pick.position} · {draftYear} class · ranked by load
            </div>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-3)' }}
            >
              #{positionRank || '—'} of {classmateRows.length}
            </span>
          </div>
          <div style={{ marginTop: 14 }}>
            {classmateRows.map((c, i) => (
              <ClassmateRow
                key={c.pick.playerId}
                member={c}
                index={i}
                isLast={i === classmateRows.length - 1}
                isSelf={c.pick.playerId === pick.playerId}
                onSelect={() =>
                  navigate(buildPlayerHref(c.pick.playerId, origin))
                }
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function PlayerHeroBand({ pick }: { pick: DraftPick }) {
  return (
    <div className="player-hero__band">
      <div className="player-hero__band-logo">
        <TeamLogo teamId={pick.teamId} size={56} ring={false} />
      </div>
      <div className="player-hero__band-headshot">
        <PlayerAvatar
          teamId={pick.teamId}
          name={pick.playerName}
          src={pick.headshotUrl}
          size={104}
        />
      </div>
    </div>
  );
}

function PlayerHeroIdentity({
  pick,
  teamName,
  currentTeam,
}: {
  pick: DraftPick;
  teamName?: string;
  currentTeam?: string | null;
}) {
  return (
    <div className="player-hero__name-col">
      <h1 className="player-hero__name">{pick.playerName}</h1>
      <div className="player-hero__meta">
        <span className="pos-chip">{pick.position}</span>
        <span>·</span>
        <span>Pick {pick.overallPick} overall</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {teamName} · drafted by {pick.teamId}
        </span>
        {currentTeam && <PlayerHeroCurrentTeam currentTeam={currentTeam} />}
      </div>
    </div>
  );
}

function PlayerHeroCurrentTeam({ currentTeam }: { currentTeam: string }) {
  if (currentTeam === 'FA') {
    return <span className="player-hero__now">now a free agent</span>;
  }
  return (
    <span className="player-hero__now">
      now with
      <TeamLogo teamId={currentTeam} size={16} ring={false} />
      <span className="mono" style={{ fontWeight: 700 }}>
        {currentTeam}
      </span>
    </span>
  );
}

/** Plain-language read on how far a pick's score sits from its slot expectation. */
function overSlotVerdict(overSlot: number): string {
  if (overSlot >= 10) return 'well above his draft slot';
  if (overSlot > 3) return 'above his draft slot';
  if (overSlot >= -3) return 'right at his draft slot';
  if (overSlot > -10) return 'below his draft slot';
  return 'well below his draft slot';
}

function PlayerHeroVerdict({
  overallScore,
  overSlot,
  overallPick,
  role,
  roleCls,
}: {
  overallScore: number;
  overSlot: number;
  overallPick: number;
  role: Role;
  roleCls: string;
}) {
  return (
    <div className="player-hero__role-col">
      <div className="player-hero__score">
        <span className="player-hero__score-label kicker">Score</span>
        <span
          className="player-hero__score-value tnum"
          data-testid="player-overall-score"
        >
          {overallScore}
        </span>
      </div>
      <div
        className={`player-hero__role-badge player-hero__role-badge--${roleCls}`}
      >
        {roleLabel(role)}
      </div>
      <div className="player-hero__overslot">
        <span className="player-hero__overslot-label kicker">Over slot</span>
        <span
          className="player-hero__overslot-value tnum"
          data-testid="player-over-slot"
          style={{
            color: overSlot >= 0 ? 'var(--positive)' : 'var(--negative)',
          }}
        >
          {formatOverSlot(overSlot)}
        </span>
        <span className="player-hero__overslot-note">
          {overSlotVerdict(overSlot)} (pick {overallPick})
        </span>
      </div>
    </div>
  );
}

/**
 * The line beside "Career, season by season" that spells out both halves of the
 * division.
 *
 * It earns its place because more than half of all picks show at least one
 * season that does not count: without it a reader adds up the visible Score
 * column, gets a different number from the headline, and concludes the page is
 * broken.
 */
function CareerCountNote({
  countedSeasons,
  playedSeasons,
  apprenticeSeasons,
  windowYears,
}: {
  countedSeasons: number;
  playedSeasons: number;
  apprenticeSeasons: number;
  windowYears: number;
}) {
  const s = (n: number) => (n === 1 ? '' : 's');
  if (windowYears === 0) {
    return (
      <>
        {playedSeasons} season{s(playedSeasons)}
      </>
    );
  }

  return (
    <span data-testid="rookie-window-note">
      {countedSeasons} of {playedSeasons} season{s(playedSeasons)} counted ·
      divided by
      {apprenticeSeasons > 0 ? (
        // Not "a 3-season rookie window". An apprenticeship shortens the window
        // — Love's is 2 — and the divisor is 3 only because his seasons floor
        // it, so naming a window here would state a contract term that does not
        // exist. Say what the divisor is, and why the rows above outnumber it.
        <>
          {' the '}
          {windowYears} season{s(windowYears)} since he won the job · first{' '}
          {apprenticeSeasons} spent learning behind a veteran
        </>
      ) : (
        <>
          {windowYears === 8 || windowYears === 11 ? ' an ' : ' a '}
          {windowYears}-season rookie window
        </>
      )}
      {countedSeasons < playedSeasons - apprenticeSeasons && (
        // The ✕ in the Score column carries the same meaning, but it only
        // explains itself through a title tooltip — which needs a second of
        // motionless hover on a 7px target, and so is not where a key belongs.
        // Say it in the open.
        <>
          {' · '}
          <span className="season-uncounted-key" aria-hidden="true">
            ✕
          </span>{' '}
          played elsewhere, not counted
        </>
      )}
    </span>
  );
}

/** What the ✕ on an uncounted season says it means. */
function uncountedNote(reason: 'elsewhere' | 'apprentice'): string {
  return reason === 'apprentice'
    ? 'this season was spent learning behind a veteran, before the rookie window opens'
    : 'this season was played for another team';
}

function SeasonRow({
  s,
  pickTeamId,
  position,
  color,
  counts = true,
  uncountedReason = 'elsewhere',
}: {
  s: Season;
  pickTeamId: string;
  position: string;
  color: string;
  /**
   * Whether this season feeds the pick's score. False for seasons played
   * elsewhere while the drafting-team view is active — the row stays, because
   * where a player went is worth seeing, but its Score must not read as part
   * of the total above it.
   */
  counts?: boolean;
  /** Why it does not count, which decides what the ✕ says. */
  uncountedReason?: 'elsewhere' | 'apprentice';
}) {
  const team = s.retained ? pickTeamId : (s.currentTeam ?? 'FA');
  const seasonRole = classifyRole(
    snapShareForRoleTier(s, position),
    s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0,
    s.gamesPlayed,
    position,
  );
  const snapPct = s.snapShare * 100;
  const loadPct = (s.cumulativeSnapShare ?? s.snapShare) * 100;

  return (
    <tr
      className={counts ? undefined : 'season-row--uncounted'}
      data-testid={counts ? undefined : `season-uncounted-${s.year}`}
    >
      <td>
        <span className="player-career__year">{s.year}</span>
        <SeasonEndingInjuryMarker season={s} />
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {team !== 'FA' ? (
            <TeamLogo teamId={team} size={22} ring={false} />
          ) : null}
          <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
            {team}
          </span>
        </div>
      </td>
      <td className="right mono tnum">{s.gamesPlayed}</td>
      <td className="right">
        <SnapBar value={snapPct} color={color} />
      </td>
      <td className="right career-load">
        <SnapBar value={loadPct} muted />
      </td>
      <td className="player-career__role-cell">
        <RoleChip role={seasonRole} />
        {uncountedReason === 'apprentice' && !counts && (
          // The chip stays factually true — he really was a non-contributor on
          // the field — but Role is the column readers scan, and leaving that
          // verdict unqualified beside a headline of 95 is the contradiction
          // this feature exists to resolve. The ✕ says the same thing, only
          // through a hover tooltip, which is not where a key belongs.
          <span className="role-chip learning">learning</span>
        )}
      </td>
      <td className="right mono tnum player-career__score">
        {Math.round(getSeasonScore(s, position))}
        {!counts && (
          <abbr
            className="season-uncounted-mark"
            aria-label={`Not counted — ${uncountedNote(uncountedReason)}`}
            title={`Not counted — ${uncountedNote(uncountedReason)}`}
          >
            ✕
          </abbr>
        )}
      </td>
      <td className="right mono tnum hide-mobile">
        {s.injuryReportWeeks ?? 0}
      </td>
    </tr>
  );
}

/**
 * A rookie-window year the drafting team got nothing from.
 *
 * The score divides by the rookie-contract window, not by seasons played, so
 * these years are in the denominator with a zero on top. They carry no season
 * row of their own — the player was released, or out of the league — and
 * without them the table shows (say) one season of 98 above a headline of 20,
 * which reads as a bug rather than as the point being made.
 */
/**
 * Where the pick stands for a season that has not kicked off.
 *
 * Rendered from a roster snapshot, so it has a team and nothing else. It shows
 * no GP, snap, role or score — not even zeros, which here would mean "played
 * and did nothing" rather than "has not played". It sits outside the season
 * count and outside the score for the same reason.
 */
function UpcomingSeasonRow({
  s,
  pickTeamId,
}: {
  s: Season;
  pickTeamId: string;
}) {
  const team = s.retained ? pickTeamId : (s.currentTeam ?? 'FA');
  return (
    <tr
      className="season-row season-row--upcoming"
      data-testid={`season-upcoming-${s.year}`}
    >
      {/* Same year treatment as a played row: this is a real point on the
          career timeline, and shrinking it the way a gap row does would break
          the column's scan down the left edge. */}
      <td>
        <span className="player-career__year">{s.year}</span>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {team !== 'FA' ? (
            <TeamLogo teamId={team} size={22} ring={false} />
          ) : null}
          <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
            {team}
          </span>
        </div>
      </td>
      {/* Split like WindowGapRow so the Load column stays hideable on mobile. */}
      <td className="mono" colSpan={2}>
        Not played yet
      </td>
      <td className="career-load" />
      <td />
      <td className="right mono tnum">—</td>
      <td className="right mono tnum hide-mobile">—</td>
    </tr>
  );
}

/**
 * The years a career trailed off in, as one row.
 *
 * Stands for two or more consecutive seasons the player finished unsigned. Each
 * would otherwise render as its own row of the same nothing — FA, 0 games, 0%,
 * Non-Contributor — and repeating that three times says no more than saying it
 * once, while burying the seasons he did play under a wall of zeros.
 */
function FreeAgentRunRow({
  fromYear,
  toYear,
}: {
  fromYear: number;
  toYear: number;
}) {
  return (
    <tr
      className="season-row season-row--gap season-row--uncounted"
      data-testid={`fa-run-${fromYear}-${toYear}`}
    >
      <td>
        {/* En dash, not a hyphen: this is a span of years, not a compound. */}
        <span className="player-career__year player-career__year--range">
          {fromYear}–{toYear}
        </span>
      </td>
      <td>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
          FA
        </span>
      </td>
      {/* Split like WindowGapRow so the Load column stays hideable on mobile. */}
      <td className="mono" colSpan={2}>
        Not on a roster
      </td>
      <td className="career-load" />
      <td />
      <td className="right mono tnum player-career__score">
        0
        <abbr
          className="season-uncounted-mark"
          aria-label="Not counted — no season with the drafting team"
          title="Not counted — the player was not on the drafting team's roster"
        >
          ✕
        </abbr>
      </td>
      <td className="right mono tnum hide-mobile">—</td>
    </tr>
  );
}

function WindowGapRow({ year }: { year: number }) {
  return (
    <tr
      className="season-row season-row--gap"
      data-testid={`window-gap-${year}`}
    >
      <td className="mono tnum">{year}</td>
      {/* Spans Team → Avg snap only. Load gets its own cell so it can be hidden
          on mobile with the rest of that column — a colSpan cannot be shrunk by
          CSS, and an over-wide span here would push this row's Score out of
          line with every other row's. No vertical borders, so the split is
          invisible. */}
      <td className="mono" colSpan={3}>
        Not with the team
      </td>
      <td className="career-load" />
      <td />
      <td className="right mono tnum">0</td>
      <td className="right mono tnum hide-mobile">—</td>
    </tr>
  );
}

/**
 * Flags a season an injury cut short. Players placed on IR drop off the weekly
 * injury report, so these are exactly the seasons where "IR wks" reads 0 while
 * Load has been forgiven — without the marker that pairing looks like a bug.
 */
function SeasonEndingInjuryMarker({ season }: { season: Season }) {
  const missed = season.seasonEndingAbsenceGames ?? 0;
  if (missed <= 0) return null;
  return (
    <abbr
      className="season-ending-injury"
      data-testid={`season-ending-injury-${season.year}`}
      aria-label="Season ended by injury"
      title={`Season ended by injury — missed the final ${missed} ${missed === 1 ? 'game' : 'games'}`}
    >
      IR
    </abbr>
  );
}

function SnapBar({
  value,
  color,
  muted,
}: {
  value: number;
  color?: string;
  muted?: boolean;
}) {
  return (
    <div className="snap-bar">
      <div className="snap-bar__track">
        <div
          className={`snap-bar__fill${muted ? ' snap-bar__fill--muted' : ''}`}
          style={{
            width: `${Math.min(100, value)}%`,
            background: muted ? undefined : color,
          }}
        />
      </div>
      <span className="snap-bar__val">{value.toFixed(1)}%</span>
    </div>
  );
}

function ClassmateRow({
  member,
  index,
  isLast,
  isSelf,
  onSelect,
}: {
  member: CohortMember;
  index: number;
  isLast: boolean;
  isSelf: boolean;
  onSelect: () => void;
}) {
  const { pick, load, role } = member;
  return (
    <div
      className={`classmate-row${isSelf ? ' classmate-row--self' : ''}`}
      style={{
        borderBottom: isLast ? 0 : '1px solid var(--rule-2)',
        cursor: isSelf ? 'default' : 'pointer',
      }}
      {...(isSelf
        ? {}
        : {
            role: 'button',
            tabIndex: 0,
            'aria-label': `View ${pick.playerName}`,
            onClick: onSelect,
            onKeyDown: activateOnKey(onSelect),
          })}
    >
      <span
        className="mono tnum"
        style={{
          fontSize: 11,
          color: isSelf ? 'var(--ox)' : 'var(--ink-4)',
          fontWeight: isSelf ? 700 : 400,
        }}
      >
        {index + 1}.
      </span>
      <TeamLogo teamId={pick.teamId} size={22} ring={false} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--f-serif)',
            fontSize: 14,
            fontWeight: isSelf ? 700 : 500,
            color: isSelf ? 'var(--ox)' : 'var(--ink)',
          }}
        >
          {pick.playerName}
          {isSelf && (
            <span
              style={{
                marginLeft: 6,
                color: 'var(--ink-3)',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 11,
              }}
            >
              this player
            </span>
          )}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          {pick.teamId} · pick {pick.overallPick}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--rule-2)' }}>
          <div
            style={{
              width: `${Math.min(100, load * 100)}%`,
              height: '100%',
              background: isSelf ? 'var(--ox)' : 'var(--ink-2)',
            }}
          />
        </div>
        <span
          className="mono tnum"
          style={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}
        >
          {(load * 100).toFixed(0)}
        </span>
      </div>
      <RoleChip role={role} />
    </div>
  );
}

/**
 * Memoized: `AppContent` re-renders on state this tree does not read (theme,
 * the info modal, route bookkeeping). Every prop it receives is referentially
 * stable by construction — derived values are memoized and handlers are
 * wrapped in `useCallback` in App.tsx — so the comparison actually bails out.
 */
export const PlayerDetailView = memo(PlayerDetailViewImpl);
