import { memo } from 'react';
import { Link } from 'react-router-dom';
import { TEAMS } from '../../../data/teams';
import {
  TeamLogo,
  Sparkline,
  Delta,
  teamColor,
  teamFg,
} from '../../design/Primitives';
import { buildTeamHref } from '../../../lib/teamHref';
import {
  formatOverSlot,
  isOverSlotPositive,
} from '../../../lib/formatOverSlot';
import { useIsMobile } from '../../../lib/useMediaQuery';
import { teamNickname } from '../../../lib/teamNickname';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type {
  LeagueContext,
  LeagueRoleDistribution,
} from '../../../lib/getLeagueContext';

export interface TeamRankingsViewProps {
  rankings: TeamRanking[];
  yearCount: number;
  startYear: number;
  endYear: number;
  /** League-wide baseline strip; absent until the figures have been computed. */
  leagueContext?: LeagueContext;
  /**
   * True while the league figures are still being computed. Keeps the band
   * mounted in its em-dash state instead of popping in with the numbers, which
   * matters on the placeholder-rankings path where `RankingsBoot` never runs.
   */
  loading?: boolean;
  onTeamSelect: (teamId: string) => void;
  onBack?: () => void;
  /** Opens the methodology sheet, where the score's limits are spelled out. */
  onShowInfo?: () => void;
}

/** Two-digit season suffix, e.g. 2021 → "'21". */
function seasonTag(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}

interface ExtendedRanking extends TeamRanking {
  /** Mean pick score above draft-slot expectation; signed. */
  overSlot?: number;
  picks?: number;
  coreRate?: number;
  retentionRate?: number;
  trend?: number[];
  change?: number;
}

/** Teams the mobile hero lifts out of the list and onto the podium. */
const PODIUM_SIZE = 3;

