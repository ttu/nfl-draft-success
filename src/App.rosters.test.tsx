import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';
import { TEAMS } from './data/teams';
import { ROSTER_SEASON } from './lib/currentRoster';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

const upcoming = makeSeason({
  year: ROSTER_SEASON,
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

const { default: App } = await import('./App');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('/rosters', () => {
  it('ranks every team by current roster score on a deep link', async () => {
    renderAt('/rosters');
    const board = await screen.findByRole('region', {
      name: 'Current roster rankings',
    });
    expect(within(board).getAllByRole('row').slice(1)).toHaveLength(
      TEAMS.length,
    );
    expect(within(board).getByText('Roster score')).toBeInTheDocument();
  });

  it('is reachable from the masthead tab after Position', async () => {
    renderAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    const tabs = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(tabs[tabs.indexOf('Position') + 1]).toBe('Rosters');

    fireEvent.click(within(nav).getByRole('button', { name: 'Rosters' }));
    expect(
      await screen.findByRole('region', { name: 'Current roster rankings' }),
    ).toBeInTheDocument();
  });
});
