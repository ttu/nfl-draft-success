import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';

// Master dataset spanning the full YEAR_MIN..YEAR_MAX range. Josh Allen's 2018
// class sits BELOW the default range (2021+), so it is only ever returned when
// all years are requested — mirroring the real app's "search all years" fallback
// for an out-of-range player.
const ALL_CLASSES: DraftClass[] = [
  {
    year: 2018,
    picks: [
      {
        playerId: 'josh-allen',
        playerName: 'Josh Allen',
        position: 'QB',
        round: 1,
        overallPick: 7,
        teamId: 'BUF',
        seasons: [
          {
            year: 2018,
            gamesPlayed: 12,
            teamGames: 16,
            snapShare: 0.7,
            cumulativeSnapShare: 0.6,
            retained: true,
          },
        ],
      },
      {
        playerId: 'sam-darnold',
        playerName: 'Sam Darnold',
        position: 'QB',
        round: 1,
        overallPick: 3,
        teamId: 'NYJ',
        seasons: [
          {
            year: 2018,
            gamesPlayed: 13,
            teamGames: 16,
            snapShare: 0.5,
            cumulativeSnapShare: 0.3,
            retained: true,
          },
        ],
      },
    ],
  },
  {
    year: 2021,
    picks: [
      {
        playerId: 'trevor-lawrence',
        playerName: 'Trevor Lawrence',
        position: 'QB',
        round: 1,
        overallPick: 1,
        teamId: 'JAX',
        seasons: [
          {
            year: 2021,
            gamesPlayed: 17,
            teamGames: 17,
            snapShare: 0.95,
            cumulativeSnapShare: 0.9,
            retained: true,
          },
        ],
      },
    ],
  },
];

vi.mock('./lib/loadData', () => ({
  loadDataForYears: vi.fn(async (years: number[]) =>
    ALL_CLASSES.filter((dc) => years.includes(dc.year)),
  ),
  loadDefaultRankings: vi.fn(async () => ({ rankings: [] })),
  loadDataMeta: vi.fn(async () => null),
}));

// Import App AFTER the mock is registered.
const { default: App } = await import('./App');

beforeEach(() => {
  localStorage.clear();
});

describe('Player detail: out-of-range player cohort', () => {
  it('shows the draft-class cohort even when the player is below the current year range', async () => {
    render(
      <MemoryRouter initialEntries={['/player/josh-allen']}>
        <App />
      </MemoryRouter>,
    );

    // Hero renders once the all-years fallback resolves the pick.
    expect(await screen.findByText('Josh Allen')).toBeInTheDocument();

    // The "ranked by load" cohort must be populated from the 2018 class.
    const cohortHead = await screen.findByText(/2018 class · ranked by load/i);
    const cohort = cohortHead.closest('section') as HTMLElement;
    expect(cohort).not.toBeNull();
    expect(within(cohort).getByText('Sam Darnold')).toBeInTheDocument();
    expect(within(cohort).getByText(/of 2/)).toBeInTheDocument();
  });
});
