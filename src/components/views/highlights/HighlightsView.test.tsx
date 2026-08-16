import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HighlightsView } from './HighlightsView';
import type { LeagueHighlights } from '../../../lib/getLeagueHighlights';
import type { RankedPlayer } from '../../../lib/careerShapeHighlights';
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

/** One row for a list the lib already formatted (headline and detail included). */
const ranked = (
  playerId: string,
  playerName: string,
  headline: string,
  detail: string,
): RankedPlayer => ({
  pick: samplePick({ playerId, playerName, round: 3, overallPick: 90 }),
  team: lions,
  draftYear: 2022,
  value: 1,
  headline,
  detail,
});

/** One player highlight for the value band. */
const valueRow = (
  playerId: string,
  playerName: string,
  overSlot: number,
): LeagueHighlights['steals'][number] => ({
  pick: samplePick({ playerId, playerName, round: 3, overallPick: 90 }),
  team: lions,
  draftYear: 2022,
  score: 70,
  overSlot,
});

/**
 * The bands a test does not care about. Every list is populated, so a case that
 * asserts on one empty list can override just that list and still get exactly
 * one empty state on the page.
 */
const defaultHighlights: LeagueHighlights = {
  steals: [valueRow('d-steal', 'Default Steal', 20)],
  busts: [valueRow('d-bust', 'Default Bust', -20)],
  mostCoreStarters: null,
  dayOneStarters: [ranked('d-day', 'Danny Dayone', '82%', 'rookie year')],
  lateBloomers: [
    ranked('d-bloom', 'Larry Bloom', '+64', '2 yrs buried · 18% → 82%'),
  ],
  ironMen: [ranked('d-iron', 'Ike Iron', '4', "full seasons · '21–'24")],
  snakebit: [ranked('d-snake', 'Stan Snake', '21', '84% when active')],
  gotAway: [ranked('d-away', 'Gary Gone', '+31', '40 → 71 with CHI')],
  keptTheBand: [
    {
      teamId: 'DET',
      team: lions,
      kept: 7,
      keepers: 8,
      rate: 7 / 8,
    },
  ],
};

function renderView(highlights: Partial<LeagueHighlights> = {}) {
  return render(
    <MemoryRouter>
      <HighlightsView
        highlights={{ ...defaultHighlights, ...highlights }}
        startYear={2021}
        endYear={2025}
        onTeamSelect={() => {}}
      />
    </MemoryRouter>,
  );
}

