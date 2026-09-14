import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YearDraftView } from './YearDraftView';
import type { DraftClass, FreeAgentClass } from '../../../types';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';
import { stampFreeAgentYear } from '../../../lib/freeAgentClass';

const draftClass: DraftClass = makeDraftClass({
  year: 2020,
  picks: [
    makePick({
      playerId: 'joe-burrow',
      playerName: 'Joe Burrow',
      position: 'QB',
      teamId: 'CIN',
      seasons: [
        makeSeason({
          year: 2020,
          gamesPlayed: 10,
          teamGames: 16,
          snapShare: 0.95,
        }),
      ],
    }),
    makePick({
      playerId: 'chase-young',
      playerName: 'Chase Young',
      position: 'DE',
      overallPick: 2,
      teamId: 'WAS',
      seasons: [
        makeSeason({
          year: 2020,
          gamesPlayed: 15,
          teamGames: 16,
          snapShare: 0.8,
        }),
      ],
    }),
  ],
});

const freeAgentClasses: FreeAgentClass[] = [
  stampFreeAgentYear({
    year: 2020,
    freeAgents: [
      {
        playerId: 'undrafted-starter',
        playerName: 'Undrafted Starter',
        position: 'WR',
        teamId: 'BUF',
        seasons: [
          makeSeason({
            year: 2020,
            gamesPlayed: 14,
            teamGames: 16,
            snapShare: 0.7,
          }),
        ],
      },
    ],
  }),
];

describe('YearDraftView', () => {
  it('renders the year headline and picks in draft order', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '2020' })).toBeInTheDocument();
    expect(screen.getByText('The Class Of')).toBeInTheDocument();

    const burrow = screen.getByText('Joe Burrow');
    const young = screen.getByText('Chase Young');
    expect(burrow).toBeInTheDocument();
    expect(young).toBeInTheDocument();
    // Pick 1 (Burrow) is rendered before pick 2 (Young)
    expect(
      burrow.compareDocumentPosition(young) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the whole-class summary tiles', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={[]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Avg. score')).toBeInTheDocument();
    expect(screen.getByText('Core starters')).toBeInTheDocument();
    expect(screen.getByText('Misses')).toBeInTheDocument();
    // One QB (Burrow), no WRs in the fixture.
    expect(screen.getByText('QBs taken')).toBeInTheDocument();
    expect(screen.getByText('WRs taken')).toBeInTheDocument();
    expect(screen.getByText('Retention')).toBeInTheDocument();
    // Both fixture picks are retained → 100%.
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('keeps the all-rounds summary stats unchanged when free agents are present', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={freeAgentClasses}
        />
      </MemoryRouter>,
    );
    // Same picks-only fixture as the tile test above: `all rounds` figures
    // must be identical whether or not a free-agent class is supplied.
    expect(screen.getByText('Retention').nextSibling).toHaveTextContent('100%');
    expect(screen.getByText('QBs taken').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('WRs taken').nextSibling).toHaveTextContent('0');
  });

  it('lists the year’s undrafted free agents after the later rounds', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={freeAgentClasses}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /undrafted/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Undrafted Starter')).toBeInTheDocument();
  });

  it('describes the undrafted cohort by debut, never by a signing', () => {
    // The cohort is bucketed by the season a player first took a snap. Nothing
    // in the data says who signed him, or when.
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={freeAgentClasses}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('debuted, this class')).toBeInTheDocument();
    expect(screen.queryByText(/signed, this class/i)).not.toBeInTheDocument();
  });

  it('omits the undrafted block entirely for a year with no free agent data', () => {
    render(
      <MemoryRouter>
        <YearDraftView
          draftClass={draftClass}
          draftingTeamOnly
          freeAgentClasses={[]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('heading', { name: /undrafted/i }),
    ).not.toBeInTheDocument();
  });
});
