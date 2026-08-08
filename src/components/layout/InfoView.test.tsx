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

  it('states the rookie-contract window in the formal formula', () => {
    render(<InfoView onClose={vi.fn()} />);
    // The denominator is the whole claim the score makes; if it stops being
    // spelled out here, the 0–100 number is unexplained.
    expect(
      screen.getByText(/window\(pick\)\s+=\s+\(5 if round 1 else 4\) − sat/),
    ).toBeInTheDocument();
    // Long lines wrap mid-expression in this fixed-width block, which reads as
    // corrupted maths. Pin the limit rather than rediscover it in a screenshot.
    const formula = screen.getByText(/window\(pick\)/).textContent ?? '';
    for (const line of formula.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(62);
    }
  });

  it('admits that a "learning" season may have been an injured one', () => {
    render(<InfoView onClose={vi.fn()} />);
    // The career table labels these seasons "learning", which is the usual
    // cause but not a knowable one — nothing in the snap data says why a
    // quarterback did not play, and McCarthy's lost rookie year carries no
    // injury signal at all. The methodology is where that gets owned; without
    // it the app asserts a reason it cannot support.
    expect(
      screen.getByText(/lost to injury counts the same way/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Read the label as "before he won the job"/i),
    ).toBeInTheDocument();
  });

  it('no longer claims tenure is kept out of the score', () => {
    render(<InfoView onClose={vi.fn()} />);
    // This sentence was true before the score divided by the rookie window.
    expect(
      screen.queryByText(/rather than being folded in/i),
    ).not.toBeInTheDocument();
  });

  it('discloses what the score cannot capture', () => {
    render(<InfoView onClose={vi.fn()} />);
    expect(
      screen.getByText(/what a trade brought back is invisible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/recent classes are judged more gently/i),
    ).toBeInTheDocument();
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
