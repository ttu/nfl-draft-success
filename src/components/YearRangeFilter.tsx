export interface YearRangeFilterProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

export function YearRangeFilter({
  min,
  max,
  value: [minYear, maxYear],
  onChange,
}: YearRangeFilterProps) {
  return (
    <div role="group" aria-label="Year range filter">
      <label>
        From
        <input
          type="number"
          min={min}
          max={max}
          value={minYear}
          onChange={(e) =>
            onChange([parseInt(e.target.value, 10) || min, maxYear])
          }
          aria-label="Start year"
        />
      </label>
      <label>
        To
        <input
          type="number"
          min={min}
          max={max}
          value={maxYear}
          onChange={(e) =>
            onChange([minYear, parseInt(e.target.value, 10) || max])
          }
          aria-label="End year"
        />
      </label>
    </div>
  );
}
