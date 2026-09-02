import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Masthead, type MastheadTab } from './Masthead';

function renderMasthead(
  active: MastheadTab,
  options: { teamId?: string; initialEntries?: string[] } = {},
) {
  render(
    <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>
      <Masthead
        active={active}
        teamId={options.teamId}
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
      'Rosters',
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
      'Rosters',
    ]);
  });

  it('offers both Team and Roster tabs when a team is open', () => {
    render(
      <MemoryRouter initialEntries={['/BUF']}>
        <Masthead
          active="team"
          teamId="BUF"
          dataLastUpdatedDate="Jan 1, 2026"
          onShowInfo={() => {}}
          dark={false}
          onToggleDark={() => {}}
        />
      </MemoryRouter>,
    );
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent)
      .filter(Boolean);
    expect(labels).toContain('Team');
    expect(labels).toContain('Roster');
  });

  it("puts the open team's Roster tab beside the league-wide Rosters board", () => {
    const labels = Array.from(
      renderMasthead('team', { teamId: 'BUF', initialEntries: ['/BUF'] }),
      (b) => b.textContent,
    );

    expect(labels).toEqual([
      'Rankings',
      'Team',
      'Highlights',
      'Draft Year',
      'Position',
      'Rosters',
      'Roster',
    ]);
  });

  it('omits the Roster tab when no team is open', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Masthead
          active="rankings"
          dataLastUpdatedDate="Jan 1, 2026"
          onShowInfo={() => {}}
          dark={false}
          onToggleDark={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Roster' })).toBeNull();
  });

  it('scrolls the active tab into view, so a nav too wide to fit never shows it half-cut', () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      renderMasthead('roster', {
        teamId: 'BUF',
        initialEntries: ['/roster/BUF'],
      });

      expect(scrollIntoView).toHaveBeenCalled();
      const target = scrollIntoView.mock.instances[0] as HTMLElement;
      expect(target.textContent).toBe('Roster');
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});
