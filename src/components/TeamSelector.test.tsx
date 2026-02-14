import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamSelector } from './TeamSelector';

describe('TeamSelector', () => {
  it('renders dropdown with teams', () => {
    render(<TeamSelector value="KC" onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kansas City Chiefs')).toBeInTheDocument();
  });

  it('fires onChange when selection changes', () => {
    const onChange = vi.fn();
    render(<TeamSelector value="KC" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'BUF' } });
    expect(onChange).toHaveBeenCalledWith('BUF');
  });
});
