import type { Season } from '../../types';
import {
  getPositionTierThresholds,
  isBaselineExemptPosition,
} from '../../lib/positionBaseline';

/**
 * Season-by-season load (cumulative snap share) area chart with the raw snap
 * share overlaid as a dashed line and a "core starter" reference line. The
 * chart plots raw snap %, so the Core line sits at the position's raw Core
 * threshold (`baseline × CORE_TIER_THRESHOLD`) — e.g. ~56% for a WR, ~65% for
 * an offensive lineman — matching position-adjusted classification.
 *
 * Kickers, punters and long snappers get **no** Core line: their snap share is
 * measured against a scrimmage+ST denominator, so a full-time specialist sits
 * near ~10–40% and can never reach the 65% bar — a reference line there would
 * imply an unreachable threshold rather than a meaningful one.
 */
export function CareerChart({
  seasons,
  color,
  position,
}: {
  seasons: Season[];
  color: string;
  position: string;
}) {
  const showCoreLine = !isBaselineExemptPosition(position);
  const coreFrac = getPositionTierThresholds(position).core;
  const corePct = Math.round(coreFrac * 100);
  const w = 560;
  const h = 200;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  if (seasons.length === 0) {
    return (
      <div
        className="mono"
        style={{ color: 'var(--ink-3)', fontSize: 12, padding: '20px 0' }}
      >
        No season data yet.
      </div>
    );
  }
  const xs = seasons.map(
    (_, i) => padL + (i * innerW) / Math.max(1, seasons.length - 1),
  );
  const loadVals = seasons.map(
    (s) => (s.cumulativeSnapShare ?? s.snapShare) * 100,
  );
  const snapVals = seasons.map((s) => s.snapShare * 100);
  const loadPath = loadVals
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${xs[i]} ${padT + innerH - (v / 100) * innerH}`,
    )
    .join(' ');
  const snapPath = snapVals
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${xs[i]} ${padT + innerH - (v / 100) * innerH}`,
    )
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: 'block' }}>
      {[100, 75, 50, 25, 0].map((g) => (
        <g key={g}>
          <line
            x1={padL}
            x2={w - padR}
            y1={padT + innerH * (1 - g / 100)}
            y2={padT + innerH * (1 - g / 100)}
            stroke="var(--rule-2)"
          />
          <text
            x={padL - 8}
            y={padT + innerH * (1 - g / 100) + 3}
            fontSize="9.5"
            textAnchor="end"
            fill="var(--ink-4)"
            fontFamily="var(--f-mono)"
          >
            {g}
          </text>
        </g>
      ))}
      {showCoreLine && (
        <>
          <line
            x1={padL}
            x2={w - padR}
            y1={padT + innerH * (1 - coreFrac)}
            y2={padT + innerH * (1 - coreFrac)}
            stroke="var(--positive)"
            strokeOpacity="0.3"
            strokeDasharray="3 3"
          />
          <text
            x={w - padR - 4}
            y={padT + innerH * (1 - coreFrac) - 3}
            fontSize="8.5"
            textAnchor="end"
            fill="var(--positive)"
            fontFamily="var(--f-mono)"
            letterSpacing="0.08em"
          >
            CORE {corePct}%
          </text>
        </>
      )}
      <path
        d={`${loadPath} L ${xs[xs.length - 1]} ${padT + innerH} L ${xs[0]} ${padT + innerH} Z`}
        fill={color}
        fillOpacity={0.1}
      />
      <path
        d={loadPath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={snapPath}
        fill="none"
        stroke="var(--ink-2)"
        strokeWidth={1.6}
        strokeDasharray="4 3"
      />
      {seasons.map((s, i) => (
        <g key={s.year}>
          <circle
            cx={xs[i]}
            cy={padT + innerH - (loadVals[i] / 100) * innerH}
            r={3.5}
            fill="var(--card)"
            stroke={color}
            strokeWidth={1.8}
          />
          <text
            x={xs[i]}
            y={h - padB + 14}
            fontSize="10"
            textAnchor="middle"
            fontFamily="var(--f-mono)"
            fill="var(--ink-3)"
          >
            {s.year}
          </text>
        </g>
      ))}
    </svg>
  );
}
