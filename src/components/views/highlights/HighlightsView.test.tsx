import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HighlightsView } from './HighlightsView';
import type { LeagueHighlights } from '../../../lib/getLeagueHighlights';
import type { DraftPick } from '../../../types';
import { makePick, makeTeam } from '../../../test/factories';

const samplePick = (over: Partial<DraftPick>): DraftPick =>
  makePick({
    playerId: 'p1',
    playerName: 'Sam Steal',
    position: 'WR',
    round: 5,
    overallPick: 150,
    teamId: 'DET',
    ...over,
  });

const lions = makeTeam({ id: 'DET', name: 'Detroit Lions' });

function renderView(highlights: LeagueHighlights) {
  return render(
    <MemoryRouter>
      <HighlightsView
        highlights={highlights}
        startYear={2021}
        endYear={2025}
        onTeamSelect={() => {}}
      />
    </MemoryRouter>,
  );
}

describe('HighlightsView', () => {
  it('renders ranked steal and bust lists plus the most-core-starters leader', () => {
    const highlights: LeagueHighlights = {
      steals: [
        {
          pick: samplePick({
            playerName: 'Sam Steal',
            round: 5,
            overallPick: 150,
          }),
          team: lions,
          draftYear: 2022,
          score: 88,
          overSlot: 52.1,
        },
        {
          pick: samplePick({
            playerId: 'p1b',
            playerName: 'Second Steal',
            round: 4,
            overallPick: 120,
          }),
          team: lions,
          draftYear: 2021,
          score: 80,
          overSlot: 37.4,
        },
      ],
      busts: [
        {
          pick: samplePick({
            playerId: 'p2',
            playerName: 'Bill Bust',
            round: 1,
            overallPick: 3,
            teamId: 'CHI',
          }),
          team: makeTeam({ id: 'CHI', name: 'Chicago Bears' }),
          draftYear: 2021,
          score: 12,
          overSlot: -71.3,
        },
      ],
      mostCoreStarters: {
        teamId: 'PHI',
        team: makeTeam({ id: 'PHI', name: 'Philadelphia Eagles' }),
        count: 9,
      },
    };
    renderView(highlights);

    expect(screen.getByText('Steals of the window')).toBeInTheDocument();
    expect(screen.getByText('Sam Steal')).toBeInTheDocument();
    expect(screen.getByText('Second Steal')).toBeInTheDocument();
    // Over slot leads each row; the raw score sits on the meta line.
    expect(screen.getByText('+52.1')).toBeInTheDocument();
    expect(screen.getByText('+37.4')).toBeInTheDocument();
    expect(screen.getByText(/R5 #150/)).toBeInTheDocument();
    expect(screen.getByText(/score 88/)).toBeInTheDocument();

    expect(screen.getByText('Biggest busts')).toBeInTheDocument();
    expect(screen.getByText('Bill Bust')).toBeInTheDocument();
    expect(screen.getByText('−71.3')).toBeInTheDocument();
    expect(screen.getByText(/score 12/)).toBeInTheDocument();

    expect(screen.getByText('Most core starters')).toBeInTheDocument();
    expect(screen.getByText('Philadelphia Eagles')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('collapses long lists to three rows and expands on demand', () => {
    const steals: LeagueHighlights['steals'] = Array.from(
      { length: 12 },
      (_, i) => ({
        pick: samplePick({
          playerId: `steal-${i}`,
          playerName: `Steal ${i}`,
          round: 5,
          overallPick: 150 + i,
        }),
        team: lions,
        draftYear: 2022,
        score: 90 - i,
        overSlot: 50 - i,
      }),
    );
    renderView({ steals, busts: [], mostCoreStarters: null });

    // Collapsed: only the first three steals are shown.
    expect(screen.getByText('Steal 0')).toBeInTheDocument();
    expect(screen.getByText('Steal 2')).toBeInTheDocument();
    expect(screen.queryByText('Steal 3')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show top 12/i });
    fireEvent.click(toggle);

    // Expanded: the full list is visible and the toggle collapses again.
    expect(screen.getByText('Steal 11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.queryByText('Steal 11')).not.toBeInTheDocument();
  });

  it('shows no expand toggle when a list has three or fewer rows', () => {
    renderView({
      steals: [
        {
          pick: samplePick({ playerName: 'Only Steal' }),
          team: lions,
          draftYear: 2022,
          score: 88,
          overSlot: 52.1,
        },
      ],
      busts: [],
      mostCoreStarters: null,
    });
    expect(
      screen.queryByRole('button', { name: /show top/i }),
    ).not.toBeInTheDocument();
  });

  it('renders empty states when highlight lists are empty', () => {
    renderView({ steals: [], busts: [], mostCoreStarters: null });
    expect(screen.getAllByText(/no picks with data/i)).toHaveLength(2);
    expect(screen.getByText(/no core starters produced/i)).toBeInTheDocument();
  });
});
