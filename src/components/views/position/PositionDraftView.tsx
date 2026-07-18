import { useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  TeamLogo,
  PlayerAvatar,
  RoleChip,
  teamColor,
  scoreTierClass,
} from '../../design/Primitives';
import { filterPicksByPosition } from '../../../lib/positionDraft';
import { getPositionDisplayName } from '../../../lib/positionDisplayName';
import { getPlayerRole, getPlayerDraftScore } from '../../../lib/getPlayerRole';
import { TEAMS } from '../../../data/teams';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import { cx } from '../../../lib/cx';
import type { DraftClass, DraftPick } from '../../../types';

export interface PositionDraftViewProps {
  position: string;
  yearFrom: number;
  yearTo: number;
  draftClasses: DraftClass[];
  draftingTeamOnly: boolean;
  positionOptions?: string[];
  onPositionChange?: (pos: string) => void;
}

interface PickRow {
  pick: DraftPick;
  draftYear: number;
  role: string;
  score: number;
}

export function PositionDraftView({
  position,
  yearFrom,
  yearTo,
  draftClasses,
  draftingTeamOnly,
  positionOptions,
  onPositionChange,
}: PositionDraftViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rows = useMemo<PickRow[]>(() => {
    const flat = filterPicksByPosition(draftClasses, position);
    return flat
      .map(({ pick, draftYear }) => ({
        pick,
        draftYear,
        role: getPlayerRole(pick, { draftingTeamOnly }),
        score: Math.round(getPlayerDraftScore(pick, { draftingTeamOnly })),
      }))
      .sort((a, b) => b.score - a.score);
  }, [draftClasses, position, draftingTeamOnly]);

  const avgScore =
    rows.length === 0
      ? '—'
      : (rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1);
  const cores = rows.filter((r) => r.role === 'core_starter').length;
  const firsts = rows.filter((r) => r.pick.round === 1).length;

  const handleSelectPos = (pos: string) => {
    if (onPositionChange) {
      onPositionChange(pos);
    } else {
      navigate({
        pathname: `/position/${encodeURIComponent(pos)}`,
        search: searchParams.toString(),
      });
    }
  };

  const tabs =
    positionOptions && positionOptions.length > 0
      ? positionOptions
      : [position];

  return (
    <section className="position-view">
      <div className="pos-tabstrip" role="tablist" aria-label="Positions">
        {tabs.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === position}
            className={p === position ? 'is-active' : ''}
            onClick={() => handleSelectPos(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <section className="pos-hero">
        <div>
          <div className="kicker" style={{ marginBottom: 14 }}>
            Position File · {position} ·{' '}
            {yearFrom === yearTo ? yearFrom : `${yearFrom}–${yearTo}`}
          </div>
          <div className="pos-glyph">
            {position}
            <span className="pos-glyph__dot">.</span>
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10 }}
          >
            {rows.length} prospects drafted in range
          </div>
        </div>
        <div>
          <h1 className="pos-headline">
            <em>{getPositionDisplayName(position)}</em>, ranked by how much they
            actually played.
          </h1>
          <div className="pos-stats">
            <PosStat label="Avg. score" big={String(avgScore)} />
            <PosStat
              label="Core starters"
              big={String(cores)}
              sub={`/ ${rows.length}`}
              accent
            />
            <PosStat label="Round 1" big={String(firsts)} />
            <PosStat
              label="Years"
              big={`${yearTo - yearFrom + 1}`}
              sub="in window"
            />
          </div>
        </div>
      </section>

      <section className="pos-table">
        {rows.length === 0 ? (
          <p
            className="mono"
            style={{
              padding: '60px 0',
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 12,
            }}
          >
            No picks at {position} in this range.
          </p>
        ) : (
          <table>
            <colgroup>
              <col className="pos-col--rank" />
              <col className="pos-col--pick" />
              <col />
              <col className="pos-col--class" />
              <col className="pos-col--round" />
              <col className="pos-col--score" />
              <col className="pos-col--role" />
            </colgroup>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Pick</th>
                <th>Player · Team</th>
                <th className="hide-mobile">Class</th>
                <th className="right hide-mobile">Round</th>
                <th className="right">Score</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <PosRow key={r.pick.playerId} r={r} i={i + 1} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

function PosStat({
  label,
  big,
  sub,
  accent,
}: {
  label: string;
  big: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        className={`year-stat__value${accent ? ' year-stat__value--accent' : ''}`}
        style={{ fontSize: 30 }}
      >
        {big}
        {sub && (
          <span
            style={{
              fontSize: 14,
              color: 'var(--ink-4)',
              fontWeight: 400,
              marginLeft: 4,
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function PosRow({ r, i }: { r: PickRow; i: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const team = TEAMS.find((t) => t.id === r.pick.teamId);
  const color = teamColor(r.pick.teamId);
  const fillClass = scoreTierClass(r.score, {
    high: 'score-bar__fill--high',
    low: 'score-bar__fill--low',
  });

  return (
    <tr
      onClick={() =>
        navigate(
          buildPlayerHref(r.pick.playerId, location.pathname + location.search),
        )
      }
    >
      <td>
        <span
          className={`rank-num ${i <= 3 ? 'rank-num--top' : 'rank-num--rest'}`}
        >
          {i}
        </span>
      </td>
      <td>
        <span className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>
          #{r.pick.overallPick}
        </span>
      </td>
      <td>
        <div
          className="pos-player"
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div
            className="pos-player__bar"
            style={{ width: 4, height: 28, background: color }}
          />
          <PlayerAvatar
            teamId={r.pick.teamId}
            name={r.pick.playerName}
            src={r.pick.headshotUrl}
            size={32}
          />
          <span className="pos-player__logo">
            <TeamLogo teamId={r.pick.teamId} size={26} ring={false} />
          </span>
          <div>
            <div
              className="pos-player__name"
              style={{
                fontFamily: 'var(--f-serif)',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {r.pick.playerName}
            </div>
            <div
              className="mono"
              style={{ fontSize: 10.5, color: 'var(--ink-3)' }}
            >
              {r.pick.teamId} · {team?.name}
            </div>
          </div>
        </div>
      </td>
      <td className="mono tnum hide-mobile">{r.draftYear}</td>
      <td className="right mono tnum hide-mobile">R{r.pick.round}</td>
      <td className="right">
        <div className="score-bar">
          <div className="score-bar__track">
            <div
              className={cx('score-bar__fill', fillClass)}
              style={{ width: `${Math.min(100, r.score)}%` }}
            />
          </div>
          <span className="score-bar__val">{r.score}</span>
        </div>
      </td>
      <td>
        <RoleChip role={r.role} />
      </td>
    </tr>
  );
}