/** Two steals, one bust and a leading team — the fully populated value band. */
const standoutHighlights: Partial<LeagueHighlights> = {
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

/** The list card with this kicker, so a spotlight copy cannot satisfy a row assertion. */
const list = (kicker: string) =>
  within(screen.getByRole('article', { name: kicker }));

const spotlights = () =>
  within(screen.getByRole('region', { name: /steal and bust of the window/i }));

describe('HighlightsView', () => {
  it('renders ranked steal and bust lists plus the most-core-starters leader', () => {
    renderView(standoutHighlights);

    const steals = list('Steals of the window');
    expect(steals.getByText('Sam Steal')).toBeInTheDocument();
    expect(steals.getByText('Second Steal')).toBeInTheDocument();
    // Over slot leads each row; the raw score sits on the meta line.
    expect(steals.getByText('+52.1')).toBeInTheDocument();
    expect(steals.getByText('+37.4')).toBeInTheDocument();
    expect(steals.getByText(/R5 #150/)).toBeInTheDocument();
    expect(steals.getByText(/score 88/)).toBeInTheDocument();

    const busts = list('Biggest busts');
    expect(busts.getByText('Bill Bust')).toBeInTheDocument();
    expect(busts.getByText('−71.3')).toBeInTheDocument();
    expect(busts.getByText(/score 12/)).toBeInTheDocument();

    expect(screen.getByText('Most core starters produced')).toBeInTheDocument();
    expect(screen.getByText('Philadelphia Eagles')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('leads with the top steal and bust as full-width spotlights', () => {
    renderView(standoutHighlights);

    const top = spotlights();
    expect(top.getByText('Steal of the window')).toBeInTheDocument();
    expect(top.getByText('Sam Steal')).toBeInTheDocument();
    expect(top.getByText('+52.1')).toBeInTheDocument();
    expect(top.getByText(/R5 #150/)).toBeInTheDocument();
    expect(top.getByText(/score 88/)).toBeInTheDocument();

    expect(top.getByText('Biggest bust of the window')).toBeInTheDocument();
    expect(top.getByText('Bill Bust')).toBeInTheDocument();
    expect(top.getByText('−71.3')).toBeInTheDocument();

    // The runner-up steal stays in the list; only the leader is spotlit.
    expect(top.queryByText('Second Steal')).not.toBeInTheDocument();
  });

  it('opens the player behind a spotlight', () => {
    renderView(standoutHighlights);

    expect(
      spotlights().getByRole('button', { name: 'View Sam Steal' }),
    ).toBeInTheDocument();
  });

  it('drops a spotlight when its list has no picks', () => {
    renderView({ ...standoutHighlights, busts: [] });

    const top = spotlights();
    expect(top.getByText('Steal of the window')).toBeInTheDocument();
    expect(
      top.queryByText('Biggest bust of the window'),
    ).not.toBeInTheDocument();
  });

  it('shows no spotlight band at all when both value lists are empty', () => {
    renderView({ steals: [], busts: [] });

    expect(
      screen.queryByRole('region', { name: /steal and bust of the window/i }),
    ).not.toBeInTheDocument();
  });

  it('puts the most-core-starters leader in the hero, above the bands', () => {
    renderView(standoutHighlights);

    const leader = screen.getByRole('button', {
      name: 'View Philadelphia Eagles',
    });
    expect(leader.closest('.page-hero')).not.toBeNull();
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
    expect(
      list('Steals of the window').getByText('Steal 0'),
    ).toBeInTheDocument();
    expect(
      list('Steals of the window').getByText('Steal 2'),
    ).toBeInTheDocument();
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

  it('renders the three bands in order', () => {
    renderView();

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Value',
      'Career shape',
      'Retention',
    ]);
  });

  it('renders each new list with its own detail line', () => {
    renderView();

    expect(screen.getByText('Day-one starters')).toBeInTheDocument();
    expect(screen.getByText('Late bloomers')).toBeInTheDocument();
    expect(screen.getByText('Iron men')).toBeInTheDocument();
    expect(screen.getByText('Snakebit')).toBeInTheDocument();
    expect(screen.getByText('The ones that got away')).toBeInTheDocument();
    expect(screen.getByText('Kept the band together')).toBeInTheDocument();

    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText(/· rookie year/)).toBeInTheDocument();
    expect(screen.getByText(/18% → 82%/)).toBeInTheDocument();
    expect(screen.getByText(/full seasons · '21–'24/)).toBeInTheDocument();
    expect(screen.getByText(/84% when active/)).toBeInTheDocument();
    expect(screen.getByText(/40 → 71 with CHI/)).toBeInTheDocument();
  });

  it('ranks the teams that kept their keepers', () => {
    renderView();

    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText(/7 of 8 keepers/)).toBeInTheDocument();
  });

  it('explains what blooming late requires', () => {
    renderView();

    expect(
      screen.getByText(/available for and barely used in/i),
    ).toBeInTheDocument();
  });

  it('says the lists count snaps, not how well anyone played', () => {
    renderView();

    expect(
      screen.getByText(/never how well anyone played/i),
    ).toBeInTheDocument();
  });

  it('shows an empty state rather than hiding a list with no picks', () => {
    renderView({ ironMen: [] });

    expect(
      screen.getByText('No picks with data in this window yet.'),
    ).toBeInTheDocument();
  });
});
