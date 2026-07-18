import { describe, it, expect } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { PlayerList } from './PlayerList';
import type { DraftPick } from '../../types';

// PlayerList rows navigate via useNavigate, so render inside a Router. A tiny
// location probe lets us assert where a row click sends the user.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const render = (ui: ReactElement) =>
  rtlRender(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

const mockPicks = [
  {
    pick: {
      playerId: 'p1',
      playerName: 'Patrick Mahomes',
      position: 'QB',
      round: 1,
      overallPick: 10,
      teamId: 'KC',
      seasons: [
        {
          year: 2018,
          gamesPlayed: 16,
          teamGames: 16,
          snapShare: 0.98,
          retained: true,
        },
      ],
    } as DraftPick,
    draftYear: 2017,
  },
  {
    pick: {
      playerId: 'p2',
      playerName: 'Backup QB',
      position: 'QB',
      round: 7,
      overallPick: 245,
      teamId: 'KC',
      seasons: [
        {
          year: 2018,
          gamesPlayed: 0,
          teamGames: 16,
          snapShare: 0,
          retained: true,
        },
      ],
    } as DraftPick,
    draftYear: 2018,
  },
];

describe('PlayerList', () => {
  it('renders a row per pick with name, position, pick tag, and role', () => {
    render(<PlayerList picks={mockPicks} teamId="KC" />);

    expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument();
    expect(screen.getByText('Backup QB')).toBeInTheDocument();

    // Position chips
    expect(screen.getAllByText('QB')).toHaveLength(2);

    // Pick tag: 'YY R{round}·{overallPick}
    expect(screen.getByText(/R1·10/)).toBeInTheDocument();
    expect(screen.getByText(/R7·245/)).toBeInTheDocument();

    // Role labels derived from snap share
    expect(screen.getByText('Core Starter')).toBeInTheDocument();
    expect(screen.getByText('Non-Contributor')).toBeInTheDocument();

    // One <tr> per pick
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('shows a per-pick draft score for each row', () => {
    const { container } = render(<PlayerList picks={mockPicks} teamId="KC" />);

    const scores = container.querySelectorAll('.roster-table__score');
    expect(scores).toHaveLength(2);
    // A full-snap, ever-present starter scores well above a zero-snap backup.
    const mahomes = Number(scores[0].textContent);
    const backup = Number(scores[1].textContent);
    expect(backup).toBe(0);
    expect(mahomes).toBeGreaterThan(backup);
  });

  it('renders an empty-state message when there are no picks', () => {
    render(<PlayerList picks={[]} teamId="KC" />);
    expect(screen.getByText('No picks to show.')).toBeInTheDocument();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  it('navigates to the player detail route when a row is clicked', () => {
    render(<PlayerList picks={mockPicks} teamId="KC" />);
    fireEvent.click(screen.getByText('Patrick Mahomes'));
    expect(screen.getByTestId('location')).toHaveTextContent('/player/p1');
  });

  it('marks departed players with their current team, drafting-team role, and a Departed chip', () => {
    const departedPicks = [
      {
        pick: {
          playerId: 'p3',
          playerName: 'Traded Away',
          position: 'WR',
          round: 2,
          overallPick: 40,
          teamId: 'KC',
          seasons: [
            {
              year: 2022,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.7,
              retained: true,
            },
            {
              year: 2023,
              gamesPlayed: 17,
              teamGames: 17,
              snapShare: 0.8,
              retained: false,
              currentTeam: 'NYG',
            },
          ],
        } as DraftPick,
        draftYear: 2022,
      },
    ];
    render(<PlayerList picks={departedPicks} teamId="KC" draftingTeamOnly />);

    expect(screen.getByText('Traded Away')).toBeInTheDocument();
    // Current team is shown after the name
    expect(screen.getByText(/→ NYG/)).toBeInTheDocument();
    // Departed players still carry the "Departed" chip
    expect(screen.getByText('Departed')).toBeInTheDocument();
    // ...and also show the role they held for the drafting team
    // (drafting-team-only seasons classify this player as a Core Starter).
    expect(screen.getByText('Core Starter')).toBeInTheDocument();
  });

  it('renders every pick when brandByDraftingTeam is set', () => {
    const crossConference = [
      {
        pick: {
          playerId: 'buf-1',
          playerName: 'Buf Player',
          position: 'WR',
          round: 1,
          overallPick: 1,
          teamId: 'BUF',
          seasons: [
            {
              year: 2020,
              gamesPlayed: 16,
              teamGames: 16,
              snapShare: 0.5,
              retained: true,
            },
          ],
        } as DraftPick,
        draftYear: 2020,
      },
      {
        pick: {
          playerId: 'kc-2',
          playerName: 'KC Player',
          position: 'CB',
          round: 1,
          overallPick: 2,
          teamId: 'KC',
          seasons: [
            {
              year: 2020,
              gamesPlayed: 16,
              teamGames: 16,
              snapShare: 0.5,
              retained: true,
            },
          ],
        } as DraftPick,
        draftYear: 2020,
      },
    ];
    render(
      <PlayerList picks={crossConference} teamId="KC" brandByDraftingTeam />,
    );
    expect(screen.getByText('Buf Player')).toBeInTheDocument();
    expect(screen.getByText('KC Player')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});
