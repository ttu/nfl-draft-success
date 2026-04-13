import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YearDraftView } from './YearDraftView';
import type { DraftClass } from '../types';

const draftClass: DraftClass = {
  year: 2020,
  picks: [
    {
      playerId: 'joe-burrow',
      playerName: 'Joe Burrow',
      position: 'QB',
      round: 1,
      overallPick: 1,
      teamId: 'CIN',
      seasons: [
        {
          year: 2020,
          gamesPlayed: 10,
          teamGames: 16,
          snapShare: 0.95,
          retained: true,
        },
      ],
    },
    {
      playerId: 'chase-young',
      playerName: 'Chase Young',
      position: 'DE',
      round: 1,
      overallPick: 2,
      teamId: 'WAS',
      seasons: [
        {
          year: 2020,
          gamesPlayed: 15,
          teamGames: 16,
          snapShare: 0.8,
          retained: true,
        },
      ],
    },
  ],
};

describe('YearDraftView', () => {
  it('renders title and pick order (all teams)', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          onShowRankings={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /2020 NFL Draft — all picks/i }),
    ).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /draft picks/i });
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Joe Burrow/);
    expect(items[1]).toHaveTextContent(/Chase Young/);
    expect(list).toBeInTheDocument();
  });
});
