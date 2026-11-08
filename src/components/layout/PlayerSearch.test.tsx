import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
  useSearchParams,
} from 'react-router-dom';
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

  describe('keyboard', () => {
    const renderWithRoutes = () =>
      render(
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<PlayerSearch />} />
            <Route path="/player/:playerId" element={<Player />} />
          </Routes>
        </MemoryRouter>,
      );

    beforeEach(() => {
      vi.mocked(loadDataForYears).mockResolvedValue([
        {
          year: 2020,
          picks: [
            pick('SmitAa00', 'Aaron Smith', 2020),
            pick('SmitBo00', 'Bob Smith', 2020),
            pick('SmitCy00', 'Cy Smith', 2020),
          ],
        },
      ] as never);
    });

    const typeQuery = async (value: string) => {
      const input = screen.getByRole('combobox', { name: 'Search players' });
      fireEvent.change(input, { target: { value } });
      await screen.findByRole('button', { name: /Aaron Smith/ });
      return input;
    };

    it('moves a highlighted option with the arrow keys', async () => {
      renderWithRoutes();
      const input = await typeQuery('smith');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const selected = screen.getByRole('option', { selected: true });
      expect(selected).toHaveTextContent('Bob Smith');
      expect(input).toHaveAttribute('aria-activedescendant', selected.id);
      expect(input).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
        'Aaron Smith',
      );
    });

    it('stops at the ends of the list', async () => {
      renderWithRoutes();
      const input = await typeQuery('smith');

      for (let i = 0; i < 5; i++)
        fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
        'Cy Smith',
      );
    });

    it('opens the highlighted option on Enter', async () => {
      renderWithRoutes();
      const input = await typeQuery('smith');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('player page SmitBo00')).toBeInTheDocument();
    });

    it('still opens the first result on Enter with nothing highlighted', async () => {
      renderWithRoutes();
      const input = await typeQuery('smith');

      expect(
        screen.queryByRole('option', { selected: true }),
      ).not.toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(screen.getByText('player page SmitAa00')).toBeInTheDocument();
    });

    it('drops the highlight when the query changes', async () => {
      renderWithRoutes();
      const input = await typeQuery('smith');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.change(input, { target: { value: 'smit' } });

      expect(
        screen.queryByRole('option', { selected: true }),
      ).not.toBeInTheDocument();
    });
  });

  it('keeps the reader’s year range and origin when opening a player', async () => {
    function PlayerWithSearch() {
      const [params] = useSearchParams();
      return (
        <div>
          player range {params.get('from')}-{params.get('to')} from{' '}
          {params.get('ref')}
        </div>
      );
    }
    render(
      <MemoryRouter initialEntries={['/?from=2023&to=2025']}>
        <Routes>
          <Route path="/" element={<PlayerSearch />} />
          <Route path="/player/:playerId" element={<PlayerWithSearch />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Search players'), {
      target: { value: 'mayf' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /Sam Mayfield/ }),
    );

    expect(
      screen.getByText('player range 2023-2025 from /?from=2023&to=2025'),
    ).toBeInTheDocument();
  });
});
