import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Masthead, type MastheadTab } from './Masthead';

function renderMasthead(active: MastheadTab) {
  render(
    <MemoryRouter>
      <Masthead
        active={active}
        dataLastUpdatedDate="2026-08-01"
        onShowInfo={vi.fn()}
        dark={false}
        onToggleDark={vi.fn()}
      />
    </MemoryRouter>,
  );
  return screen
    .getByRole('navigation', { name: 'Primary' })
    .querySelectorAll('button');
}

describe('Masthead', () => {
  it('places Highlights between Rankings and Draft Year when no team is open', () => {
    const labels = Array.from(renderMasthead('rankings'), (b) => b.textContent);

    expect(labels).toEqual([
      'Rankings',
      'Highlights',
      'Draft Year',
      'Position',
    ]);
  });

  it('places Highlights between Team and Draft Year when a team is open', () => {
    const labels = Array.from(renderMasthead('team'), (b) => b.textContent);

    expect(labels).toEqual([
      'Rankings',
      'Team',
      'Highlights',
      'Draft Year',
      'Position',
    ]);
  });
});
