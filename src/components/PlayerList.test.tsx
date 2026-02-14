import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerList } from './PlayerList';
import type { DraftPick } from '../types';

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
  it('renders players with role labels, draft year, and position', () => {
    render(<PlayerList picks={mockPicks} teamId="KC" />);
    expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument();
    expect(screen.getByText('Backup QB')).toBeInTheDocument();
    expect(screen.getByText('RD 1')).toBeInTheDocument();
    expect(screen.getByText('RD 7')).toBeInTheDocument();
    expect(screen.getByText(/QB · Pick 10/)).toBeInTheDocument();
    expect(screen.getByText(/QB · Pick 245/)).toBeInTheDocument();
    expect(screen.getByText('Non Contributor')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
