import { useState, type ReactNode } from 'react';
import { parseFromYear, parseToYear } from '../../lib/yearRange';

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
  const presets: Array<{ label: string; from: number; to: number }> = [
    {
      label: `${min}–${latestCompletedYear}`,
      from: min,
      to: latestCompletedYear,
    },
    {
      label: `${latestCompletedYear - 4}–${latestCompletedYear}`,
      from: latestCompletedYear - 4,
      to: latestCompletedYear,
    },
    {
      label: `Last 3 yr`,
      from: latestCompletedYear - 2,
      to: latestCompletedYear,
    },
    {
      label: `Last yr`,
      from: latestCompletedYear,
      to: latestCompletedYear,
    },
  ];

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
      <span
        className="subbar__range-inputs"
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