function TeamRankingsViewImpl({
  rankings,
  yearCount,
  startYear,
  endYear,
  leagueContext,
  loading = false,
  onTeamSelect,
  onShowInfo,
}: TeamRankingsViewProps) {
  const isMobile = useIsMobile();
  const top = rankings[0] as ExtendedRanking | undefined;
  const bottom = rankings[rankings.length - 1] as ExtendedRanking | undefined;
  const total = rankings.length;
  const yearWindow = { from: startYear, to: endYear };

  // The podium *is* the top three on mobile, so the table picks up at #4 —
  // unless there aren't three teams to stand on it, in which case the list
  // keeps all of them rather than showing a stump.
  const hasPodium = isMobile && total >= PODIUM_SIZE;
  const tableRankings = hasPodium ? rankings.slice(PODIUM_SIZE) : rankings;

  return (
    <section className="rankings-view" aria-label="Team draft rankings">
      {isMobile ? (
        <MobileRankingsHero
          yearCount={yearCount}
          yearWindow={yearWindow}
          podium={
            hasPodium
              ? (rankings.slice(0, PODIUM_SIZE) as ExtendedRanking[])
              : undefined
          }
          leagueContext={leagueContext}
        />
      ) : (
        <RankingsHero
          yearCount={yearCount}
          top={top}
          bottom={bottom}
          total={total}
          yearWindow={yearWindow}
        />
      )}

      {(leagueContext || loading) && (
        <LeagueContextBand context={leagueContext} showStats={!isMobile} />
      )}

      <div className="divider-em" />

      <div className="rankings-legend">
        <span className="kicker">Glossary</span>
        <span>
          <b>Score</b> · how much a team's picks play, 0–100
        </span>
        <span>
          <b>Over slot</b> · draft value above what the pick positions predicted
        </span>
        <span>
          <b>Core %</b> · share of picks carrying a full-time starter's workload
        </span>
        <span>
          <b>Retention</b> · share still on the roster
        </span>
        <span style={{ marginLeft: 'auto' }} className="mono">
          click any team for the deep cut →
        </span>
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <RankingsTableColgroup />
          <RankingsTableHead startYear={startYear} endYear={endYear} />
          <tbody>
            {tableRankings.map((r) => (
              <RankRow
                key={r.teamId}
                r={r as ExtendedRanking}
                yearWindow={yearWindow}
                onSelect={onTeamSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rankings-foot">
        <div className="rankings-foot__text">
          Data from nflverse · Roles are set by how much of a full-time
          starter's workload a player carries at his own position — 65% for Core
          Starter, 35% for Significant Contributor, 10% for Depth. Players are
          credited to the team that drafted them.
        </div>
        {/* The table is where the ranking claim gets made, so the two things it
            can't see have to be reachable from here — not buried a menu away. */}
        <div className="rankings-foot__text" data-testid="rankings-caveat">
          Score spreads each pick across its rookie contract, so a pick traded
          or released early carries the seasons its team never got. It can't see
          what a trade brought back, and it judges recent classes more gently —
          they've had less time to fail.{' '}
          {onShowInfo && (
            <button
              type="button"
              className="rankings-foot__link"
              onClick={onShowInfo}
            >
              How the score is built
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The rankings page before any data exists: real headline and lede, em dashes
 * where the figures go.
 *
 * Rendered while the rankings load, in place of a bare spinner. The headline is
 * the page's LCP element, so putting it in React's *first* paint rather than
 * the data-driven re-render pulls LCP forward — measured at ~84ms under 4x CPU
 * / slow 4G, and considerably more when the rankings request is slow.
 */
export function RankingsBoot({ yearCount }: { yearCount: number }) {
  const isMobile = useIsMobile();
  return (
    <section className="rankings-view" aria-label="Team draft rankings">
      {isMobile ? (
        <MobileRankingsHero
          yearCount={yearCount}
          yearWindow={{ from: 0, to: 0 }}
          placeholder
        />
      ) : (
        <RankingsHero
          yearCount={yearCount}
          total={0}
          yearWindow={{ from: 0, to: 0 }}
          placeholder
        />
      )}
      <LeagueContextBand showStats={!isMobile} />
    </section>
  );
}

function RankingsHero({
  yearCount,
  top,
  bottom,
  total,
  yearWindow,
  placeholder = false,
}: {
  yearCount: number;
  top?: ExtendedRanking;
  bottom?: ExtendedRanking;
  total: number;
  yearWindow: { from: number; to: number };
  /** Boot state: figures render as em dashes because no data exists yet. */
  placeholder?: boolean;
}) {
  const seasonWord = yearCount === 1 ? 'season' : 'seasons';
  return (
    <section className="page-hero">
      <div className="page-hero__grid">
        <div>
          <div className="kicker" style={{ marginBottom: 12 }}>
            Draft success score · {yearCount} {seasonWord} in window
          </div>
          <h1 className="page-hero__headline">
            Which teams draft <em>well</em> — and which don't.
          </h1>
          <p className="page-hero__lede">
            Every team on three signals — snap share, games played, and
            retention. Not wins or box-score stats, just how much the players
            they drafted actually get on the field.
          </p>
        </div>

        <StatBlock
          label="Top of class"
          value={top?.teamId ?? '—'}
          sub={top ? `${top.score.toFixed(1)} · draft success score` : ''}
          href={top ? buildTeamHref(top.teamId, yearWindow) : undefined}
          accent
        />
        <StatBlock
          label="Coldest streak"
          value={bottom?.teamId ?? '—'}
          sub={bottom ? `${bottom.score.toFixed(1)} · draft success score` : ''}
          href={bottom ? buildTeamHref(bottom.teamId, yearWindow) : undefined}
        />
        <StatBlock
          label="Teams ranked"
          value={placeholder ? '—' : String(total)}
          sub={placeholder ? undefined : `across ${yearCount} ${seasonWord}`}
        />
      </div>
    </section>
  );
}

/**
 * The rankings hero on phone-width screens.
 *
 * Where the desktop hero explains first and ranks later, this answers the
 * question in the first screenful: a one-line premise, then the top three on a
 * podium, then the league baseline — with the ranked list picking up at #4
 * immediately below.
 */
function MobileRankingsHero({
  yearCount,
  yearWindow,
  podium,
  leagueContext,
  placeholder = false,
}: {
  yearCount: number;
  yearWindow: { from: number; to: number };
  /** The top three, or absent while they load / when there are too few teams. */
  podium?: ExtendedRanking[];
  leagueContext?: LeagueContext;
  /**
   * Boot state: draws the podium's outline at full height with em dashes, so
   * the real one replaces it in place instead of appearing and shoving the
   * league strip and the whole board down the page.
   */
  placeholder?: boolean;
}) {
  const seasonWord = yearCount === 1 ? 'season' : 'seasons';
  const windowLabel =
    yearWindow.from && yearWindow.to
      ? `${seasonTag(yearWindow.from)}–${seasonTag(yearWindow.to)}`
      : `${yearCount} ${seasonWord}`;

  return (
    <section className="page-hero page-hero--mobile">
      <div className="kicker">Draft success score · {windowLabel}</div>
      <h1 className="page-hero__headline page-hero__headline--short">
        Who drafted <em>best</em>.
      </h1>
      <p className="page-hero__lede page-hero__lede--short">
        Snap share, games played, and retention — how much of each draft class
        actually plays.
      </p>

      {placeholder ? (
        <PodiumSkeleton />
      ) : (
        <Podium entries={podium} yearWindow={yearWindow} />
      )}
      <PodiumStrip context={leagueContext} />
    </section>
  );
}

/**
 * Top three as ranked bars — 2nd, 1st, 3rd left to right, the winner tallest
 * and centred. DOM order stays 1-2-3 so the reading order is the ranking; the
 * staggered arrangement is CSS `order` on the columns.
 */
function Podium({
  entries,
  yearWindow,
}: {
  entries?: ExtendedRanking[];
  yearWindow: { from: number; to: number };
}) {
  if (!entries || entries.length < PODIUM_SIZE) return null;
  return (
    <ol className="podium" aria-label="Top three teams">
      {entries.map((entry, i) => (
        <PodiumColumn
          key={entry.teamId}
          entry={entry}
          rank={i + 1}
          yearWindow={yearWindow}
        />
      ))}
    </ol>
  );
}

/**
 * The podium before any team is known: same three columns at the same heights,
 * em dashes where the names and scores go. It reserves the exact box the real
 * podium will occupy, so the first paint and the data-driven one line up.
 *
 * Hidden from assistive tech — three dashes carry nothing a screen reader
 * needs, and the real podium announces itself the moment it arrives.
 */
function PodiumSkeleton() {
  return (
    <ol className="podium podium--placeholder" aria-hidden="true">
      {[1, 2, 3].map((rank) => (
        <li
          key={rank}
          className={`podium__col podium__col--${rank}${rank === 1 ? ' podium__col--lead' : ''}`}
        >
          <span className="podium__link">
            <span className="podium__medal">—</span>
            <span className="podium__name">—</span>
            <span className="podium__score mono tnum">—</span>
            <span className="podium__bar" />
          </span>
        </li>
      ))}
    </ol>
  );
}

function PodiumColumn({
  entry,
  rank,
  yearWindow,
}: {
  entry: ExtendedRanking;
  rank: number;
  yearWindow: { from: number; to: number };
}) {
  const team = TEAMS.find((t) => t.id === entry.teamId);
  const color = teamColor(entry.teamId);
  const lead = rank === 1;

  return (
    <li
      className={`podium__col podium__col--${rank}${lead ? ' podium__col--lead' : ''}`}
    >
      <Link
        className="podium__link"
        to={buildTeamHref(entry.teamId, yearWindow)}
      >
        <span
          className="podium__medal"
          style={{ background: color, color: teamFg(color) }}
          aria-hidden="true"
        >
          {entry.teamId.slice(0, 2)}
        </span>
        <span className="podium__name">
          {teamNickname(team?.name ?? entry.teamName)}
        </span>
        <span className="podium__score mono tnum">
          {entry.score.toFixed(1)}
        </span>
        {/* Inside the link: the bar is the largest thing in the column, so it
            has to be part of the tap target, not dead space beside it. */}
        <span
          className="podium__bar"
          style={{ background: color, color: teamFg(color) }}
          aria-hidden="true"
        >
          {rank}
        </span>
      </Link>
    </li>
  );
}

/**
 * League baseline in one thin line under the podium, plus the nudge that the
 * rest of the board is a scroll away.
 */
function PodiumStrip({ context }: { context?: LeagueContext }) {
  const hasPicks = !!context && context.roleDistribution.total > 0;
  return (
    <div className="podium-strip">
      <div>
        <div className="kicker">League avg</div>
        <div className="podium-strip__value mono tnum">
          {hasPicks ? context.avgScore.toFixed(1) : '—'}
        </div>
      </div>
      <div>
        <div className="kicker">Score spread</div>
        <div className="podium-strip__value mono tnum">
          {context?.spread ? context.spread.gap.toFixed(1) : '—'}
        </div>
      </div>
      <div className="podium-strip__hint mono">full board ↓</div>
    </div>
  );
}

function RankingsTableColgroup() {
  return (
    <colgroup>
      <col style={{ width: 56 }} />
      <col style={{ width: 38 }} />
      <col />
      <col style={{ width: 90 }} />
      <col className="col-hide-mobile" style={{ width: 82 }} />
      <col className="col-hide-md" style={{ width: 70 }} />
      <col className="col-hide-mobile" style={{ width: 190 }} />
      <col className="col-hide-mobile" style={{ width: 80 }} />
      <col className="col-hide-mobile" style={{ width: 80 }} />
    </colgroup>
  );
}

function RankingsTableHead({
  startYear,
  endYear,
}: {
  startYear: number;
  endYear: number;
}) {
  return (
    <thead>
      <tr>
        <th>Rank</th>
        <th>YoY</th>
        <th>Team</th>
        <th className="right">Score</th>
        <th className="right hide-mobile">Over slot</th>
        <th className="right hide-md">Picks</th>
        <th className="hide-mobile">
          Score · {seasonTag(startYear)} → {seasonTag(endYear)}
        </th>
        <th className="right hide-mobile">Core %</th>
        <th className="right hide-mobile">Retained</th>
      </tr>
    </thead>
  );
}

function StatBlock({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** When set, the value becomes a link to that team's page. */
  href?: string;
}) {
  const valueClass = `statblock__value${accent ? ' statblock__value--accent' : ''} tnum`;
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      {href ? (
        <Link
          to={href}
          className={`${valueClass} statblock__value--link`}
          aria-label={`${label}: view ${value}`}
        >
          {value}
        </Link>
      ) : (
        <div className={valueClass}>{value}</div>
      )}
      {sub && <div className="statblock__sub">{sub}</div>}
    </div>
  );
}

/** Rounded whole-percent for a 0–1 share. */
function pct(share: number): number {
  return Math.round(share * 100);
}

/**
 * League baseline strip: average score, best-vs-worst spread, and a 3-segment
 * bar showing where every scored pick in the window ended up.
 */
/**
 * The three role buckets, in the order the bar and legend show them. Declared
 * once so the loaded and loading states cannot drift apart.
 */
const ROLE_SPLIT = [
  {
    cls: 'core',
    label: 'Core',
    of: (rd: LeagueRoleDistribution) => rd.corePct,
  },
  {
    cls: 'contrib',
    label: 'Contributor',
    of: (rd: LeagueRoleDistribution) => rd.contributorPct,
  },
  {
    cls: 'non',
    label: 'Non-contributor',
    of: (rd: LeagueRoleDistribution) => rd.nonContributorPct,
  },
] as const;

function LeagueContextBand({
  context,
  showStats = true,
}: {
  /**
   * Absent while the league figures are still being computed, which renders the
   * band at full size with em dashes. Note that absent is not the same as
   * present-but-empty: an empty window can honestly say it has no scored picks,
   * whereas a loading one does not know that yet.
   */
  context?: LeagueContext;
  /**
   * False on mobile, where the podium strip already carries the average and
   * spread. Only the role distribution is left to show.
   */
  showStats?: boolean;
}) {
  const rd = context?.roleDistribution;
  const hasPicks = !!rd && rd.total > 0;
  const loading = !context;

  let spreadSub: string;
  if (context?.spread) {
    spreadSub = `${context.spread.topId} → ${context.spread.bottomId}`;
  } else if (loading) {
    // An em dash rather than nothing: the sub line has to occupy its space now,
    // or the stat grows a line when the team pair arrives and shoves the table
    // down — which is the shift this loading state exists to avoid.
    spreadSub = '—';
  } else {
    spreadSub = 'need 2+ teams';
  }

  let barLabel: string;
  if (hasPicks) {
    barLabel = `Role distribution: ${ROLE_SPLIT.map(
      (s) => `${pct(s.of(rd))}% ${s.label.toLowerCase()}`,
    ).join(', ')}`;
  } else if (loading) {
    barLabel = 'Role distribution loading';
  } else {
    barLabel = 'No scored picks in this window yet';
  }

  return (
    <section
      className={`league-context${showStats ? '' : ' league-context--dist-only'}`}
      aria-label="League context"
    >
      {showStats && (
        <div className="league-context__stats">
          <StatBlock
            label="League average"
            value={hasPicks ? context.avgScore.toFixed(1) : '—'}
            sub="draft success score"
          />
          <StatBlock
            label="Score spread"
            value={context?.spread ? context.spread.gap.toFixed(1) : '—'}
            sub={spreadSub}
          />
        </div>
      )}

      <div className="league-context__dist">
        <div className="league-context__bar" role="img" aria-label={barLabel}>
          {hasPicks &&
            ROLE_SPLIT.map((s) => (
              <span
                key={s.cls}
                className={`league-context__seg league-context__seg--${s.cls}`}
                style={{ width: `${s.of(rd) * 100}%` }}
              />
            ))}
        </div>
        {hasPicks || loading ? (
          <>
            <div className="league-context__legend">
              {ROLE_SPLIT.map((s) => (
                <span key={s.cls}>
                  <i
                    className={`league-context__dot league-context__dot--${s.cls}`}
                  />
                  {s.label}{' '}
                  <b className="tnum">{rd ? `${pct(s.of(rd))}%` : '—'}</b>
                </span>
              ))}
            </div>
            <div className="league-context__caption">
              Where every drafted pick in this window ended up.
            </div>
          </>
        ) : (
          <div className="league-context__caption">
            No scored picks in this window yet.
          </div>
        )}
      </div>
    </section>
  );
}

function RankRow({
  r,
  yearWindow,
  onSelect,
}: {
  r: ExtendedRanking;
  yearWindow: { from: number; to: number };
  onSelect: (teamId: string) => void;
}) {
  const team = TEAMS.find((t) => t.id === r.teamId);
  const isTop = r.rank <= 3;
  const color = teamColor(r.teamId);
  const trend = r.trend && r.trend.length > 0 ? r.trend : null;

  return (
    <tr onClick={() => onSelect(r.teamId)}>
      <td>
        <span
          className={`rank-num ${isTop ? 'rank-num--top' : 'rank-num--rest'}`}
        >
          {r.rank}
        </span>
      </td>
      <td>
        <Delta value={r.change} />
      </td>
      <td>
        <div className="team-row">
          <div
            className="team-row__bar"
            style={{ background: color, width: 5 }}
          />
          <TeamLogo teamId={r.teamId} size={30} ring={false} />
          {/* The whole row is clickable, but the name is a real link so the
              team page is keyboard-reachable and can be opened in a new tab.
              Stop propagation so the row handler doesn't navigate twice. */}
          <Link
            className="team-row__link"
            to={buildTeamHref(r.teamId, yearWindow)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="team-row__id">{r.teamId}</div>
            <div className="team-row__name">{team?.name ?? r.teamName}</div>
          </Link>
        </div>
      </td>
      <td className="right">
        <span className="score-big">{r.score.toFixed(1)}</span>
      </td>
      <td className="right hide-mobile">
        {r.overSlot != null ? (
          <span
            className="mono tnum"
            style={{
              fontWeight: 600,
              color: isOverSlotPositive(r.overSlot)
                ? 'var(--positive)'
                : 'var(--negative)',
            }}
          >
            {formatOverSlot(r.overSlot)}
          </span>
        ) : (
          <span className="mono" style={{ color: 'var(--ink-4)' }}>
            —
          </span>
        )}
      </td>
      <td className="right hide-md">
        {r.picks != null ? (
          <span className="mono tnum">{r.picks}</span>
        ) : (
          <span className="mono" style={{ color: 'var(--ink-4)' }}>
            —
          </span>
        )}
      </td>
      <td className="hide-mobile">
        {trend ? (
          <div className="trend-cell">
            <Sparkline values={trend} width={92} height={22} stroke={color} />
            <span className="trend-cell__range mono tnum">
              {Math.round(trend[0])}→{Math.round(trend[trend.length - 1])}
            </span>
          </div>
        ) : (
          <span style={{ color: 'var(--ink-4)' }}>—</span>
        )}
      </td>
      <td className="right hide-mobile">
        <span className="mono tnum" style={{ fontWeight: 600 }}>
          {r.coreRate != null ? `${(r.coreRate * 100).toFixed(0)}%` : '—'}
        </span>
      </td>
      <td className="right hide-mobile">
        <span className="mono tnum" style={{ color: 'var(--ink-2)' }}>
          {r.retentionRate != null
            ? `${(r.retentionRate * 100).toFixed(0)}%`
            : '—'}
        </span>
      </td>
    </tr>
  );
}

/**
 * Memoized: `AppContent` re-renders on state this tree does not read (theme,
 * the info modal, route bookkeeping). Every prop it receives is referentially
 * stable by construction — derived values are memoized and handlers are
 * wrapped in `useCallback` in App.tsx — so the comparison actually bails out.
 */
export const TeamRankingsView = memo(TeamRankingsViewImpl);
