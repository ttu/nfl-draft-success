import type { Season } from '../../types';

/**
 * Season-by-season load (cumulative snap share) area chart with the raw snap
 * share overlaid as a dashed line and a 65% "core starter" reference band.
 */
export function CareerChart({
  seasons,
  color,
}: {
  seasons: Season[];
  color: string;
}) {
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
      <line
        x1={padL}
        x2={w - padR}
        y1={padT + innerH * 0.35}
        y2={padT + innerH * 0.35}
        stroke="var(--positive)"
        strokeOpacity="0.3"
        strokeDasharray="3 3"
      />
      <text
        x={w - padR - 4}
        y={padT + innerH * 0.35 - 3}
        fontSize="8.5"
        textAnchor="end"
        fill="var(--positive)"
        fontFamily="var(--f-mono)"
        letterSpacing="0.08em"
      >
        CORE 65%
      </text>
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
