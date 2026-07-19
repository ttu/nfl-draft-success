import { Link } from 'react-router-dom';
import { TEAMS } from '../../../data/teams';
import { TeamLogo, Sparkline, Delta, teamColor } from '../../design/Primitives';
import { buildTeamHref } from '../../../lib/teamHref';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type { LeagueContext } from '../../../lib/getLeagueContext';

export interface TeamRankingsViewProps {
  rankings: TeamRanking[];
  yearCount: number;
  startYear: number;
  endYear: number;
  /** League-wide baseline strip; omitted in the pre-load state. */
  leagueContext?: LeagueContext;
  onTeamSelect: (teamId: string) => void;
  onBack?: () => void;
}

/** Two-digit season suffix, e.g. 2021 → "'21". */
function seasonTag(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}

interface ExtendedRanking extends TeamRanking {
  picks?: number;
  coreRate?: number;
  retentionRate?: number;
  trend?: number[];
  change?: number;
}

export function TeamRankingsView({
  rankings,
  yearCount,
  startYear,
  endYear,
  leagueContext,
  onTeamSelect,
}: TeamRankingsViewProps) {
  const top = rankings[0] as ExtendedRanking | undefined;
  const bottom = rankings[rankings.length - 1] as ExtendedRanking | undefined;
  const total = rankings.length;

  return (
    <section className="rankings-view" aria-label="Team draft rankings">
      <RankingsHero
        yearCount={yearCount}
        top={top}
        bottom={bottom}
        total={total}
      />

      {leagueContext && <LeagueContextBand context={leagueContext} />}

      <div className="divider-em" />

      <div className="rankings-legend">
        <span className="kicker">Glossary</span>
        <span>
          <b>Score</b> · how much a team's picks play, 0–100
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
            {rankings.map((r) => (
              <RankRow
                key={r.teamId}
                r={r as ExtendedRanking}
                yearWindow={{ from: startYear, to: endYear }}
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
      </div>
    </section>
  );
}

function RankingsHero({
  yearCount,
  top,
  bottom,
  total,
}: {
  yearCount: number;
  top?: ExtendedRanking;
  bottom?: ExtendedRanking;
  total: number;
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
          accent
        />
        <StatBlock
          label="Coldest streak"
          value={bottom?.teamId ?? '—'}
          sub={bottom ? `${bottom.score.toFixed(1)} · draft success score` : ''}
        />
        <StatBlock
          label="Teams ranked"
          value={String(total)}
          sub={`across ${yearCount} ${seasonWord}`}
        />
      </div>
    </section>
  );
}

function RankingsTableColgroup() {
  return (
    <colgroup>
      <col style={{ width: 56 }} />
      <col style={{ width: 38 }} />
      <col />
      <col style={{ width: 90 }} />
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
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        className={`statblock__value${accent ? ' statblock__value--accent' : ''} tnum`}
      >
        {value}
      </div>
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
function LeagueContextBand({ context }: { context: LeagueContext }) {
  const { avgScore, spread, roleDistribution: rd } = context;
  const hasPicks = rd.total > 0;

  return (
    <section className="league-context" aria-label="League context">
      <div className="league-context__stats">
        <StatBlock
          label="League average"
          value={hasPicks ? avgScore.toFixed(1) : '—'}
          sub="draft success score"
        />
        <StatBlock
          label="Score spread"
          value={spread ? spread.gap.toFixed(1) : '—'}
          sub={
            spread ? `${spread.topId} → ${spread.bottomId}` : 'need 2+ teams'
          }
        />
      </div>

      <div className="league-context__dist">
        <div
          className="league-context__bar"
          role="img"
          aria-label={
            hasPicks
              ? `Role distribution: ${pct(rd.corePct)}% core starters, ${pct(
                  rd.contributorPct,
                )}% contributors, ${pct(rd.nonContributorPct)}% non-contributors`
              : 'No scored picks in this window yet'
          }
        >
          {hasPicks && (
            <>
              <span
                className="league-context__seg league-context__seg--core"
                style={{ width: `${rd.corePct * 100}%` }}
              />
              <span
                className="league-context__seg league-context__seg--contrib"
                style={{ width: `${rd.contributorPct * 100}%` }}
              />
              <span
                className="league-context__seg league-context__seg--non"
                style={{ width: `${rd.nonContributorPct * 100}%` }}
              />
            </>
          )}
        </div>
        {hasPicks ? (
          <>
            <div className="league-context__legend">
              <span>
                <i className="league-context__dot league-context__dot--core" />
                Core <b className="tnum">{pct(rd.corePct)}%</b>
              </span>
              <span>
                <i className="league-context__dot league-context__dot--contrib" />
                Contributor <b className="tnum">{pct(rd.contributorPct)}%</b>
              </span>
              <span>
                <i className="league-context__dot league-context__dot--non" />
                Non-contributor{' '}
                <b className="tnum">{pct(rd.nonContributorPct)}%</b>
              </span>
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
