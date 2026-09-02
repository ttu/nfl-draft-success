import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScoreBreakdown } from './ScoreBreakdown';
import { makePick, makeSeason } from '../../../test/factories';
import { formatOverSlot } from '../../../lib/formatOverSlot';
import { getPlayerDraftSkill } from '../../../lib/draftSlotBaseline';
import type { DraftPick } from '../../../types';

/** Anthony Richardson, QB, IND 2023: three seasons, all injury-shortened. */
const injuredQb: DraftPick = makePick({
  playerName: 'Anthony Richardson',
  position: 'QB',
  round: 1,
  overallPick: 4,
  teamId: 'IND',
  draftYear: 2023,
  seasons: [
    makeSeason({
      year: 2023,
      gamesPlayed: 4,
      snapShare: 0.6525,
      cumulativeSnapShare: 0.4842,
      injuryReportWeeks: 2,
      reserveWeeks: 12,
      excusedGames: 12,
    }),
    makeSeason({
      year: 2024,
      gamesPlayed: 11,
      snapShare: 0.9255,
      cumulativeSnapShare: 0.8815,
      injuryReportWeeks: 6,
      excusedGames: 2,
    }),
    makeSeason({
      year: 2025,
      gamesPlayed: 2,
      snapShare: 0.115,
      cumulativeSnapShare: 0.0444,
      injuryReportWeeks: 3,
      reserveWeeks: 12,
      excusedGames: 12,
    }),
  ],
});

function renderBreakdown(pick = injuredQb, draftingTeamOnly = true) {
  return render(
    <ScoreBreakdown pick={pick} draftingTeamOnly={draftingTeamOnly} />,
  );
}

