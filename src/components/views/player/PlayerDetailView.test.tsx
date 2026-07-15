import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerDetailView } from './PlayerDetailView';
import type { DraftClass, DraftPick } from '../../../types';

// Will Reichard, K, MIN 2024: high Avg snap (~40%) but low Load (~10%) because
// specialist load is measured against the team's full scrimmage + ST capacity.
// Role classification must use Avg snap for specialists (per the glossary), so
// each season should read as Significant, not Non-Contributor / Depth.
const kicker: DraftPick = {
  playerId: 'will-reichard',
  playerName: 'Will Reichard',
  position: 'K',
  round: 6,
  overallPick: 203,
  teamId: 'MIN',
  seasons: [
    {
      year: 2024,
      gamesPlayed: 14,
      teamGames: 18,
      snapShare: 0.4,
      cumulativeSnapShare: 0.0939,
      retained: true,
    },
    {
      year: 2025,
      gamesPlayed: 17,
      teamGames: 17,
      snapShare: 0.3459,
      cumulativeSnapShare: 0.109,
      retained: true,
    },
  ],
};

const draftClasses: DraftClass[] = [{ year: 2024, picks: [kicker] }];

function renderView() {
  return render(
    <MemoryRouter>
      <PlayerDetailView
        pick={kicker}
        draftYear={2024}
        draftClasses={draftClasses}
        draftingTeamOnly={false}
      />
    </MemoryRouter>,
  );
}

describe('PlayerDetailView specialist role classification', () => {
  it('classifies each kicker season by Avg snap, not Load', () => {
    renderView();
    const table = screen.getByRole('table');
    // Both seasons have ~40% / ~35% avg snap → Significant for a specialist.
    expect(within(table).queryByText(/Non-Contributor/i)).toBeNull();
    expect(within(table).queryByText(/^Depth$/i)).toBeNull();
    expect(within(table).getAllByText(/Significant/i)).toHaveLength(2);
  });
});

describe('PlayerDetailView current-team indicator', () => {
  it('shows "now with" the current team when the player has departed', () => {
    const departed: DraftPick = {
      ...kicker,
      seasons: [
        {
          year: 2024,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.5,
          retained: true,
        },
        {
          year: 2025,
          gamesPlayed: 16,
          teamGames: 17,
          snapShare: 0.5,
          retained: false,
          currentTeam: 'ATL',
        },
      ],
    };
    render(
      <MemoryRouter>
        <PlayerDetailView
          pick={departed}
          draftYear={2024}
          draftClasses={[{ year: 2024, picks: [departed] }]}
          draftingTeamOnly={false}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/drafted by MIN/i)).toBeInTheDocument();
    // The hero pill names the current team (ATL also appears in the career
    // table's latest season row, so scope the assertion to the pill).
    const nowPill = screen.getByText(/now with/i).closest('.player-hero__now');
    expect(nowPill).toHaveTextContent('ATL');
  });

  it('does not show a current-team indicator when still with the drafting team', () => {
    renderView();
    expect(screen.queryByText(/now with/i)).toBeNull();
    expect(screen.queryByText(/now a free agent/i)).toBeNull();
  });
});

describe('PlayerDetailView draft score', () => {
  // QB with two clean seasons so the scores are round numbers:
  //   2024: 0.7·1.0 + 0.3·(17/17) = 1.00 → 100
  //   2025: 0.7·0.5 + 0.3·(17/17) = 0.65 →  65
  //   overall = mean(100, 65) = 82.5 → 83
  const scorer: DraftPick = {
    playerId: 'qb-scorer',
    playerName: 'Sample Scorer',
    position: 'QB',
    round: 1,
    overallPick: 1,
    teamId: 'MIN',
    seasons: [
      {
        year: 2024,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 1,
        retained: true,
      },
      {
        year: 2025,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 0.5,
        retained: true,
      },
    ],
  };

  function renderScorer() {
    return render(
      <MemoryRouter>
        <PlayerDetailView
          pick={scorer}
          draftYear={2024}
          draftClasses={[{ year: 2024, picks: [scorer] }]}
          draftingTeamOnly={false}
        />
      </MemoryRouter>,
    );
  }

  it('shows the overall draft score in the hero', () => {
    renderScorer();
    const score = screen.getByTestId('player-overall-score');
    expect(score).toHaveTextContent('83');
  });

  it('shows each season score in the career table', () => {
    renderScorer();
    const table = screen.getByRole('table');
    expect(within(table).getByText('100')).toBeInTheDocument();
    expect(within(table).getByText('65')).toBeInTheDocument();
  });
});

describe('PlayerDetailView Pro Football Reference link', () => {
  it('links to the PFR career page for a matched player id', () => {
    renderView();
    const link = screen.getByRole('link', {
      name: /Career stats on Pro Football Reference/i,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://www.pro-football-reference.com/players/R/will-reichard.htm',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('hides the link for unmatched (placeholder) player ids', () => {
    const unmatched: DraftPick = { ...kicker, playerId: 'unknown-123' };
    render(
      <MemoryRouter>
        <PlayerDetailView
          pick={unmatched}
          draftYear={2024}
          draftClasses={[{ year: 2024, picks: [unmatched] }]}
          draftingTeamOnly={false}
        />
      </MemoryRouter>,
    );
    expect(
      screen.queryByRole('link', {
        name: /Career stats on Pro Football Reference/i,
      }),
    ).toBeNull();
  });
});
