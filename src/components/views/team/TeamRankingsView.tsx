import { TEAMS } from '../../../data/teams';
import {
  TeamLogo,
  Sparkline,
  HeatRow,
  Delta,
  teamColor,
} from '../../design/Primitives';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';

export interface TeamRankingsViewProps {
  rankings: TeamRanking[];
  yearCount: number;
  onTeamSelect: (teamId: string) => void;
  onBack?: () => void;
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
  onTeamSelect,
}: TeamRankingsViewProps) {
  const top = rankings[0] as ExtendedRanking | undefined;
  const bottom = rankings[rankings.length - 1] as ExtendedRanking | undefined;
  const total = rankings.length;

  return (
    <section className="rankings-view" aria-label="Team draft rankings">
      <section className="page-hero">
        <div className="page-hero__grid">
          <div>
            <div className="kicker" style={{ marginBottom: 12 }}>
              Draft success score · {yearCount} season
              {yearCount === 1 ? '' : 's'} in window
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
            sub={
              bottom ? `${bottom.score.toFixed(1)} · draft success score` : ''
            }
          />
          <StatBlock
            label="Teams ranked"
            value={String(total)}
            sub={`across ${yearCount} ${yearCount === 1 ? 'season' : 'seasons'}`}
          />
        </div>
      </section>

      <div className="divider-em" />

      <div className="rankings-legend">
        <span className="kicker">Glossary</span>
        <span>
          <b>Score</b> · mean of weighted snaps + availability (0–100)
        </span>
        <span>
          <b>Core %</b> · share of picks playing 65%+ snaps
        </span>
        <span>
          <b>Retention</b> · still on roster (any year drafted)
        </span>
        <span style={{ marginLeft: 'auto' }} className="mono">
          click any team for the deep cut →
        </span>
      </div>

      <div className="rankings-table-wrap">
        <table className="rankings-table">
          <colgroup>
            <col style={{ width: 56 }} />
            <col style={{ width: 38 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Rank</th>
              <th>YoY</th>
              <th>Team</th>
              <th className="right">Score</th>
              <th className="right hide-md">Picks</th>
              <th className="hide-mobile">Trend</th>
              <th className="right hide-mobile">Core %</th>
              <th className="right hide-mobile">Retained</th>
              <th className="right hide-md">Heat</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <RankRow
                key={r.teamId}
                r={r as ExtendedRanking}
                onSelect={onTeamSelect}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rankings-foot">
        <div className="rankings-foot__text">
          Data sourced from nflverse · classifications computed on snap-share
          thresholds of 65% (Core) / 40% (Significant) / 20% (Depth). Players
          are credited to the team that drafted them.
        </div>
      </div>
    </section>
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

function RankRow({
  r,
  onSelect,
}: {
  r: ExtendedRanking;
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
          <div style={{ lineHeight: 1.15 }}>
            <div className="team-row__id">{r.teamId}</div>
            <div className="team-row__name">{team?.name ?? r.teamName}</div>
          </div>
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
          <Sparkline values={trend} width={92} height={22} stroke={color} />
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
      <td className="right hide-md">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {trend ? <HeatRow values={trend} width={92} height={14} /> : null}
        </div>
      </td>
    </tr>
  );
}