describe('ScoreBreakdown', () => {
  it('stays collapsed until asked, so the math never crowds the table', () => {
    renderBreakdown();

    const toggle = screen.getByTestId('score-breakdown-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('score-breakdown')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('score-breakdown')).toBeInTheDocument();
  });

  it('collapses again on a second click', () => {
    renderBreakdown();
    const toggle = screen.getByTestId('score-breakdown-toggle');

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('score-breakdown')).not.toBeInTheDocument();
  });

  it('shows one worked row per season played', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    for (const year of [2023, 2024, 2025]) {
      expect(
        screen.getByTestId(`score-breakdown-season-${year}`),
      ).toBeInTheDocument();
    }
  });

  // The panel's only job is to be checkable. Rounding each term off the exact
  // float instead of off the printed one put 34.3 + 7.1 next to a season score
  // of 41.3, which is the "this page is broken" reading it exists to prevent.
  it('prints season terms that add up to the season score', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    for (const year of [2023, 2024, 2025]) {
      const row = screen.getByTestId(`score-breakdown-season-${year}`);
      const [snap, availability] = Array.from(
        row.querySelectorAll('.score-breakdown__term-points'),
      ).map((el) => Number(el.textContent));
      const shown = Number(
        row.querySelector('.score-breakdown__season-score')!.textContent,
      );

      expect(snap + availability).toBeCloseTo(shown, 5);
    }
  });

  it('prints a division that resolves to the number it shows', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    const seasonScores = [2023, 2024, 2025].map((year) =>
      Number(
        screen
          .getByTestId(`score-breakdown-season-${year}`)
          .querySelector('.score-breakdown__season-score')!.textContent,
      ),
    );
    const terms = screen.getByText(/=/, {
      selector: '.score-breakdown__sum-terms',
    }).textContent!;
    const total = Number(terms.split('=')[1]);

    expect(total).toBeCloseTo(
      seasonScores.reduce((a, b) => a + b, 0),
      5,
    );
    // 129.5 ÷ 3 = 43.17, which rounds to the 43 the hero shows.
    expect(total / 3).toBeCloseTo(43.17, 2);
  });

  it('calls a tenure past the rookie deal what it is, not a longer window', () => {
    // A sixth-rounder gets a four-season window; six retained seasons divide by
    // six, and labelling that a "6-season rookie window" invents a contract.
    const longTenure = makePick({
      position: 'K',
      round: 6,
      overallPick: 188,
      draftYear: 2020,
      seasons: [2020, 2021, 2022, 2023, 2024, 2025].map((year) =>
        makeSeason({ year, snapShare: 0.43 }),
      ),
    });
    renderBreakdown(longTenure);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    expect(
      screen.getByText(
        /6 seasons with the drafting team, past his 4-season rookie window/,
      ),
    ).toBeInTheDocument();
  });

  it('drops the position bar term for a specialist, who divides by nothing', () => {
    const kicker = makePick({
      position: 'K',
      seasons: [makeSeason({ year: 2023, snapShare: 0.43 })],
    });
    renderBreakdown(kicker);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    const math = document.querySelector('.score-breakdown__term-math')!;
    expect(math).toHaveTextContent('43.0% × 0.7');
    expect(math).not.toHaveTextContent('position bar');
  });

  it('names the clamped denominator and the window it came from', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    // Drafted 2023, three seasons elapsed, first-round window of five.
    expect(
      screen.getByText(/3 seasons elapsed, of a 5-season rookie window/),
    ).toBeInTheDocument();
  });

  it('explains that an injury forgives Load but not availability', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    const notes = screen.getAllByTestId('score-breakdown-injury');
    expect(notes).toHaveLength(3);
    expect(notes[2]).toHaveTextContent(/12 excused/);
    expect(notes[2]).toHaveTextContent(
      /games he missed while on the injury report or on injured reserve/,
    );
    expect(notes[2]).toHaveTextContent(/Availability is not adjusted/);
  });

  it('omits the injury note for a season with no injury signal', () => {
    const healthy = makePick({
      position: 'ZZ',
      seasons: [makeSeason({ year: 2023, gamesPlayed: 17 })],
    });
    renderBreakdown(healthy);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    expect(
      screen.queryByTestId('score-breakdown-injury'),
    ).not.toBeInTheDocument();
  });

  it('subtracts the draft-slot expectation to show over slot', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    expect(screen.getByText(/expected at pick 4/)).toBeInTheDocument();
    expect(screen.getByText(/over slot/)).toBeInTheDocument();
  });

  it('prints an over-slot line that resolves and matches the hero badge', () => {
    renderBreakdown();
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    const line = document.querySelector(
      '.score-breakdown__overslot',
    )!.textContent!;
    // Read positionally rather than by pattern: the line is
    // "43.3 − 77.1 expected at pick 4 = −33.8 over slot", and a regex over
    // adjacent number groups backtracks badly for no benefit here.
    const tokens = line.trim().split(/\s+/);
    const [score, , expected] = tokens;
    const overSlot = tokens[tokens.indexOf('=') + 1];
    // The minus sign here is U+2212, not a hyphen.
    const signed = Number(overSlot.replace('−', '-').replace('+', ''));

    expect(Number(score) - Number(expected)).toBeCloseTo(signed, 5);
    // Same value the hero renders, so the two never contradict each other.
    expect(formatOverSlot(signed)).toBe(
      formatOverSlot(
        Math.round(
          getPlayerDraftSkill(injuredQb, { draftingTeamOnly: true }) * 10,
        ) / 10,
      ),
    );
  });

  it('marks a season played elsewhere as not counted', () => {
    const traded = makePick({
      position: 'ZZ',
      draftYear: 2023,
      seasons: [
        makeSeason({ year: 2023 }),
        makeSeason({ year: 2024, retained: false, currentTeam: 'SEA' }),
      ],
    });
    renderBreakdown(traded);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    expect(screen.getByTestId('score-breakdown-season-2024')).toHaveTextContent(
      /Played for SEA — not counted/,
    );
  });

  describe('a career that ends in free agency', () => {
    /** Out of the league: on nobody's roster, so no team and no snaps. */
    const faSeason = (year: number) =>
      makeSeason({ year, gamesPlayed: 0, snapShare: 0, retained: false });

    const washedOut = makePick({
      position: 'ZZ',
      round: 3,
      overallPick: 66,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021 }),
        makeSeason({ year: 2022, gamesPlayed: 0, snapShare: 0 }),
        faSeason(2023),
        faSeason(2024),
      ],
    });

    it('folds the trailing unsigned years into one entry', () => {
      renderBreakdown(washedOut);
      fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

      const row = screen.getByTestId('score-breakdown-fa-run-2023-2024');
      expect(row).toHaveTextContent('2023–2024');
      expect(row).toHaveTextContent(/not on a roster — not counted/i);
      expect(
        screen.queryByTestId('score-breakdown-season-2023'),
      ).not.toBeInTheDocument();
    });

    it('leaves the seasons he played as their own entries', () => {
      renderBreakdown(washedOut);
      fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

      for (const year of [2021, 2022]) {
        expect(
          screen.getByTestId(`score-breakdown-season-${year}`),
        ).toBeInTheDocument();
      }
    });

    it('says a lone unsigned year was on no roster, not on another team', () => {
      const released = makePick({
        position: 'ZZ',
        draftYear: 2023,
        seasons: [makeSeason({ year: 2023 }), faSeason(2024)],
      });
      renderBreakdown(released);
      fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

      const row = screen.getByTestId('score-breakdown-season-2024');
      expect(row).toHaveTextContent(/not on a roster — not counted/i);
      expect(row).not.toHaveTextContent(/played for/i);
    });

    it('leaves the entries alone in career mode, where each is an addend', () => {
      renderBreakdown(washedOut, false);
      fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

      expect(screen.queryByTestId(/^score-breakdown-fa-run/)).toBeNull();
      expect(
        screen.getByTestId('score-breakdown-season-2023'),
      ).toBeInTheDocument();
    });
  });

  it('renders nothing for a pick with no seasons to explain', () => {
    renderBreakdown(makePick({ seasons: [] }));

    expect(
      screen.queryByTestId('score-breakdown-toggle'),
    ).not.toBeInTheDocument();
  });
});

