import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import type { DraftClass } from './types';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

const CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'josh-allen',
        playerName: 'Josh Allen',
        position: 'QB',
        overallPick: 7,
        teamId: 'BUF',
        seasons: [makeSeason({ year: 2021, gamesPlayed: 17, snapShare: 0.9 })],
      }),
    ],
  }),
];

vi.mock('./lib/loadData', () => ({
  loadDataForYears: vi.fn(async (years: number[]) =>
    CLASSES.filter((dc) => years.includes(dc.year)),
  ),
  loadDefaultRankings: vi.fn(async () => ({ rankings: [] })),
  loadTeamSuccess: vi.fn(async () => ({ from: 2018, to: 2025, teams: [] })),
  loadLaggedRankings: vi.fn(async () => ({
    from: 2018,
    to: 2021,
    rankings: [],
  })),
  loadDataMeta: vi.fn(async () => null),
}));

const { default: App } = await import('./App');

/**
 * Surfaces how the current entry was reached, to tell a pop from a push, and
 * stands in for the browser's Back button (MemoryRouter has no real history).
 */
function NavigationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="nav">
        {navigationType} {location.pathname}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        browser back
      </button>
    </>
  );
}

function renderAt(entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <NavigationProbe />
      <App />
    </MemoryRouter>,
  );
}

const nav = () => screen.getByTestId('nav').textContent ?? '';

beforeEach(() => {
  localStorage.clear();
});

describe('Player detail back crumb', () => {
  it('pops back to the origin list when the player was opened from it', async () => {
    renderAt(['/BUF?from=2021&to=2025']);

    const row = await screen.findByText('Josh Allen');
    fireEvent.click(row);
    await screen.findByRole('button', { name: /←/ });

    fireEvent.click(screen.getByRole('button', { name: /←/ }));

    // A real history pop: the roster entry is restored, not pushed afresh, so
    // it reopens at the scroll offset it was left at.
    await waitFor(() => expect(nav()).toBe('POP /BUF'));
  });

  it('leaves one Back press between the player and the list it was opened from', async () => {
    renderAt(['/BUF?from=2021&to=2025']);

    fireEvent.click(await screen.findByText('Josh Allen'));
    await screen.findByRole('button', { name: /←/ });

    // The player view backfills the default year range onto its own URL. That
    // correction must not become a history entry of its own.
    fireEvent.click(screen.getByRole('button', { name: 'browser back' }));
    await waitFor(() => expect(nav()).toBe('POP /BUF'));
  });

  it('pushes to the origin when the player was opened from a shared link', async () => {
    // No prior entry to retrace — the ref only names where the crumb points.
    renderAt(['/player/josh-allen?ref=%2FBUF%3Ffrom%3D2021%26to%3D2025']);

    fireEvent.click(await screen.findByRole('button', { name: /←/ }));

    await waitFor(() => expect(nav()).toBe('PUSH /BUF'));
  });
});
