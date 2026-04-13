import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('expands career breakdown and exposes Pro Football Reference stats link', () => {
    render(<PlayerList picks={mockPicks} teamId="KC" />);
    const firstCard = screen.getAllByRole('listitem')[0];
    const toggle = within(firstCard).getByRole('button', {
      name: /Patrick Mahomes/i,
    });
    expect(
      within(firstCard).queryByTestId('player-career-panel'),
    ).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const panel = within(firstCard).getByTestId('player-career-panel');
    expect(panel).toBeVisible();
    expect(
      within(panel).getByRole('columnheader', { name: /season/i }),
    ).toBeInTheDocument();
    expect(within(panel).getByText('2018')).toBeInTheDocument();
    const stats = within(firstCard).getByTestId('player-stats-link');
    expect(stats).toHaveAttribute(
      'href',
      'https://www.pro-football-reference.com/players/M/p1.htm',
    );
  });

  it('renders departed players with current team badge and departed class', () => {
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
    // Team journey shows teams after drafting team (drafting team is omitted)
    expect(screen.queryByText(/→.*KC/)).not.toBeInTheDocument();
    expect(screen.getByText(/→.*NYG/)).toBeInTheDocument();
    const card = screen.getByRole('listitem');
    expect(card.className).toContain('player-card--departed');
  });

  it('shows FA for departed players with no currentTeam', () => {
    const faPicks = [
      {
        pick: {
          playerId: 'p4',
          playerName: 'Free Agent Guy',
          position: 'RB',
          round: 5,
          overallPick: 150,
          teamId: 'KC',
          seasons: [
            {
              year: 2022,
              gamesPlayed: 10,
              teamGames: 17,
              snapShare: 0.4,
              retained: true,
            },
            {
              year: 2023,
              gamesPlayed: 0,
              teamGames: 17,
              snapShare: 0,
              retained: false,
            },
          ],
        } as DraftPick,
        draftYear: 2022,
      },
    ];
    render(<PlayerList picks={faPicks} teamId="KC" draftingTeamOnly />);
    // Team journey shows FA (drafting team KC is omitted); FA has no role badge
    expect(screen.queryByText(/→.*KC/)).not.toBeInTheDocument();
    expect(screen.getByText(/→.*FA/)).toBeInTheDocument();
    expect(document.querySelectorAll('.player-card__stint-role')).toHaveLength(
      0,
    );
  });

  it('shows role classification for each team in departed player journey', () => {
    const departedPicks = [
      {
        pick: {
          playerId: 'p6',
          playerName: 'Role Journey',
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
              gamesPlayed: 10,
              teamGames: 17,
              snapShare: 0.2,
              retained: false,
              currentTeam: 'NYG',
            },
          ],
        } as DraftPick,
        draftYear: 2022,
      },
    ];
    render(<PlayerList picks={departedPicks} teamId="KC" draftingTeamOnly />);
    // The NYG stint had snapShare 0.2 → contributor tier (abbreviated as "Ct")
    const stintRoles = document.querySelectorAll('.player-card__stint-role');
    expect(stintRoles).toHaveLength(1);
    expect(stintRoles[0].textContent).toBe('Ct');
    expect(stintRoles[0].getAttribute('title')).toBe('Contributor');
  });

  it('shows full team journey for players who moved through multiple teams', () => {
    const multiTeamPicks = [
      {
        pick: {
          playerId: 'p5',
          playerName: 'Journey Man',
          position: 'QB',
          round: 1,
          overallPick: 3,
          teamId: 'CLE',
          seasons: [
            {
              year: 2018,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: true,
            },
            {
              year: 2019,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: true,
            },
            {
              year: 2020,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: false,
              currentTeam: 'CAR',
            },
            {
              year: 2021,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: false,
              currentTeam: 'TB',
            },
            {
              year: 2022,
              gamesPlayed: 16,
              teamGames: 17,
              snapShare: 0.95,
              retained: false,
              currentTeam: 'TB',
            },
          ],
        } as DraftPick,
        draftYear: 2018,
      },
    ];
    render(<PlayerList picks={multiTeamPicks} teamId="CLE" draftingTeamOnly />);
    // Drafting team CLE is omitted from journey
    expect(screen.queryByText(/→.*CLE/)).not.toBeInTheDocument();
    expect(screen.getByText(/→.*CAR/)).toBeInTheDocument();
    expect(screen.getByText(/→.*TB/)).toBeInTheDocument();
  });
});
