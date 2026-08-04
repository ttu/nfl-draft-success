import { useState, type ReactNode } from 'react';
import { parseFromYear, parseToYear } from '../../lib/yearRange';
import { useIsMobile } from '../../lib/useMediaQuery';

/** Two-digit year, e.g. 2018 → "18". */
function yy(year: number): string {
  return String(year % 100).padStart(2, '0');
}

export function Subbar({ children }: { children: ReactNode }) {
  return <div className="subbar">{children}</div>;
}

interface ChipProps {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ on, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      className={`subbar__chip${on ? ' is-on' : ''}`}
      onClick={onClick}
      aria-pressed={!!on}
    >
      {children}
    </button>
  );
}

export function YearRangeChips({
  from,
  to,
  min,
  max,
  latestCompletedYear,
  onChange,
}: {
  from: number;
  to: number;
  min: number;
  max: number;
  /**
   * Most recent draft year with a completed NFL season. Usually `max - 1`,
   * since the newest draft class (`max`) has not yet played a full season.
   */
  latestCompletedYear: number;
  onChange: (range: [number, number]) => void;
}) {
  // Preset windows end at the latest completed season, not `max` (the current
  // draft class). That newest class has no snap/retention data yet, so ending
  // at it would understate scores.
  // Ordered longest window first so the full range leads the chips.
  // Phones get two-digit years and bare durations so all four windows fit one
  // row; the full labels return as soon as there is width for them.
  const isMobile = useIsMobile();
  const span = (a: number, b: number) =>
    isMobile ? `${yy(a)}–${yy(b)}` : `${a}–${b}`;
  const presets: Array<{ label: string; from: number; to: number }> = [
    {
      label: span(min, latestCompletedYear),
      from: min,
      to: latestCompletedYear,
    },
    {
      label: span(latestCompletedYear - 4, latestCompletedYear),
      from: latestCompletedYear - 4,
      to: latestCompletedYear,
    },
    {
      label: isMobile ? '3 yr' : 'Last 3 yr',
      from: latestCompletedYear - 2,
      to: latestCompletedYear,
    },
    {
      label: isMobile ? '1 yr' : 'Last yr',
      from: latestCompletedYear,
      to: latestCompletedYear,
    },
  ];

  /** Whether the custom From/To fields are revealed (mobile only — see CSS). */
  const [customOpen, setCustomOpen] = useState(false);
  const [fromInput, setFromInput] = useState(String(from));
  const [toInput, setToInput] = useState(String(to));
  /**
   * The range as last agreed with the parent — the props once they arrive, or
   * the value already handed up through `onChange` while they are still in
   * flight. `onChange` routes the range through the URL, so the re-render
   * carrying it back down can lag the next commit; clamping against the props
   * directly would let one field clobber a value the user just committed in
   * the other.
   */
  const [committed, setCommitted] = useState({ from, to });

  // Re-sync the editable inputs and the committed range when the props change.
  // Adjusting state during render (tracking the previous props) avoids the
  // cascading renders an effect would cause.
  const [prevProps, setPrevProps] = useState({ from, to });
  if (from !== prevProps.from || to !== prevProps.to) {
    if (from !== prevProps.from) setFromInput(String(from));
    if (to !== prevProps.to) setToInput(String(to));
    setPrevProps({ from, to });
    setCommitted({ from, to });
  }

  const commitRange = (next: [number, number]) => {
    setCommitted({ from: next[0], to: next[1] });
    onChange(next);
  };
  const commitFrom = (raw: string) => {
    const v = parseFromYear(raw, min, committed.to);
    if (v != null && v !== committed.from) commitRange([v, committed.to]);
    else setFromInput(String(committed.from));
  };
  const commitTo = (raw: string) => {
    const v = parseToYear(raw, max, committed.from);
    if (v != null && v !== committed.to) commitRange([committed.from, v]);
    else setToInput(String(committed.to));
  };

  return (
    <>
      {/* `display: contents` on desktop, so the label and chips stay direct
          children of the subbar's flex row. On mobile it becomes its own
          scroller, which keeps an overflowing chip from sliding under the
          edit toggle instead of past the row's edge. */}
      <span className="subbar__presets">
        <span className="subbar__label">Range</span>
        {presets.map((p) => (
          <Chip
            key={p.label}
            on={p.from === committed.from && p.to === committed.to}
            onClick={() => commitRange([p.from, p.to])}
          >
            {p.label}
          </Chip>
        ))}
      </span>
      {/* Mobile squeezes the whole control onto one row, so the custom range
          hides behind this toggle. On desktop the button is not rendered and
          the inputs sit open beside the chips. */}
      <button
        type="button"
        className="subbar__range-edit mono"
        aria-expanded={customOpen}
        onClick={() => setCustomOpen((v) => !v)}
      >
        {customOpen ? 'done' : 'edit'}
      </button>
      <span
        className={`subbar__range-inputs${customOpen ? ' is-open' : ''}`}
        role="group"
        aria-label="Custom year range"
      >
        <label>
          <span className="subbar__label">From</span>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            onBlur={(e) => commitFrom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Start year"
          />
        </label>
        <label>
          <span className="subbar__label">To</span>
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            onBlur={(e) => commitTo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="End year"
          />
        </label>
      </span>
    </>
  );
}
