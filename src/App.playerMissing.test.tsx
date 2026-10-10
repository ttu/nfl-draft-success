import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

// Master dataset spanning the full YEAR_MIN..YEAR_MAX range. Josh Allen's 2018
// class sits BELOW the default range (2021+), so it is only ever returned when
// all years are requested — mirroring the real app's "search all years" fallback
// for an out-of-range player.
const ALL_CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2018,
    picks: [
      makePick({
        playerId: 'josh-allen',
        playerName: 'Josh Allen',
        position: 'QB',
        overallPick: 7,
        teamId: 'BUF',
        seasons: [
          makeSeason({
            year: 2018,
            gamesPlayed: 12,
            teamGames: 16,
            snapShare: 0.7,
            cumulativeSnapShare: 0.6,
          }),
        ],
      }),
      makePick({
        playerId: 'sam-darnold',
        playerName: 'Sam Darnold',
        position: 'QB',
        overallPick: 3,
        teamId: 'NYJ',
        seasons: [
          makeSeason({
            year: 2018,
            gamesPlayed: 13,
            teamGames: 16,
            snapShare: 0.5,
            cumulativeSnapShare: 0.3,
          }),
        ],
      }),
    ],
  }),
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'trevor-lawrence',
        playerName: 'Trevor Lawrence',
        position: 'QB',
        teamId: 'JAX',
        seasons: [
          makeSeason({
            year: 2021,
            gamesPlayed: 17,
            snapShare: 0.95,
            cumulativeSnapShare: 0.9,
          }),
        ],
      }),
    ],
  }),
];

vi.mock('./lib/loadData', () => ({
  loadDataForYears: vi.fn(async (years: number[]) =>
    ALL_CLASSES.filter((dc) => years.includes(dc.year)),
  ),
  loadDefaultRankings: vi.fn(async () => ({ rankings: [] })),
  loadTeamSuccess: vi.fn(async () => ({ from: 2018, to: 2025, teams: [] })),
  loadLaggedRankings: vi.fn(async () => ({
    from: 2018,
    to: 2021,
    rankings: [],
  })),
  loadDataMeta: vi.fn(async () => null),
  loadFreeAgentsForYears: vi.fn(async () => []),
}));

// Import App AFTER the mock is registered.
const { default: App } = await import('./App');

beforeEach(() => {
  localStorage.clear();
});

describe('Player detail: an id that matches nobody', () => {
  it('says so once the all-years search is done, rather than spinning forever', async () => {
    render(
      <MemoryRouter initialEntries={['/player/nobody-at-all']}>
        <App />
      </MemoryRouter>,
    );

    // The spinner is honest while the all-years lookup is still out...
    expect(await screen.findByText(/no player here/i)).toBeInTheDocument();
    expect(screen.queryByText(/loading player/i)).toBeNull();
    // ...and the dead end offers a way back rather than stranding the reader.
    expect(
      screen.getByRole('link', { name: /back to the rankings/i }),
    ).toBeInTheDocument();
  });
});
