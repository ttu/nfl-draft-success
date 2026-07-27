import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerDetailView } from './PlayerDetailView';
import type { DraftClass, DraftPick } from '../../../types';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';

// Will Reichard, K, MIN 2024: high Avg snap (~40%) but low Load (~10%) because
// specialist load is measured against the team's full scrimmage + ST capacity.
// Role classification must use Avg snap for specialists (per the glossary), so
// each season should read as Significant, not Non-Contributor / Depth.
const kicker: DraftPick = makePick({
  playerId: 'will-reichard',
  playerName: 'Will Reichard',
  position: 'K',
  round: 6,
  overallPick: 203,
  teamId: 'MIN',
  seasons: [
    makeSeason({
      year: 2024,
      gamesPlayed: 14,
      teamGames: 18,
      snapShare: 0.4,
      cumulativeSnapShare: 0.0939,
    }),
    makeSeason({
      year: 2025,
      gamesPlayed: 17,
      snapShare: 0.3459,
      cumulativeSnapShare: 0.109,
    }),
  ],
});

const draftClasses: DraftClass[] = [
  makeDraftClass({ year: 2024, picks: [kicker] }),
];

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
        makeSeason({ year: 2024, snapShare: 0.5 }),
        makeSeason({
          year: 2025,
          snapShare: 0.5,
          retained: false,
          currentTeam: 'ATL',
        }),
      ],
    };
    render(
      <MemoryRouter>
        <PlayerDetailView
          pick={departed}
          draftYear={2024}
          draftClasses={[makeDraftClass({ year: 2024, picks: [departed] })]}
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

describe('PlayerDetailView season-ending injury marker', () => {
  // Nick Bosa 2020: ACL in week 2, straight to IR, so zero injury-report weeks.
  // The marker is what explains a forgiven Load with an empty IR wks cell.
  const injured: DraftPick = {
    ...kicker,
    position: 'DE',
    seasons: [
      makeSeason({
        year: 2024,
        gamesPlayed: 2,
        teamGames: 16,
        snapShare: 0.435,
        cumulativeSnapShare: 0.435,
        seasonEndingAbsenceGames: 14,
      }),
      makeSeason({
        year: 2025,
        gamesPlayed: 17,
        snapShare: 0.75,
        cumulativeSnapShare: 0.75,
      }),
    ],
  };

  function renderInjured() {
    render(
      <MemoryRouter>
        <PlayerDetailView
          pick={injured}
          draftYear={2024}
          draftClasses={[makeDraftClass({ year: 2024, picks: [injured] })]}
          draftingTeamOnly={false}
        />
      </MemoryRouter>,
    );
  }

  it('marks the season an injury ended', () => {
    renderInjured();
    const marker = screen.getByTestId('season-ending-injury-2024');
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveAccessibleDescription(/season ended by injury/i);
  });

  it('names the games missed so the empty IR wks cell makes sense', () => {
    renderInjured();
    expect(
      screen.getByTestId('season-ending-injury-2024'),
    ).toHaveAccessibleDescription(/14 games/i);
  });

  it('leaves seasons the player finished unmarked', () => {
    renderInjured();
    expect(screen.queryByTestId('season-ending-injury-2025')).toBeNull();
  });
});

describe('PlayerDetailView draft score', () => {
  // QB with two clean seasons so the scores are round numbers:
  //   2024: 0.7·1.0 + 0.3·(17/17) = 1.00 → 100
  //   2025: 0.7·0.5 + 0.3·(17/17) = 0.65 →  65
  //   overall = mean(100, 65) = 82.5 → 83
  const scorer: DraftPick = makePick({
    playerId: 'qb-scorer',
    playerName: 'Sample Scorer',
    position: 'QB',
    teamId: 'MIN',
    seasons: [
      makeSeason({ year: 2024, gamesPlayed: 17, snapShare: 1 }),
      makeSeason({ year: 2025, gamesPlayed: 17, snapShare: 0.5 }),
    ],
  });

  function renderScorer() {
    return render(
      <MemoryRouter>
        <PlayerDetailView
          pick={scorer}
          draftYear={2024}
          draftClasses={[makeDraftClass({ year: 2024, picks: [scorer] })]}
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

  it('shows a signed over-slot value in the hero, measured against the pick slot', () => {
    // #1 overall scoring 83 against a ~91 slot expectation: a strong career
    // still reads as below the top of the draft. Uses a real minus sign.
    renderScorer();
    const overSlot = screen.getByTestId('player-over-slot');
    expect(overSlot.textContent).toMatch(/^−8\./);
  });

  it('shows a positive over-slot for a late pick who outplays his slot', () => {
    // Will Reichard, K #203: mid-50s score against a ~30 slot expectation.
    renderView();
    const overSlot = screen.getByTestId('player-over-slot');
    expect(overSlot.textContent).toMatch(/^\+/);
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
          draftClasses={[makeDraftClass({ year: 2024, picks: [unmatched] })]}
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
