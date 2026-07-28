import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlayerDetailView } from './PlayerDetailView';
import type { DraftClass, DraftPick } from '../../../types';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';
import { getPlayerDraftSkill } from '../../../lib/draftSlotBaseline';
import { formatOverSlot } from '../../../lib/formatOverSlot';
import { LATEST_SEASON } from '../../../lib/rookieWindow';

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
    // #1 overall with a strong career still reads as below the top of the
    // draft. Derived from the baseline curve rather than hard-coded — the curve
    // is refitted whenever scoring changes, and a literal here would fail on
    // every refit without saying anything about this component.
    renderScorer();
    const overSlot = screen.getByTestId('player-over-slot');
    expect(overSlot.textContent).toBe(
      formatOverSlot(getPlayerDraftSkill(scorer, { draftingTeamOnly: false })),
    );
    // Rendered with a real minus sign (U+2212), not a hyphen.
    expect(overSlot.textContent!.startsWith('−')).toBe(true);
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

describe('PlayerDetailView rookie window', () => {
  // A first-rounder released after one season. The score divides by his full
  // five-year window, so four of those years have no row of their own — and
  // without them the table shows one season above a headline of ~18.
  const oneAndDone: DraftPick = makePick({
    playerId: 'bust',
    playerName: 'One And Done',
    position: 'ZZ',
    round: 1,
    overallPick: 17,
    teamId: 'LV',
    draftYear: 2021,
    seasons: [makeSeason({ year: 2021, gamesPlayed: 17, snapShare: 1 })],
  });

  function renderPick(pick: DraftPick, draftingTeamOnly = true) {
    render(
      <MemoryRouter>
        <PlayerDetailView
          pick={pick}
          draftYear={pick.draftYear}
          draftClasses={[
            makeDraftClass({ year: pick.draftYear, picks: [pick] }),
          ]}
          draftingTeamOnly={draftingTeamOnly}
        />
      </MemoryRouter>,
    );
  }

  it('renders a zero row for each rookie-window year the team did not get', () => {
    renderPick(oneAndDone);
    for (const year of [2022, 2023, 2024, 2025]) {
      expect(screen.getByTestId(`window-gap-${year}`)).toBeInTheDocument();
    }
    // The season he did play is a real row, not a gap.
    expect(screen.queryByTestId('window-gap-2021')).toBeNull();
  });

  it('names both halves of the division so the headline can be checked', () => {
    renderPick(oneAndDone);
    expect(screen.getByTestId('rookie-window-note')).toHaveTextContent(
      /1 of 1 seasons? counted · divided by a 5-season rookie window/i,
    );
  });

  it('marks seasons played elsewhere as not counting', () => {
    // The common case by far: the row exists and shows a real score, but it
    // belongs to another team and is not in the total above it.
    const traded: DraftPick = makePick({
      playerName: 'Moved On',
      round: 1,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021 }),
        makeSeason({ year: 2022, retained: false, currentTeam: 'CAR' }),
      ],
    });
    renderPick(traded);
    expect(screen.getByTestId('season-uncounted-2022')).toBeInTheDocument();
    expect(screen.queryByTestId('season-uncounted-2021')).toBeNull();
    expect(screen.getByTestId('rookie-window-note')).toHaveTextContent(
      /1 of 2 seasons counted/i,
    );
    // The ✕ must explain itself on the page. A title tooltip needs a second of
    // motionless hover on a 7px target, so it cannot be the only explanation.
    expect(screen.getByTestId('rookie-window-note')).toHaveTextContent(
      /played elsewhere, not counted/i,
    );
  });

  it('omits the marker key when every season counted', () => {
    renderPick(oneAndDone);
    expect(screen.getByTestId('rookie-window-note')).not.toHaveTextContent(
      /played elsewhere/i,
    );
  });

  it('counts every season in career mode, where nothing is excluded', () => {
    const traded: DraftPick = makePick({
      playerName: 'Moved On',
      round: 1,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021 }),
        makeSeason({ year: 2022, retained: false, currentTeam: 'CAR' }),
      ],
    });
    renderPick(traded, false);
    expect(screen.queryByTestId('season-uncounted-2022')).toBeNull();
  });

  it('leaves the table alone in career mode, where the window does not divide', () => {
    renderPick(oneAndDone, false);
    expect(screen.queryByTestId('window-gap-2022')).toBeNull();
    expect(screen.queryByTestId('rookie-window-note')).toBeNull();
  });

  it('adds no gaps for a pick who is still on the roster mid-window', () => {
    const onRoster: DraftPick = makePick({
      playerName: 'Still Here',
      round: 1,
      draftYear: 2024,
      seasons: [
        makeSeason({ year: 2024 }),
        makeSeason({ year: LATEST_SEASON }),
      ],
    });
    renderPick(onRoster);
    expect(screen.queryByTestId('window-gap-2026')).toBeNull();
  });
});
