import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PositionDraftView } from './PositionDraftView';
import type { DraftClass } from '../types';

const classes: DraftClass[] = [
  {
    year: 2020,
    picks: [
      {
        playerId: 'a',
        playerName: 'Alpha',
        position: 'TE',
        round: 1,
        overallPick: 1,
        teamId: 'CIN',
        seasons: [],
      },
    ],
  },
  {
    year: 2021,
    picks: [
      {
        playerId: 'b',
        playerName: 'Beta',
        position: 'TE',
        round: 2,
        overallPick: 40,
        teamId: 'KC',
        seasons: [],
      },
    ],
  },
];

describe('PositionDraftView', () => {
  it('renders year sections and picks in draft order', () => {
    render(
      <MemoryRouter>
        <PositionDraftView
          position="TE"
          yearFrom={2020}
          yearTo={2021}
          draftClasses={classes}
          draftingTeamOnly
          onShowRankings={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', {
        name: /Tight end \(TE\) — drafts 2020–2021/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2020' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2021' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent(/Alpha/);
    expect(items[1]).toHaveTextContent(/Beta/);
  });
});
