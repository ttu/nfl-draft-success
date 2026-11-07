import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { PlayerSearch } from './PlayerSearch';
import { loadDataForYears, loadFreeAgentsForYears } from '../../lib/loadData';

vi.mock('../../lib/loadData', () => ({
  loadDataForYears: vi.fn(),
  loadFreeAgentsForYears: vi.fn(),
}));

const pick = (playerId: string, playerName: string, draftYear: number) => ({
  playerId,
  playerName,
  position: 'QB',
  round: 1,
  overallPick: 1,
  teamId: 'CHI',
  draftYear,
});

function Player() {
  return <div>player page {useParams().playerId}</div>;
}

describe('PlayerSearch', () => {
  beforeEach(() => {
    vi.mocked(loadFreeAgentsForYears).mockResolvedValue([
      {
        year: 2020,
        freeAgents: [
          {
            playerId: 'UndrFa00',
            playerName: 'Walt Undrafted',
            position: 'WR',
            teamId: 'KC',
            draftYear: 2020,
          },
        ],
      },
    ] as never);
    vi.mocked(loadDataForYears).mockResolvedValue([
      { year: 2018, picks: [pick('MaySa00', 'Sam Mayfield', 2018)] },
      { year: 2024, picks: [pick('WillCa03', 'Caleb Williams', 2024)] },
    ] as never);
  });

  it('finds a player in any year and opens their page', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PlayerSearch />} />
          <Route path="/player/:playerId" element={<Player />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Search players'), {
      target: { value: 'mayf' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /Sam Mayfield/ }),
    );

    expect(screen.getByText('player page MaySa00')).toBeInTheDocument();
  });

  it('says so when nobody matches', async () => {
    render(
      <MemoryRouter>
        <PlayerSearch />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Search players'), {
      target: { value: 'zzz' },
    });

    expect(await screen.findByText('No players found.')).toBeInTheDocument();
  });

  it('finds undrafted players and labels them', async () => {
    render(
      <MemoryRouter>
        <PlayerSearch />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Search players'), {
      target: { value: 'walt' },
    });

    expect(
      await screen.findByText(/WR · KC · 2020\s+undrafted/),
    ).toBeInTheDocument();
  });
});
