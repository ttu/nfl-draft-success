import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DraftYearPicker } from './DraftYearPicker';

describe('DraftYearPicker', () => {
  it('lists every year in range and reports selection', () => {
    const onChange = vi.fn();
    render(
      <DraftYearPicker
        min={2020}
        max={2022}
        value={2021}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole('combobox', {
      name: /draft year \(all picks in that draft\)/i,
    });
    expect(select).toHaveValue('2021');
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['2022', '2021', '2020']);
    fireEvent.change(select, { target: { value: '2020' } });
    expect(onChange).toHaveBeenCalledWith(2020);
  });
});
