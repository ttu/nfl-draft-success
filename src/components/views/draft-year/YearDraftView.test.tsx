import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { YearDraftView } from './YearDraftView';
import type { DraftClass } from '../../../types';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';

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

describe('YearDraftView', () => {
  it('renders the year headline and picks in draft order', () => {
    render(
      <MemoryRouter>
        <YearDraftView draftClass={draftClass} draftingTeamOnly />
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
        <YearDraftView draftClass={draftClass} draftingTeamOnly />
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
});
