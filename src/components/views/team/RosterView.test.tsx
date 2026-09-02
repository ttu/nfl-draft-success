import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { RosterView } from './RosterView';
import { DRAFT_YEAR_BOUNDS } from '../../../lib/draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

const upcoming = (overrides: { retained: boolean; currentTeam?: string }) =>
  makeSeason({
    year: CURRENT,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

const played = makeSeason({ year: CURRENT - 1 });

const renderView = (ui: ReactElement) =>
  render(<MemoryRouter initialEntries={['/roster/BUF']}>{ui}</MemoryRouter>);

const classes = [
  makeDraftClass({
    year: CURRENT - 2,
    picks: [
      makePick({
        overallPick: 1,
        teamId: 'BUF',
        position: 'QB',
        playerName: 'Josh Starter',
        seasons: [played, upcoming({ retained: true })],
      }),
      makePick({
        overallPick: 2,
        teamId: 'JAX',
        position: 'CB',
        playerName: 'Traded Corner',
        seasons: [played, upcoming({ retained: false, currentTeam: 'BUF' })],
      }),
      makePick({
        overallPick: 3,
        teamId: 'BUF',
        position: 'WR',
        playerName: 'Gone Receiver',
        seasons: [played, upcoming({ retained: false, currentTeam: 'KC' })],
      }),
    ],
  }),
  makeDraftClass({
    year: CURRENT,
    picks: [
      makePick({
        overallPick: 4,
        teamId: 'BUF',
        position: 'QB',
        playerName: 'Rookie Passer',
        seasons: [],
      }),
    ],
  }),
];

describe('RosterView', () => {
  it('lists players currently on the team and omits those who left', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(screen.getByText('Josh Starter')).toBeInTheDocument();
    expect(screen.getByText('Traded Corner')).toBeInTheDocument();
    expect(screen.queryByText('Gone Receiver')).not.toBeInTheDocument();
  });

  it('groups by position group in depth-chart order', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Quarterbacks', 'Defensive backs']);
  });

  it('marks a player his team did not draft', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const row = screen.getByText('Traded Corner').closest('tr');
    expect(row).not.toBeNull();
    // Twice over: the draft-origin column a wide screen shows, and the line
    // inside the name cell that stands in for it once that column collapses.
    expect(within(row as HTMLElement).getAllByText(/from JAX/)).toHaveLength(2);
  });

  it('repeats the collapsing columns inside the name cell', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const row = screen.getByText('Josh Starter').closest('tr') as HTMLElement;
    const meta = row.querySelector('.roster-row__meta');
    expect(meta?.textContent).toContain(`${CURRENT - 2} · R1`);
    expect(meta?.textContent).toContain('1 yr');
    expect(
      row.querySelector('.roster-row__role')?.textContent,
    ).not.toHaveLength(0);
  });

  it('shows a player with no played seasons as awaiting data', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const row = screen.getByText('Rookie Passer').closest('tr');
    expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('links each player to his profile', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(
      screen.getByRole('link', { name: 'Josh Starter' }).getAttribute('href'),
    ).toContain('/player/');
  });

  it('says the page covers tracked draftees only', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(
      screen.getByText(
        new RegExp(`drafted ${DRAFT_YEAR_BOUNDS.min}.${DRAFT_YEAR_BOUNDS.max}`),
      ),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no tracked player is on the roster', () => {
    renderView(<RosterView teamId="NYJ" draftClasses={classes} />);
    expect(screen.getByText(/No tracked draftees/)).toBeInTheDocument();
  });

  it('says the roster snapshot has not been published yet when no pick has one', () => {
    const noSnapshotClasses = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({
            overallPick: 1,
            teamId: 'BUF',
            position: 'QB',
            playerName: 'Josh Starter',
            seasons: [played],
          }),
        ],
      }),
    ];
    renderView(<RosterView teamId="BUF" draftClasses={noSnapshotClasses} />);
    expect(screen.queryByText(/No tracked draftees/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/roster snapshot.*has not been published/i),
    ).toBeInTheDocument();
  });
});
