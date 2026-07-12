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
  ];

  const [fromInput, setFromInput] = useState(String(from));
  const [toInput, setToInput] = useState(String(to));
  // Re-sync the editable inputs when the committed range changes. Adjusting
  // state during render (tracking the previous prop) avoids the cascading
  // renders an effect would cause.
  const [prevFrom, setPrevFrom] = useState(from);
  if (from !== prevFrom) {
    setPrevFrom(from);
    setFromInput(String(from));
  }
  const [prevTo, setPrevTo] = useState(to);
  if (to !== prevTo) {
    setPrevTo(to);
    setToInput(String(to));
  }

  const commitFrom = (raw: string) => {
    const v = parseFromYear(raw, min, to);
    if (v != null && v !== from) onChange([v, to]);
    else setFromInput(String(from));
  };
  const commitTo = (raw: string) => {
    const v = parseToYear(raw, max, from);
    if (v != null && v !== to) onChange([from, v]);
    else setToInput(String(to));
  };

  return (
    <>
      <span className="subbar__label">Range</span>
      {presets.map((p) => (
        <Chip
          key={p.label}
          on={p.from === from && p.to === to}
          onClick={() => onChange([p.from, p.to])}
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
