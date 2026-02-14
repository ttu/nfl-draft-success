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

  it('fires onChange when min or max changes (on blur)', () => {
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
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: '2019' } });
    fireEvent.blur(minInput);
    expect(onChange).toHaveBeenCalledWith([2019, 2025]);
    fireEvent.focus(maxInput);
    fireEvent.change(maxInput, { target: { value: '2023' } });
    fireEvent.blur(maxInput);
    expect(onChange).toHaveBeenLastCalledWith([2021, 2023]);
  });

  it('clamps from to not exceed to', () => {
    const onChange = vi.fn();
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2021, 2023]}
        onChange={onChange}
      />,
    );
    const [minInput] = screen.getAllByRole('spinbutton');
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: '2025' } });
    fireEvent.blur(minInput);
    expect(onChange).toHaveBeenCalledWith([2023, 2023]);
  });

  it('clamps to to not go below from', () => {
    const onChange = vi.fn();
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2022, 2025]}
        onChange={onChange}
      />,
    );
    const [, maxInput] = screen.getAllByRole('spinbutton');
    fireEvent.focus(maxInput);
    fireEvent.change(maxInput, { target: { value: '2019' } });
    fireEvent.blur(maxInput);
    expect(onChange).toHaveBeenCalledWith([2022, 2022]);
  });

  it('allows typing without committing until blur', () => {
    const onChange = vi.fn();
    render(
      <YearRangeFilter
        min={2018}
        max={2025}
        value={[2021, 2025]}
        onChange={onChange}
      />,
    );
    const [minInput] = screen.getAllByRole('spinbutton');
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: '2' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(minInput).toHaveValue(2);
    fireEvent.change(minInput, { target: { value: '202' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(minInput, { target: { value: '2024' } });
    fireEvent.blur(minInput);
    expect(onChange).toHaveBeenCalledWith([2024, 2025]);
  });
});
