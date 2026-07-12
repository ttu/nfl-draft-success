import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PositionDraftView } from './PositionDraftView';
import type { DraftClass } from '../../../types';

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
  it('shows a compact single-year window in the kicker', () => {
    render(
      <MemoryRouter>
        <PositionDraftView
          position="TE"
          yearFrom={2021}
          yearTo={2021}
          draftClasses={[classes[1]]}
          draftingTeamOnly
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /Tight end, ranked by/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Position File · TE · 2021/)).toBeInTheDocument();
    expect(screen.queryByText(/2020–2021/)).not.toBeInTheDocument();
  });

  it('renders a year range and ranks picks in one table', () => {
    render(
      <MemoryRouter>
        <PositionDraftView
          position="TE"
          yearFrom={2020}
          yearTo={2021}
          draftClasses={classes}
          draftingTeamOnly
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /Tight end, ranked by/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Position File · TE · 2020–2021/),
    ).toBeInTheDocument();

    const alpha = screen.getByText('Alpha');
    const beta = screen.getByText('Beta');
    expect(alpha).toBeInTheDocument();
    expect(beta).toBeInTheDocument();
    // Equal-score picks keep draft order: 2020 (Alpha) before 2021 (Beta)
    expect(
      alpha.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
