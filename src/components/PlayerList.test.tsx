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

  it('expands career breakdown and shows season table', () => {
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
    const statsLink = within(firstCard).getByTestId('player-stats-link');
    expect(statsLink).toHaveAttribute(
      'href',
      'https://www.pro-football-reference.com/players/M/p1.htm',
    );
  });

  it('shows Pro Football Reference link when awaiting season data but player id is known', () => {
    const picks = [
      {
        pick: {
          playerId: 'AbcdJo00',
          playerName: 'John Abcdef',
          position: 'WR',
          round: 3,
          overallPick: 99,
          teamId: 'DAL',
          seasons: [],
        } as DraftPick,
        draftYear: 2026,
      },
    ];
    render(<PlayerList picks={picks} teamId="DAL" />);
    const card = screen.getByRole('listitem');
    fireEvent.click(within(card).getByRole('button', { name: /John Abcdef/i }));
    const link = within(card).getByTestId('player-stats-link');
    expect(link).toHaveAttribute(
      'href',
      'https://www.pro-football-reference.com/players/A/AbcdJo00.htm',
    );
  });

  it('does not show Pro Football Reference link for placeholder unknown-* ids', () => {
    const picks = [
      {
        pick: {
          playerId: 'unknown-2026-0',
          playerName: 'Rookie Player',
          position: 'QB',
          round: 1,
          overallPick: 1,
          teamId: 'KC',
          seasons: [],
        } as DraftPick,
        draftYear: 2026,
      },
    ];
    render(<PlayerList picks={picks} teamId="KC" />);
    const card = screen.getByRole('listitem');
    fireEvent.click(
      within(card).getByRole('button', { name: /Rookie Player/i }),
    );
    expect(
      within(card).queryByTestId('player-stats-link'),
    ).not.toBeInTheDocument();
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

  it('shows em dashes for GP, snap, and load on FA seasons in career table', () => {
    const faPicks = [
      {
        pick: {
          playerId: 'p-fa-dash',
          playerName: 'FA Dash',
          position: 'QB',
          round: 1,
          overallPick: 1,
          teamId: 'ARI',
          seasons: [
            {
              year: 2022,
              gamesPlayed: 1,
              teamGames: 17,
              snapShare: 0.1,
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
    render(<PlayerList picks={faPicks} teamId="ARI" draftingTeamOnly />);
    const card = screen.getByRole('listitem');
    fireEvent.click(within(card).getByRole('button', { name: /FA Dash/i }));
    const panel = within(card).getByTestId('player-career-panel');
    const rows = within(panel).getAllByRole('row');
    // header + 2022 team row + 2023 FA row
    expect(rows).toHaveLength(3);
    const faRow = rows[2];
    const cells = within(faRow).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('2023');
    expect(cells[1]).toHaveTextContent('FA');
    expect(cells[2]).toHaveTextContent('—');
    expect(cells[3]).toHaveTextContent('—');
    expect(cells[4]).toHaveTextContent('—');
    expect(cells[5]).toHaveTextContent('—');
  });

  it('collapses trailing consecutive FA seasons to the first FA row', () => {
    const multiFaPicks = [
      {
        pick: {
          playerId: 'p-fa-trail',
          playerName: 'Trailing FA',
          position: 'QB',
          round: 1,
          overallPick: 10,
          teamId: 'ARI',
          seasons: [
            {
              year: 2021,
              gamesPlayed: 4,
              teamGames: 17,
              snapShare: 0.11,
              retained: false,
              currentTeam: 'ATL',
            },
            {
              year: 2022,
              gamesPlayed: 0,
              teamGames: 17,
              snapShare: 0,
              retained: false,
            },
            {
              year: 2023,
              gamesPlayed: 0,
              teamGames: 17,
              snapShare: 0,
              retained: false,
            },
            {
              year: 2024,
              gamesPlayed: 0,
              teamGames: 17,
              snapShare: 0,
              retained: false,
            },
          ],
        } as DraftPick,
        draftYear: 2018,
      },
    ];
    render(<PlayerList picks={multiFaPicks} teamId="ARI" draftingTeamOnly />);
    const card = screen.getByRole('listitem');
    fireEvent.click(within(card).getByRole('button', { name: /Trailing FA/i }));
    const panel = within(card).getByTestId('player-career-panel');
    const rows = within(panel).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[2]).getAllByRole('cell')[0]).toHaveTextContent('2022');
    expect(screen.queryByText('2023')).not.toBeInTheDocument();
    expect(screen.queryByText('2024')).not.toBeInTheDocument();
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

  it('uses each pick’s drafting team for branding when brandByDraftingTeam is set', () => {
    const crossConference: typeof mockPicks = [
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
  });

  it('yearDraftBoard shows drafting team in meta and skips departed dimming', () => {
    const departedPick = {
      pick: {
        playerId: 'gone-1',
        playerName: 'Gone Player',
        position: 'WR',
        round: 3,
        overallPick: 90,
        teamId: 'DET',
        seasons: [
          {
            year: 2023,
            gamesPlayed: 14,
            teamGames: 17,
            snapShare: 0.45,
            retained: true,
          },
          {
            year: 2024,
            gamesPlayed: 8,
            teamGames: 17,
            snapShare: 0.4,
            retained: false,
            currentTeam: 'CHI',
          },
        ],
      } as DraftPick,
      draftYear: 2022,
    };
    render(
      <PlayerList
        picks={[departedPick]}
        teamId="DET"
        brandByDraftingTeam
        yearDraftBoard
      />,
    );
    const card = screen.getByRole('listitem');
    expect(card.className).not.toContain('player-card--departed');
    expect(screen.getByText('DET')).toBeInTheDocument();
    expect(screen.getByText(/→/)).toBeInTheDocument();
    expect(screen.getByText(/CHI/)).toBeInTheDocument();
  });
});
