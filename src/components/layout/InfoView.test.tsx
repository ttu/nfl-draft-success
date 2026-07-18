import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { InfoView } from './InfoView';

// Characterization tests: these pin the sheet's observable behaviour so the
// section components can be restructured without silently changing it.

describe('InfoView', () => {
  it('renders the sheet as a labelled modal dialog', () => {
    render(<InfoView onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      within(dialog).getByRole('heading', { name: /how the score is built/i }),
    ).toBeInTheDocument();
  });

  it('lists every role tier in the classification table', () => {
    render(<InfoView onClose={vi.fn()} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6); // header + 5 tiers
    expect(
      within(table).getByText('On the field full-time, all season'),
    ).toBeInTheDocument();
    expect(within(table).getByText('Rarely on the field')).toBeInTheDocument();
  });

  it('shows generic snap thresholds until a position is chosen', () => {
    render(<InfoView onClose={vi.fn()} />);
    // Core and starter-when-healthy share the snap bar, differing on games.
    expect(screen.getAllByText('≥ 65%')).toHaveLength(2);
  });

  it('re-states the snap thresholds for the selected position', () => {
    render(<InfoView onClose={vi.fn()} />);
    const picker = screen.getByLabelText(/show snap thresholds for position/i);

    fireEvent.change(picker, { target: { value: 'RB' } });

    // A running back's full-time bar is far below the generic 65%, so every
    // tier shifts down with it.
    expect(picker).toHaveValue('RB');
    expect(screen.queryByText('≥ 65%')).not.toBeInTheDocument();
    expect(screen.getAllByText('≥ 42%')).toHaveLength(2);
    expect(screen.getByText('≥ 23%')).toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const onClose = vi.fn();
    render(<InfoView onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close methodology/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<InfoView onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks background scroll while open and restores it on unmount', () => {
    const { unmount } = render(<InfoView onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('shows the last-updated row only when a date is supplied', () => {
    const { rerender } = render(<InfoView onClose={vi.fn()} />);
    expect(screen.queryByText('Last updated')).not.toBeInTheDocument();

    rerender(<InfoView onClose={vi.fn()} dataLastUpdatedDate="2026-07-01" />);
    expect(screen.getByText('Last updated')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01')).toBeInTheDocument();
  });

  it('links to the project source', () => {
    render(<InfoView onClose={vi.fn()} />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/ttu/nfl-draft-success',
    );
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