describe('a quarterback who sat behind a veteran', () => {
  /** The Jordan Love shape: three years on the bench, then QB1. */
  const love: DraftPick = makePick({
    playerName: 'Jordan Love',
    position: 'QB',
    round: 1,
    overallPick: 26,
    teamId: 'GB',
    draftYear: 2020,
    seasons: [
      makeSeason({ year: 2020, gamesPlayed: 1, snapShare: 0.01 }),
      makeSeason({ year: 2021, gamesPlayed: 2, snapShare: 0.06 }),
      makeSeason({ year: 2022, gamesPlayed: 2, snapShare: 0.03 }),
      makeSeason({
        year: 2023,
        gamesPlayed: 17,
        teamGames: 17,
        snapShare: 0.99,
      }),
      makeSeason({
        year: 2024,
        gamesPlayed: 15,
        teamGames: 17,
        snapShare: 0.97,
      }),
    ],
  });

  const openPanel = (pick: DraftPick) => {
    render(<ScoreBreakdown pick={pick} draftingTeamOnly />);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));
  };

  it('still lists the bench years, so the panel does not open mid-career', () => {
    // They leave both halves of the division, but dropping the rows would open
    // a 2020 first-rounder's math at 2023 with nothing to say why.
    openPanel(love);
    expect(screen.getByTestId('score-breakdown-apprentice-2020')).toBeTruthy();
    expect(screen.getByTestId('score-breakdown-apprentice-2022')).toBeTruthy();
  });

  it('does not add the bench years to the sum as zeros', () => {
    // A gap year is a zero the window charges; a bench year is outside the
    // window, so printing "0.0 +" for it would show a penalty never applied.
    openPanel(love);
    const terms = screen.getByText(/=/, {
      selector: '.score-breakdown__sum-terms',
    }).textContent;
    expect(terms?.startsWith('0.0')).toBe(false);
    expect(terms?.split('+').length).toBe(2);
  });

  it('says the denominator is seasons since he won the job', () => {
    openPanel(love);
    expect(
      screen.getByText(/since he won the job, after 3 on the bench/),
    ).toBeTruthy();
  });
});

