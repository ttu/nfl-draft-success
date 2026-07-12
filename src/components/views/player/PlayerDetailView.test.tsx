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
