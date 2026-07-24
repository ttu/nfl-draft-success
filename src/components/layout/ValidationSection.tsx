import {
  classifyCorrelation,
  type CorrelationResult,
  type CorrelationRow,
} from '../../lib/draftSuccessCorrelation';
import { formatYearRange, type LaggedWindows } from '../../lib/laggedWindow';

export interface ValidationSectionProps {
  correlation: CorrelationResult | null;
  /** Fixed draft window (x-axis) and later win window (y-axis) behind the plot. */
  windows: LaggedWindows;
}

/** Format a coefficient with a true minus sign and two decimals (−0.37). */
function formatCoefficient(r: number): string {
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)}`;
}

/**
 * The methodology's "does the score predict winning?" panel: a real scatter of
 * every team's early-window draft-success score against its *later* win rate,
 * and an honest read of that lagged correlation. It states whatever the data
 * shows — over recent windows the relationship is essentially flat: drafting
 * well (by snaps) has not translated into winning a few years on, directly or
 * through the veteran capital those picks can be traded for.
 */
export function ValidationSection({
  correlation,
  windows,
}: ValidationSectionProps) {
  // Need a real spread of teams to plot and regress against.
  if (!correlation || correlation.rows.length < 3) return null;

  return (
    <section className="validation" aria-labelledby="validation-title">
      <h2
        id="validation-title"
        className="info-section-title validation__title"
      >
        Does drafting well predict winning later?
      </h2>
      <div className="validation__grid">
        <CorrelationScatter rows={correlation.rows} />
        <ValidationPanel correlation={correlation} windows={windows} />
      </div>
    </section>
  );
}

/** Honest, data-driven read of the lagged correlation. */
function relationshipCopy(pearsonR: number): {
  relation: string;
  explanation: string;
} {
  const { strength, direction } = classifyCorrelation(pearsonR);
  if (strength === 'no') {
    return {
      relation: 'essentially no linear relationship',
      explanation:
        'A good draft can pay off directly (picks who become stars) or indirectly (young talent traded for veterans), but over this window the two wash out: drafting and later winning move largely independently, with scheme, health and coaching carrying the rest.',
    };
  }
  const relation = `a ${strength} ${direction} relationship`;
  if (direction === 'positive') {
    return {
      relation,
      explanation:
        'Teams that drafted well went on to win more a few years later — the picks maturing into contributors, or the capital to trade for them.',
    };
  }
  return {
    relation,
    explanation:
      'The teams that scored highest were often the ones drafting high out of necessity — early picks who play right away, on rosters that were still losing.',
  };
}

function ValidationPanel({
  correlation,
  windows,
}: {
  correlation: CorrelationResult;
  windows: LaggedWindows;
}) {
  const { pearsonR, topIndexPlayoffRatio } = correlation;
  const { relation, explanation } = relationshipCopy(pearsonR);
  const draftLabel = formatYearRange(windows.draftFrom, windows.draftTo);
  const winLabel = formatYearRange(windows.winFrom, windows.winTo);

  return (
    <div className="validation__panel">
      <div className="validation__figures">
        <Figure
          value={formatCoefficient(pearsonR)}
          label={`Pearson r · draft ${draftLabel} → win ${winLabel}`}
        />
        <Figure
          value={`${topIndexPlayoffRatio.made} / ${topIndexPlayoffRatio.of}`}
          label={`Top-${topIndexPlayoffRatio.of} draft teams that made the playoffs 3+ yrs since`}
        />
      </div>

      <ul className="validation__legend">
        <LegendDot className="validation-dot--sbwin" label="Won Super Bowl" />
        <LegendDot className="validation-dot--sb" label="Reached Super Bowl" />
        <LegendDot className="validation-dot--other" label="Other teams" />
      </ul>

      <p className="validation__prose">
        We compare each team's <b>{draftLabel}</b> draft-success score against
        its <b>{winLabel}</b> win rate — the seasons that followed. It shows{' '}
        <b>{relation}</b>. {explanation}
      </p>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="validation__figure">
      <span className="validation__stat">{value}</span>
      <span className="kicker">{label}</span>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <li className="validation__legend-item">
      <span className={`validation-dot ${className}`} aria-hidden="true" />
      {label}
    </li>
  );
}

/** SVG scatter with gridlines and a least-squares trend line. Presentational. */
function CorrelationScatter({ rows }: { rows: CorrelationRow[] }) {
  const W = 340;
  const H = 260;
  const pad = { l: 42, r: 16, t: 16, b: 36 };

  const scores = rows.map((r) => r.score);
  const wins = rows.map((r) => r.winPct);
  const xDomain = paddedExtent(scores);
  const yDomain = paddedExtent(wins, 0, 1);

  const x = (v: number) =>
    pad.l +
    ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * (W - pad.l - pad.r);
  const y = (v: number) =>
    H -
    pad.b -
    ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * (H - pad.t - pad.b);

  const trend = leastSquares(scores, wins);
  const gridX = ticks(xDomain, 4);
  const gridY = ticks(yDomain, 4);

  return (
    <svg
      className="validation__chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Scatter plot of each team's draft-success score against its regular-season win rate, with a trend line."
    >
      {/* gridlines */}
      {gridX.map((t) => (
        <line
          key={`gx-${t}`}
          className="validation__gridline"
          x1={x(t)}
          x2={x(t)}
          y1={pad.t}
          y2={H - pad.b}
        />
      ))}
      {gridY.map((t) => (
        <line
          key={`gy-${t}`}
          className="validation__gridline"
          x1={pad.l}
          x2={W - pad.r}
          y1={y(t)}
          y2={y(t)}
        />
      ))}

      {/* axes */}
      <line
        className="validation__axis"
        x1={pad.l}
        x2={pad.l}
        y1={pad.t}
        y2={H - pad.b}
      />
      <line
        className="validation__axis"
        x1={pad.l}
        x2={W - pad.r}
        y1={H - pad.b}
        y2={H - pad.b}
      />

      {/* least-squares trend line across the score domain */}
      {trend && (
        <line
          className="validation__trend"
          x1={x(xDomain[0])}
          y1={y(trend.a + trend.b * xDomain[0])}
          x2={x(xDomain[1])}
          y2={y(trend.a + trend.b * xDomain[1])}
        />
      )}

      {/* dots, champions drawn last so they sit on top */}
      {[...rows]
        .sort((a, b) => dotRank(a) - dotRank(b))
        .map((r) => (
          <circle
            key={r.teamId}
            className={`validation-dot-mark ${dotClass(r)}`}
            cx={x(r.score)}
            cy={y(r.winPct)}
            r={dotRadius(r)}
          />
        ))}

      <text className="validation__axis-label" x={pad.l} y={H - 8}>
        DRAFT SCORE →
      </text>
      <text
        className="validation__axis-label"
        x={-(H / 2 + 22)}
        y={12}
        transform="rotate(-90)"
      >
        WIN %
      </text>
    </svg>
  );
}

function dotClass(r: CorrelationRow): string {
  if (r.sbWins > 0) return 'validation-dot-mark--sbwin';
  if (r.sbApps > 0) return 'validation-dot-mark--sb';
  return 'validation-dot-mark--other';
}

function dotRadius(r: CorrelationRow): number {
  if (r.sbWins > 0) return 6;
  if (r.sbApps > 0) return 5;
  return 3.5;
}

/** Draw order: other teams first, SB teams above, champions on top. */
function dotRank(r: CorrelationRow): number {
  if (r.sbWins > 0) return 2;
  if (r.sbApps > 0) return 1;
  return 0;
}

/** Min/max with 6% padding, optionally clamped to hard bounds. */
function paddedExtent(
  values: number[],
  min?: number,
  max?: number,
): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const p = span * 0.06;
  const outLo = min != null ? Math.max(min, lo - p) : lo - p;
  const outHi = max != null ? Math.min(max, hi + p) : hi + p;
  return [outLo, outHi];
}

function ticks([lo, hi]: [number, number], count: number): number[] {
  return Array.from(
    { length: count + 1 },
    (_, i) => lo + ((hi - lo) * i) / count,
  );
}

/** Ordinary least-squares fit y = a + b·x; null when x has no variance. */
function leastSquares(
  xs: number[],
  ys: number[],
): { a: number; b: number } | null {
  const n = xs.length;
  if (n === 0) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    varX += (xs[i] - mx) ** 2;
  }
  if (varX === 0) return null;
  const b = cov / varX;
  return { a: my - b * mx, b };
}
