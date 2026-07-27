import { describe, it, expect } from 'vitest';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { PlayerList } from './PlayerList';
import { makePick, makeSeason } from '../../test/factories';

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
    pick: makePick({
      playerId: 'p1',
      playerName: 'Patrick Mahomes',
      position: 'QB',
      overallPick: 10,
      seasons: [makeSeason({ year: 2018, teamGames: 16, snapShare: 0.98 })],
    }),
    draftYear: 2017,
  },
  {
    pick: makePick({
      playerId: 'p2',
      playerName: 'Backup QB',
      position: 'QB',
      round: 7,
      overallPick: 245,
      seasons: [
        makeSeason({
          year: 2018,
          gamesPlayed: 0,
          teamGames: 16,
          snapShare: 0,
        }),
      ],
    }),
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

    // Pick tag: R{round}·{overallPick} — the draft year is redundant here
    // because the roster is already grouped under a "Draft {year}" heading.
    expect(screen.getByText('R1·10')).toBeInTheDocument();
    expect(screen.getByText('R7·245')).toBeInTheDocument();
    expect(screen.queryByText(/'1[78]/)).not.toBeInTheDocument();

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

  it('shows each pick’s over-slot value, signed by whether it beat its draft position', () => {
    const { container } = render(<PlayerList picks={mockPicks} teamId="KC" />);

    const cells = container.querySelectorAll('.roster-table__overslot');
    expect(cells).toHaveLength(2);
    // #10 pick who plays every snap outperforms its slot → positive (+).
    expect(cells[0].textContent).toMatch(/^\+/);
    // #245 pick who never plays falls short of its slot → negative (− U+2212).
    expect(cells[1].textContent).toMatch(/^−/);
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
        pick: makePick({
          playerId: 'p3',
          playerName: 'Traded Away',
          position: 'WR',
          round: 2,
          overallPick: 40,
          seasons: [
            makeSeason({ year: 2022, snapShare: 0.7 }),
            makeSeason({
              year: 2023,
              gamesPlayed: 17,
              snapShare: 0.8,
              retained: false,
              currentTeam: 'NYG',
            }),
          ],
        }),
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
    const halfTimeSeason = () =>
      makeSeason({ year: 2020, teamGames: 16, snapShare: 0.5 });
    const crossConference = [
      {
        pick: makePick({
          playerId: 'buf-1',
          playerName: 'Buf Player',
          position: 'WR',
          teamId: 'BUF',
          seasons: [halfTimeSeason()],
        }),
        draftYear: 2020,
      },
      {
        pick: makePick({
          playerId: 'kc-2',
          playerName: 'KC Player',
          position: 'CB',
          overallPick: 2,
          seasons: [halfTimeSeason()],
        }),
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
