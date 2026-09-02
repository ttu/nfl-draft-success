import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';
import { DRAFT_YEAR_BOUNDS } from './lib/draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

/** The "where he stands" row update-data writes for the season ahead. */
const upcoming = makeSeason({
  year: CURRENT,
  gamesPlayed: 0,
  teamGames: 0,
  snapShare: 0,
  retained: true,
});

const CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'roster-starter',
        playerName: 'Roster Starter',
        position: 'QB',
        overallPick: 1,
        teamId: 'BUF',
        seasons: [makeSeason({ year: 2021 }), upcoming],
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

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('/roster/:teamId', () => {
  it('renders the team roster for a deep link', async () => {
    renderAt('/roster/BUF');
    expect(await screen.findByText('Roster Starter')).toBeInTheDocument();
    expect(await screen.findByText(/Current roster/)).toBeInTheDocument();
  });

  it('loads every shipped class, not just the selected range', async () => {
    renderAt('/roster/BUF');
    await screen.findByText('Roster Starter');
    const requested = loadDataForYears.mock.calls.map((c) => c[0]);
    expect(
      requested.some(
        (years) =>
          years.includes(DRAFT_YEAR_BOUNDS.min) &&
          years.includes(DRAFT_YEAR_BOUNDS.max),
      ),
    ).toBe(true);
  });

  it('redirects an unknown team to the rankings', async () => {
    renderAt('/roster/ZZZ');
    await screen.findByRole('button', { name: 'Rankings' });
    expect(screen.queryByText(/Current roster/)).toBeNull();
  });
});

describe('the team roster breadcrumb', () => {
  it('goes up to the league-wide board, not the draft rankings', async () => {
    renderAt('/roster/BUF');
    await screen.findByText('Roster Starter');

    const up = screen.getByRole('button', { name: '← Rosters' });
    fireEvent.click(up);

    expect(
      await screen.findByRole('region', { name: 'Current roster rankings' }),
    ).toBeInTheDocument();
  });
});
