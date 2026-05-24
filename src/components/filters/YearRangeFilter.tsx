import { useState } from 'react';
import { parseFromYear, parseToYear } from '../../lib/yearRange';

export interface YearRangeFilterProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  /** Accessible name for the From/To control group */
  groupAriaLabel?: string;
}

export function YearRangeFilter({
  min,
  max,
  value: [minYear, maxYear],
  onChange,
  groupAriaLabel = 'Year range filter',
}: YearRangeFilterProps) {
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');

  const commitFrom = (v: string) => {
    setFromFocused(false);
    const from = parseFromYear(v, min, maxYear);
    if (from != null) onChange([from, maxYear]);
  };

  const commitTo = (v: string) => {
    setToFocused(false);
    const to = parseToYear(v, max, minYear);
    if (to != null) onChange([minYear, to]);
  };

  const fromDisplay = fromFocused ? fromInput : String(minYear);
  const toDisplay = toFocused ? toInput : String(maxYear);

  return (
    <div role="group" aria-label={groupAriaLabel} className="year-range-filter">
      <label>
        From
        <input
          type="number"
          min={min}
          max={max}
          value={fromDisplay}
          onChange={(e) => setFromInput(e.target.value)}
          onFocus={() => {
            setFromFocused(true);
            setFromInput(String(minYear));
          }}
          onBlur={(e) => commitFrom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          aria-label="Start year"
        />
      </label>
      <label>
        To
        <input
          type="number"
          min={min}
          max={max}
          value={toDisplay}
          onChange={(e) => setToInput(e.target.value)}
          onFocus={() => {
            setToFocused(true);
            setToInput(String(maxYear));
          }}
          onBlur={(e) => commitTo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          aria-label="End year"
        />
      </label>
    </div>
  );
}