describe('ScoreBreakdown rested finale', () => {
  /** A starter whose team clinched and sat him in the finale. */
  const rested = makePick({
    position: 'ZZ',
    seasons: [
      makeSeason({
        year: 2023,
        gamesPlayed: 19,
        teamGames: 19,
        snapShare: 0.9,
        restGame: {
          playerGames: 0,
          playerShareSum: 0,
          playerSnaps: 0,
          teamSnaps: 100,
        },
      }),
    ],
  });

  it('explains why the schedule reads one game short', () => {
    renderBreakdown(rested);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    const note = screen.getByTestId('score-breakdown-rest');
    expect(note).toHaveTextContent(/rested/i);
    expect(note).toHaveTextContent(/19 games/);
  });

  it('omits the note for a season with no rested finale', () => {
    renderBreakdown(
      makePick({
        position: 'ZZ',
        seasons: [makeSeason({ year: 2023, gamesPlayed: 17 })],
      }),
    );
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

    expect(
      screen.queryByTestId('score-breakdown-rest'),
    ).not.toBeInTheDocument();
  });
});

describe('ScoreBreakdown injury wording', () => {
  const injuredIn = (o: Partial<Parameters<typeof makeSeason>[0]> = {}) =>
    makePick({
      draftYear: 2019,
      seasons: [
        makeSeason({
          year: 2019,
          gamesPlayed: 5,
          teamGames: 16,
          snapShare: 0.992,
          cumulativeSnapShare: 0.992,
          ...o,
        }),
      ],
    });

  /** The note reports games excused, never a week count. */
  const injuryNote = (pick: DraftPick) => {
    renderBreakdown(pick);
    fireEvent.click(screen.getByTestId('score-breakdown-toggle'));
    return screen.getAllByTestId('score-breakdown-injury')[0];
  };

  it('says how many missed games the reserve list documented', () => {
    const note = injuryNote(injuredIn({ reserveWeeks: 11, excusedGames: 11 }));

    expect(note).toHaveTextContent(
      '11 excused (games he missed while on injured reserve)',
    );
    // Never the week counts themselves: they measure documentation, not games.
    expect(note).not.toHaveTextContent('11 weeks on injured reserve');
  });

  it('names both sources when both documented part of the absence', () => {
    const note = injuryNote(
      injuredIn({ injuryReportWeeks: 4, reserveWeeks: 8, excusedGames: 11 }),
    );

    // The union of the two, intersected with the games he missed — the note
    // must not read as a contest one of them won, nor invite adding them.
    expect(note).toHaveTextContent(
      '11 excused (games he missed while on the injury report or on injured reserve)',
    );
  });

  it('names only the injury report when that is the whole record', () => {
    const note = injuryNote(
      injuredIn({ injuryReportWeeks: 11, excusedGames: 9 }),
    );

    expect(note).toHaveTextContent(
      '9 excused (games he missed while on the injury report)',
    );
  });

  it('keeps the snap-shape wording for a pre-2016 season', () => {
    const note = injuryNote(
      makePick({
        draftYear: 2014,
        seasons: [
          makeSeason({
            year: 2014,
            gamesPlayed: 5,
            teamGames: 16,
            snapShare: 0.992,
            cumulativeSnapShare: 0.992,
            injuryReportWeeks: 2,
            seasonEndingAbsenceGames: 11,
          }),
        ],
      }),
    );

    expect(note).toHaveTextContent('11 excused (games after his last snap)');
  });
});
