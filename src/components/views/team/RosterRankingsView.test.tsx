import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { RosterRankingsView } from './RosterRankingsView';
import { TEAMS } from '../../../data/teams';
import { ROSTER_SEASON } from '../../../lib/currentRoster';
import {
  makeDraftClass,
  makeDepthSeason,
  makePick,
  makeSeason,
} from '../../../test/factories';

const upcoming = (overrides: { retained: boolean; currentTeam?: string }) =>
  makeSeason({
    year: ROSTER_SEASON,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

const played = makeSeason({ year: ROSTER_SEASON - 1 });

const classes = [
  makeDraftClass({
    year: ROSTER_SEASON - 2,
    picks: [
      makePick({
        overallPick: 1,
        teamId: 'KC',
        seasons: [played, upcoming({ retained: true })],
      }),
      makePick({
        overallPick: 2,
        teamId: 'BUF',
        seasons: [
          makeDepthSeason({ year: ROSTER_SEASON - 1 }),
          upcoming({ retained: true }),
        ],
      }),
    ],
  }),
];

const renderView = (ui: ReactElement) =>
  render(<MemoryRouter initialEntries={['/rosters']}>{ui}</MemoryRouter>);

describe('RosterRankingsView', () => {
  it('lists every team, best roster score first', () => {
    renderView(
      <RosterRankingsView draftClasses={classes} freeAgentClasses={[]} />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(TEAMS.length);
    expect(within(rows[0]).getByText('KC')).toBeInTheDocument();
    expect(within(rows[1]).getByText('BUF')).toBeInTheDocument();
  });

  it('links each team to its own roster page', () => {
    renderView(
      <RosterRankingsView draftClasses={classes} freeAgentClasses={[]} />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: /KC/ })).toHaveAttribute(
      'href',
      '/roster/KC',
    );
  });

  it('shows an em dash for a team with no scored players', () => {
    renderView(
      <RosterRankingsView draftClasses={classes} freeAgentClasses={[]} />,
    );

    const rows = screen.getAllByRole('row').slice(1);
    const last = rows[rows.length - 1];
    expect(within(last).getByText('—')).toBeInTheDocument();
    expect(within(last).getByText('0')).toBeInTheDocument();
  });

  it('says so when the roster snapshot has not been published yet', () => {
    const stale = [
      makeDraftClass({
        year: ROSTER_SEASON - 2,
        picks: [makePick({ overallPick: 1, teamId: 'KC', seasons: [played] })],
      }),
    ];

    renderView(
      <RosterRankingsView draftClasses={stale} freeAgentClasses={[]} />,
    );

    const message = screen.getByText(/has not been published yet/i);
    expect(message).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Standing where the table would, so it keeps the page's side gutter —
    // left bare it printed flush against the viewport edge. The gutter is a
    // stylesheet fact with its own breakpoints, so the wrapper is what the
    // test can check.
    expect(message.closest('.rankings-table-wrap')).not.toBeNull();

    // Every hero figure keeps its caption, even with no roster to name: the
    // three sit on one baseline, and dropping a caption drops that block out
    // of line with the other two.
    const hero = screen.getByRole('region', { name: 'Current rosters' });
    expect(within(hero).getAllByText('roster score')).toHaveLength(2);
  });
});

describe('RosterRankingsView hero', () => {
  it('leads with the top roster, the league average, and the players counted', () => {
    renderView(
      <RosterRankingsView draftClasses={classes} freeAgentClasses={[]} />,
    );

    const hero = screen.getByRole('region', { name: 'Current rosters' });
    expect(within(hero).getByText('KC')).toBeInTheDocument();
    // KC's lone starter scores 100, BUF's lone depth player rather less; the
    // league average is the mean of the two teams that have a score at all.
    expect(within(hero).getByText('League average')).toBeInTheDocument();
    expect(within(hero).getByText('Tracked draftees')).toBeInTheDocument();
    expect(within(hero).getByText('2')).toBeInTheDocument();
  });
});
