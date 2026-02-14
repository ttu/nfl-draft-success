import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YearRangeFilter } from './YearRangeFilter';

describe('YearRangeFilter', () => {
  it('displays default range 2018–2025', () => {
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2018, 2025]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('2018')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025')).toBeInTheDocument();
  });

  it('fires onChange when min or max changes', () => {
    const onChange = vi.fn();
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2018, 2025]}
        onChange={onChange}
      />,
    );
    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(minInput, { target: { value: '2019' } });
    expect(onChange).toHaveBeenCalledWith([2019, 2025]);
    fireEvent.change(maxInput, { target: { value: '2023' } });
    expect(onChange).toHaveBeenLastCalledWith([2018, 2023]);
  });
});
