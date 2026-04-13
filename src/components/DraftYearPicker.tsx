export interface DraftYearPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (year: number) => void;
  /** When false, only the select is shown (parent supplies a visible section label). */
  showLabel?: boolean;
}

/**
 * Choose any single draft year (e.g. jump to /year/2020). Newest year listed first.
 */
export function DraftYearPicker({
  min,
  max,
  value,
  onChange,
  showLabel = true,
}: DraftYearPickerProps) {
  const years: number[] = [];
  for (let y = max; y >= min; y -= 1) {
    years.push(y);
  }
  const safe =
    Number.isInteger(value) && value >= min && value <= max ? value : max;

  return (
    <label className="draft-year-picker">
      {showLabel && (
        <span className="draft-year-picker__label">Inspect draft</span>
      )}
      <select
        className="draft-year-picker__select"
        value={safe}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Draft year (all picks in that draft)"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}
