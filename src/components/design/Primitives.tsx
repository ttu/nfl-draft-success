import type { CSSProperties } from 'react';
import { TEAM_COLORS, getTeamLogoUrl } from '../../data/teamColors';
import { TEAMS } from '../../data/teams';
import type { Role } from '../../types';

// Pure design helpers colocated with the primitives that use them; the
// fast-refresh rule only concerns component exports.
// eslint-disable-next-line react-refresh/only-export-components
export function teamColor(id?: string): string {
  if (!id) return '#56524a';
  return TEAM_COLORS[id] ?? '#56524a';
}

// eslint-disable-next-line react-refresh/only-export-components
export function teamFg(hex?: string): string {
  if (!hex) return '#fff';
  const m = hex.replace('#', '');
  if (m.length !== 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.62 ? '#15140f' : '#fffdf6';
}

/**
 * A labelled stat: kicker label, a large value (optionally accented), and an
 * optional sub-line beneath it. `variant` selects the CSS namespace so the
 * team hero and draft-year masthead share one structure.
 */
export function StatBlock({
  label,
  value,
  sub,
  variant,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  variant: 'hero' | 'year';
  accent?: boolean;
}) {
  const valueClass =
    variant === 'hero' ? 'hero-stat__value' : 'year-stat__value';
  const subClass = variant === 'hero' ? 'hero-stat__sub' : 'year-stat__sub';
  return (
    <div>
      <div className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div className={`${valueClass}${accent ? ` ${valueClass}--accent` : ''}`}>
        {value}
      </div>
      {sub && <div className={subClass}>{sub}</div>}
    </div>
  );
}

/** Draft score at/above which a pick is a "high" tier (best styling). */
export const SCORE_TIER_HIGH = 70;
/** Draft score below which a pick is a "low" tier (muted styling). */
export const SCORE_TIER_LOW = 30;

/**
 * Picks the tier modifier class for a draft score. Callers pass their own
 * high/low class names (score bars and ledger rows use different prefixes);
 * scores between the thresholds get no modifier.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function scoreTierClass(
  score: number,
  classes: { high: string; low: string },
): string {
  if (score >= SCORE_TIER_HIGH) return classes.high;
  if (score < SCORE_TIER_LOW) return classes.low;
  return '';
}

/** Map internal role string to design class. */
const ROLE_TO_DESIGN: Record<
  Role | 'gone',
  'core' | 'shw' | 'sig' | 'dep' | 'non' | 'gone'
> = {
  core_starter: 'core',
  starter_when_healthy: 'shw',
  significant_contributor: 'sig',
  contributor: 'sig',
  depth: 'dep',
  non_contributor: 'non',
  gone: 'gone',
};

const ROLE_LABEL: Record<string, string> = {
  core: 'Core Starter',
  shw: 'Starter (Healthy)',
  sig: 'Significant',
  dep: 'Depth',
  non: 'Non-Contributor',
  gone: 'Departed',
};

/** Compact role labels for dense rows (e.g. the draft-year pick ledger). */
const SHORT_ROLE_LABEL: Record<string, string> = {
  core: 'Core',
  shw: 'Healthy',
  sig: 'Significant',
  dep: 'Depth',
  non: 'Non',
  gone: 'Departed',
};

// eslint-disable-next-line react-refresh/only-export-components
export function roleDesignClass(role: Role | 'gone' | string): string {
  return (ROLE_TO_DESIGN as Record<string, string>)[role] ?? 'dep';
}

// eslint-disable-next-line react-refresh/only-export-components
export function roleLabel(role: Role | 'gone' | string): string {
  const cls = roleDesignClass(role);
  return ROLE_LABEL[cls] ?? cls;
}

// eslint-disable-next-line react-refresh/only-export-components
export function shortRoleLabel(role: Role | 'gone' | string): string {
  const cls = roleDesignClass(role);
  return SHORT_ROLE_LABEL[cls] ?? cls;
}

export function RoleChip({ role }: { role: Role | 'gone' | string }) {
  const cls = roleDesignClass(role);
  return <span className={`role-chip ${cls}`}>{ROLE_LABEL[cls]}</span>;
}

interface TeamLogoProps {
  teamId: string;
  size?: number;
  ring?: boolean;
  useRealLogo?: boolean;
  style?: CSSProperties;
}

export function TeamLogo({
  teamId,
  size = 32,
  ring = true,
  useRealLogo = true,
  style,
}: TeamLogoProps) {
  const team = TEAMS.find((t) => t.id === teamId);
  if (!team) return null;
  const color = teamColor(teamId);
  const fg = teamFg(color);
  const initial = team.name.charAt(0);
  const logoUrl = useRealLogo ? getTeamLogoUrl(teamId) : null;
  const ringShadow = ring
    ? `0 0 0 ${Math.max(1, size / 22)}px ${color}, 0 0 0 ${Math.max(1, size / 22) + 1}px var(--paper-3)`
    : 'none';

  return (
    <div
      className="team-logo"
      style={
        {
          width: size,
          height: size,
          '--team-color': color,
          '--team-fg': fg,
          ...style,
        } as CSSProperties
      }
    >
      <div
        className={`team-logo__disc${logoUrl ? ' team-logo__disc--real' : ''}`}
        style={{
          width: size,
          height: size,
          background: logoUrl ? '#fff' : color,
          boxShadow: logoUrl ? 'none' : ringShadow,
        }}
      >
        {logoUrl ? (
          <img
            className="team-logo__img"
            src={logoUrl}
            alt=""
            referrerPolicy="no-referrer"
            style={{ padding: Math.max(1, size * 0.06) }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span
            className="team-logo__initial"
            style={{
              fontSize: size * 0.58,
              textShadow: `0 ${size / 40}px ${size / 20}px rgba(0,0,0,0.25)`,
            }}
          >
            {initial}
          </span>
        )}
      </div>
    </div>
  );
}

interface PlayerAvatarProps {
  name: string;
  teamId?: string;
  size?: number;
  src?: string;
  square?: boolean;
  style?: CSSProperties;
}

export function PlayerAvatar({
  name,
  teamId,
  size = 36,
  src,
  square,
  style,
}: PlayerAvatarProps) {
  const color = teamId ? teamColor(teamId) : '#56524a';
  const initials = name
    .split(/\s+/)
    .map((p) => p.replace('.', '').charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const idSuffix = `${teamId ?? 'x'}-${initials}`;

  return (
    <div
      className={`player-avatar${square ? ' player-avatar--square' : ''}`}
      style={
        {
          width: size,
          height: size,
          '--team-color': color,
          ...style,
        } as CSSProperties
      }
    >
      {src ? (
        <img className="player-avatar__img" src={src} alt={name} />
      ) : (
        <>
          <svg
            className="player-avatar__silhouette"
            viewBox="0 0 40 40"
            width="100%"
            height="100%"
          >
            <defs>
              <linearGradient
                id={`sil-${idSuffix}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0" stopColor="#000" stopOpacity="0.32" />
                <stop offset="1" stopColor="#000" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <circle cx="20" cy="15" r="7.5" fill={`url(#sil-${idSuffix})`} />
            <path
              d="M 4 40 C 6 28 12 24 20 24 C 28 24 34 28 36 40 Z"
              fill={`url(#sil-${idSuffix})`}
            />
          </svg>
          <div
            className="player-avatar__initials"
            style={{
              fontSize: Math.max(8, size * 0.22),
              right: size > 28 ? 3 : 1,
              bottom: size > 28 ? 3 : 1,
              padding: size > 28 ? '2px 4px' : '1px 3px',
            }}
          >
            {initials}
          </div>
        </>
      )}
    </div>
  );
}

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
}

export function Sparkline({
  values,
  width = 88,
  height = 22,
  stroke,
  fill = 'none',
}: SparklineProps) {
  if (!values || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 2;
  const span = Math.max(1, max - min);
  const xs = values.map(
    (_, i) => pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1),
  );
  const ys = values.map(
    (v) => pad + (height - pad * 2) - ((v - min) / span) * (height - pad * 2),
  );
  const d = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(' ');
  const last = xs.length - 1;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
    >
      {fill !== 'none' && (
        <path
          d={`${d} L ${xs[last]} ${height} L ${xs[0]} ${height} Z`}
          fill={fill}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke || 'currentColor'}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={xs[last]}
        cy={ys[last]}
        r={2}
        fill={stroke || 'currentColor'}
      />
    </svg>
  );
}

export function Delta({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) {
    return <span className="delta delta--zero">—</span>;
  }
  const up = value > 0;
  return (
    <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
      <span>{up ? '▲' : '▼'}</span>
      {Math.abs(value)}
    </span>
  );
}
