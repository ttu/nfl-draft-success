import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YearRangeChips } from './Subbar';

describe('YearRangeChips', () => {
  const baseProps = {
    from: 2021,
    to: 2026,
    min: 2018,
    max: 2026,
    latestCompletedYear: 2025,
    onChange: vi.fn(),
  };

  it('preset ranges end at the latest completed year, not the incomplete current draft year', () => {
    const onChange = vi.fn();
    render(<YearRangeChips {...baseProps} onChange={onChange} />);

    // 5-year window: latestCompletedYear = 2025, so 2021–2025 (not …–2026).
    const fiveYear = screen.getByRole('button', { name: '2021–2025' });
    fireEvent.click(fiveYear);
    expect(onChange).toHaveBeenCalledWith([2021, 2025]);

    // Full window spans min through the latest completed year.
    const full = screen.getByRole('button', { name: '2018–2025' });
    fireEvent.click(full);
    expect(onChange).toHaveBeenCalledWith([2018, 2025]);
  });

  it('"Last 3 yr" selects the last 3 completed seasons, excluding the incomplete current draft year', () => {
    const onChange = vi.fn();
    render(<YearRangeChips {...baseProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Last 3 yr' }));

    // latestCompletedYear = 2025, so the window is 2023–2025 (not …–2026).
    expect(onChange).toHaveBeenCalledWith([2023, 2025]);
  });

  it('marks "Last 3 yr" active when the current range matches the completed-year window', () => {
    render(<YearRangeChips {...baseProps} from={2023} to={2025} />);

    const chip = screen.getByRole('button', { name: 'Last 3 yr' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});
