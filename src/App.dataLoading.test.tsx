import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

/**
 * A single class inside the default range (2021+), enough for the rankings and
 * team views to render. The assertions here are about *which* data files a view
 * requests, not about the numbers derived from them.
 */
const CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'greg-rousseau',
        playerName: 'Greg Rousseau',
        position: 'DE',
        overallPick: 30,
        teamId: 'BUF',
        seasons: [
          makeSeason({
            year: 2021,
            gamesPlayed: 17,
            snapShare: 0.6,
            cumulativeSnapShare: 0.6,
          }),
        ],
      }),
    ],
  }),
];

const loadDataForYears = vi.fn(async (years: number[]) =>
  CLASSES.filter((dc) => years.includes(dc.year)),
);
const loadDefaultRankings = vi.fn(async () => ({ rankings: [] }));
const loadTeamSuccess = vi.fn(async () => ({
  from: 2018,
  to: 2025,
  teams: [],
}));
const loadLaggedRankings = vi.fn(async () => ({
  from: 2018,
  to: 2021,
  rankings: [],
}));
const loadDataMeta = vi.fn(async () => null);

vi.mock('./lib/loadData', () => ({
  loadDataForYears,
  loadDefaultRankings,
  loadTeamSuccess,
  loadLaggedRankings,
  loadDataMeta,
}));

// Import App AFTER the mock is registered.
const { default: App } = await import('./App');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Data loading priority', () => {
  it('requests the pre-generated rankings that paint the rankings page', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Team draft rankings');
    expect(loadDefaultRankings).toHaveBeenCalled();
  });

  it('does not fetch correlation data on the rankings page', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    await screen.findByLabelText('Team draft rankings');

    // Only the team detail view renders the correlation row, so these two files
    // must not compete for bandwidth with the draft classes on first paint.
    expect(loadTeamSuccess).not.toHaveBeenCalled();
    expect(loadLaggedRankings).not.toHaveBeenCalled();
  });

  it('fetches correlation data on the team detail view', async () => {
    render(
      <MemoryRouter initialEntries={['/BUF']}>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(loadTeamSuccess).toHaveBeenCalled();
      expect(loadLaggedRankings).toHaveBeenCalled();
    });
  });
});
