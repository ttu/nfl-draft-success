import { useMemo, type CSSProperties } from 'react';
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
import { TEAMS } from '../../../data/teams';
import { getPlayerRole, getPlayerDraftScore } from '../../../lib/getPlayerRole';
import { getSeasonScore } from '../../../lib/getSeasonScore';
import { classifyRole, CORE_TIER_THRESHOLD } from '../../../lib/classifyRole';
import { snapShareForRoleTier } from '../../../lib/snapShareForTier';
import {
  getPositionBaseline,
  isBaselineExemptPosition,
} from '../../../lib/positionBaseline';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import { getCurrentTeamIndicator } from '../../../lib/playerJourney';
import { getPfrUrl } from '../../../lib/playerDisplay';
import {
  getPositionCohort,
  type CohortMember,
} from '../../../lib/getPositionCohort';
import type { DraftClass, DraftPick, Season } from '../../../types';

export interface PlayerDetailViewProps {
  pick: DraftPick;
  draftYear: number;
  draftClasses: DraftClass[];
  draftingTeamOnly: boolean;
}

export function PlayerDetailView({
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
  const currentTeam = getCurrentTeamIndicator(pick);
  const positionExempt = isBaselineExemptPosition(pick.position);
  const positionBaseline = getPositionBaseline(pick.position);
  const fullTimeBarPct = Math.round(positionBaseline * 100);
  const coreStarterPct = Math.round(
    positionBaseline * CORE_TIER_THRESHOLD * 100,
  );
  const roleCls = roleDesignClass(role);
  const sortedSeasons = [...pick.seasons].sort((a, b) => a.year - b.year);
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
          <div className="player-hero__name-col">
            <h1 className="player-hero__name">{pick.playerName}</h1>
            <div className="player-hero__meta">
              <span className="pos-chip">{pick.position}</span>
              <span>·</span>
              <span>Pick {pick.overallPick} overall</span>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span
                className="mono"
                style={{ color: 'var(--ink-3)', fontSize: 12 }}
              >
                {team?.name} · drafted by {pick.teamId}
              </span>
              {currentTeam &&
                (currentTeam === 'FA' ? (
                  <span className="player-hero__now">now a free agent</span>
                ) : (
                  <span className="player-hero__now">
                    now with
                    <TeamLogo teamId={currentTeam} size={16} ring={false} />
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {currentTeam}
                    </span>
                  </span>
                ))}
            </div>
          </div>
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
          </div>
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
              Weeks spent on the injury report don't count against him, so
              getting hurt doesn't drag Load down.
            </dd>
            <dt>Role</dt>
            <dd>
              His job that season — Core Starter, Significant Contributor, and
              so on. Based on Load, not Avg snap (kickers and punters are the
              exception).
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
            {sortedSeasons.length} season{sortedSeasons.length === 1 ? '' : 's'}
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
                <col style={{ width: 90 }} />
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
                  <th className="right">Load</th>
                  <th>Role</th>
                  <th className="right">Score</th>
                  <th className="right hide-mobile">IR wks</th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasons.map((s) => (
                  <SeasonRow
                    key={s.year}
                    s={s}
                    pickTeamId={pick.teamId}
                    position={pick.position}
                    color={color}
                  />
                ))}
              </tbody>
            </table>
          </div>
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

function SeasonRow({
  s,
  pickTeamId,
  position,
  color,
}: {
  s: Season;
  pickTeamId: string;
  position: string;
  color: string;
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
    <tr>
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
      <td className="right mono tnum">{s.gamesPlayed}</td>
      <td className="right">
        <SnapBar value={snapPct} color={color} />
      </td>
      <td className="right">
        <SnapBar value={loadPct} muted />
      </td>
      <td>
        <RoleChip role={seasonRole} />
      </td>
      <td className="right mono tnum player-career__score">
        {Math.round(getSeasonScore(s, position))}
      </td>
      <td className="right mono tnum hide-mobile">
        {s.injuryReportWeeks ?? 0}
      </td>
    </tr>
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
      onClick={() => !isSelf && onSelect()}
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
