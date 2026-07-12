import type { YearScore } from '../../lib/getScoreByYear';

export interface ScoreByYearChartProps {
  /** Per-class scores in ascending year order. */
  points: YearScore[];
  /** Line/marker colour (defaults to the team colour). */
  stroke?: string;
}

// Internal SVG coordinate system; the chart scales to its container width.
const W = 800;
const H = 240;
const PAD_X = 48;
const TOP_Y = 46; // top of the line plot (room above for value labels)
const BASE_Y = 190; // bottom of the line plot / area fill
const YEAR_Y = 222; // baseline for the year axis labels

/**
 * "Score, year by year" trend for a single team — one point per draft class,
 * each scored on its own. Only classes with season data are plotted, so a
 * still-awaiting latest class is omitted rather than dragging the line to zero.
 */
export function ScoreByYearChart({
  points,
  stroke = 'var(--team, var(--ox))',
}: ScoreByYearChartProps) {
  const plotted = points.filter((p) => p.hasData);
  const lo = plotted.length ? Math.min(...plotted.map((p) => p.score)) : 0;
  const hi = plotted.length ? Math.max(...plotted.map((p) => p.score)) : 0;

  return (
    <div className="hero-chart">
      <div className="hero-chart__head">
        <span className="kicker">Score, year by year</span>
        {plotted.length >= 2 && (
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--ink-3)' }}
          >
            low {Math.round(lo)} · high {Math.round(hi)}
          </span>
        )}
      </div>

      {plotted.length >= 2 ? (
        <Plot points={plotted} lo={lo} hi={hi} stroke={stroke} />
      ) : (
        <div
          className="mono"
          style={{ fontSize: 11, color: 'var(--ink-4)', padding: '20px 0 6px' }}
        >
          Not enough scored classes to chart yet.
        </div>
      )}
    </div>
  );
}

function Plot({
  points,
  lo,
  hi,
  stroke,
}: {
  points: YearScore[];
  lo: number;
  hi: number;
  stroke: string;
}) {
  const n = points.length;
  const span = hi - lo;
  const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / (n - 1);
  const y = (score: number) =>
    span < 1e-6
      ? (TOP_Y + BASE_Y) / 2
      : BASE_Y - ((score - lo) / span) * (BASE_Y - TOP_Y);

  const coords = points.map((p, i) => ({ px: x(i), py: y(p.score), p }));
  const line = coords
    .map(
      (c, i) => `${i === 0 ? 'M' : 'L'} ${c.px.toFixed(1)} ${c.py.toFixed(1)}`,
    )
    .join(' ');
  const area = `${line} L ${coords[n - 1].px.toFixed(1)} ${BASE_Y} L ${coords[0].px.toFixed(1)} ${BASE_Y} Z`;

  const summary = points
    .map((p) => `${p.year}: ${Math.round(p.score)}`)
    .join(', ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Score by year — ${summary}`}
      style={{ display: 'block' }}
    >
      <path d={area} fill={stroke} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map(({ px, py, p }) => (
        <g key={p.year}>
          <circle
            cx={px}
            cy={py}
            r={5}
            fill="var(--card)"
            stroke={stroke}
            strokeWidth={2.5}
          />
          <text
            x={px}
            y={py - 16}
            textAnchor="middle"
            fill="var(--ink)"
            style={{
              fontFamily: 'var(--f-display)',
              fontSize: 22,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(p.score)}
          </text>
          <text
            x={px}
            y={YEAR_Y}
            textAnchor="middle"
            fill="var(--ink-3)"
            style={{
              fontFamily: 'var(--f-display)',
              fontSize: 24,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {p.year}
          </text>
        </g>
      ))}
    </svg>
  );
}
