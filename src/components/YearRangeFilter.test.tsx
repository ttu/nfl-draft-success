import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YearRangeFilter } from './YearRangeFilter';

describe('YearRangeFilter', () => {
  it('displays range 2021–2025 (5-year default)', () => {
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2021, 2025]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('2021')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument();
  });

  it('fires onChange when min or max changes', () => {
    const onChange = vi.fn();
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2021, 2025]}
        onChange={onChange}
      />,
    );
    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(minInput, { target: { value: '2019' } });
    expect(onChange).toHaveBeenCalledWith([2019, 2025]);
    fireEvent.change(maxInput, { target: { value: '2023' } });
    expect(onChange).toHaveBeenLastCalledWith([2021, 2023]);
  });
});
