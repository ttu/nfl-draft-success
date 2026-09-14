import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass, FreeAgentClass } from './types';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

/**
 * A single class inside the default range (2021+), enough for the team detail
 * view to render.
 */
const CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'greg-rousseau',
        playerName: 'Greg Rousseau',
        position: 'DE',
        overallPick: 30,
        teamId: 'BUF',
        seasons: [
          makeSeason({
            year: 2021,
            gamesPlayed: 17,
            snapShare: 0.6,
            cumulativeSnapShare: 0.6,
          }),
        ],
      }),
    ],
  }),
];

const loadDataForYears = vi.fn(async (years: number[]) =>
  CLASSES.filter((dc) => years.includes(dc.year)),
);
const loadDefaultRankings = vi.fn(async () => ({ rankings: [] }));
const loadTeamSuccess = vi.fn(async () => ({
  from: 2018,
  to: 2025,
  teams: [],
}));
const loadLaggedRankings = vi.fn(async () => ({
  from: 2018,
  to: 2021,
  rankings: [],
}));
const loadDataMeta = vi.fn(async () => null);

/**
 * One free-agent class inside the default range (2021), one well outside it
 * (2015) — the second exercises the all-years fallback the same way an
 * out-of-range draft pick already does. Filtered by year like
 * `loadDataForYears`'s mock, so both the default-range fetch and the
 * all-years fallback fetch resolve from the same fixture.
 */
const FREE_AGENT_CLASSES: FreeAgentClass[] = [
  {
    year: 2021,
    freeAgents: [
      {
        playerId: 'fa-in-range',
        playerName: 'Sam Overlooked',
        position: 'WR',
        teamId: 'BUF',
        draftYear: 2021,
        seasons: [makeSeason({ year: 2021 })],
      },
    ],
  },
  {
    year: 2015,
    freeAgents: [
      {
        playerId: 'fa-out-of-range',
        playerName: 'Old Undrafted',
        position: 'RB',
        teamId: 'KC',
        draftYear: 2015,
        seasons: [makeSeason({ year: 2015 })],
      },
    ],
  },
];

const loadFreeAgentsForYears = vi.fn(
  async (years: number[]): Promise<FreeAgentClass[]> =>
    FREE_AGENT_CLASSES.filter((fc) => years.includes(fc.year)),
);

vi.mock('./lib/loadData', () => ({
  loadDataForYears,
  loadDefaultRankings,
  loadTeamSuccess,
  loadLaggedRankings,
  loadDataMeta,
  loadFreeAgentsForYears,
}));

// Import App AFTER the mock is registered.
const { default: App } = await import('./App');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

/**
 * Undrafted players are opt-in. Seeding the persisted flag before render is
 * how a returning visitor arrives with the toggle already on, and it keeps
 * these tests about loading rather than about clicking a checkbox.
 */
const withFreeAgentsShown = () => {
  localStorage.setItem('nfl-draft-success-show-free-agents', 'true');
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('free agent loading', () => {
  it('files an undrafted player into his debut year’s roster group', async () => {
    withFreeAgentsShown();
    renderAt('/BUF');

    // He belongs to the same "Draft 2021" group as the picks, because that is
    // the year he debuted — the roster is one list per class, not two.
    expect(await screen.findByText('Sam Overlooked')).toBeInTheDocument();
    const group = document.getElementById('roster-year-2021');
    expect(group).not.toBeNull();
    expect(group).toHaveTextContent('Sam Overlooked');
    expect(group).toHaveTextContent('Greg Rousseau');
  });

  it('counts the undrafted separately in the year heading', async () => {
    withFreeAgentsShown();
    renderAt('/BUF');

    await screen.findByText('Sam Overlooked');
    // The count has to stay honest about which population is which.
    expect(document.getElementById('roster-year-2021')).toHaveTextContent(
      /1 picks · 1 undrafted/,
    );
  });

  it('still renders the team when fa data is missing', async () => {
    withFreeAgentsShown();
    loadFreeAgentsForYears.mockRejectedValueOnce(new Error('404'));

    renderAt('/BUF');

    expect(await screen.findByText('Greg Rousseau')).toBeInTheDocument();
    await waitFor(() => expect(loadFreeAgentsForYears).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the picks first and adds the undrafted when they arrive', async () => {
    withFreeAgentsShown();
    // A roster that is still loading its undrafted players says nothing about
    // them — the year heading counts picks only until they land.
    let resolveClasses: (classes: FreeAgentClass[]) => void = () => {};
    loadFreeAgentsForYears.mockReturnValueOnce(
      new Promise<FreeAgentClass[]>((resolve) => {
        resolveClasses = resolve;
      }),
    );

    renderAt('/BUF');

    expect(await screen.findByText('Greg Rousseau')).toBeInTheDocument();
    expect(screen.queryByText('Sam Overlooked')).toBeNull();
    expect(document.getElementById('roster-year-2021')).not.toHaveTextContent(
      /undrafted/i,
    );

    resolveClasses(FREE_AGENT_CLASSES.filter((fc) => fc.year === 2021));

    expect(await screen.findByText('Sam Overlooked')).toBeInTheDocument();
  });

  it('renders the roster without undrafted players when their data fails', async () => {
    withFreeAgentsShown();
    loadFreeAgentsForYears.mockRejectedValueOnce(new Error('404'));

    renderAt('/BUF');

    expect(await screen.findByText('Greg Rousseau')).toBeInTheDocument();
    await waitFor(() => expect(loadFreeAgentsForYears).toHaveBeenCalled());
    expect(screen.queryByText('Sam Overlooked')).toBeNull();
    expect(document.getElementById('roster-year-2021')).not.toHaveTextContent(
      /undrafted/i,
    );
  });
});

describe('free agent fetching is scoped to the views that read it', () => {
  it('does not fetch free agents for the league rankings landing page', async () => {
    renderAt('/');

    await waitFor(() => expect(loadDataForYears).toHaveBeenCalled());
    expect(loadFreeAgentsForYears).not.toHaveBeenCalled();
  });

  it('fetches them for the highlights view, which ranks them', async () => {
    renderAt('/highlights');

    await waitFor(() => expect(loadFreeAgentsForYears).toHaveBeenCalled());
  });

  it('fetches them for the team view once the roster asks for them', async () => {
    withFreeAgentsShown();
    renderAt('/BUF');

    await waitFor(() => expect(loadFreeAgentsForYears).toHaveBeenCalled());
  });

  it('does not fetch them for a team page that is not showing them', async () => {
    // Opt-in means opt-in all the way down: a roster with the toggle off must
    // not pay for a megabyte of class JSON it will not render.
    renderAt('/BUF');

    await waitFor(() => expect(loadDataForYears).toHaveBeenCalled());
    expect(await screen.findByText('Greg Rousseau')).toBeInTheDocument();
    expect(loadFreeAgentsForYears).not.toHaveBeenCalled();
    expect(screen.queryByText('Sam Overlooked')).toBeNull();
  });

  it('fetches them for the draft-year view, which lists them', async () => {
    renderAt('/year/2021');

    await waitFor(() => expect(loadFreeAgentsForYears).toHaveBeenCalled());
  });
});

describe('a free agent player route', () => {
  it('renders his detail page instead of the dead-end loading spinner', async () => {
    renderAt('/player/fa-in-range');

    expect(
      await screen.findByTestId('player-overall-score'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Sam Overlooked').length).toBeGreaterThan(0);
    expect(screen.queryByText(/loading player/i)).toBeNull();
  });

  it('resolves a free agent outside the current year range via the all-years fallback', async () => {
    renderAt('/player/fa-out-of-range');

    // Debuted in 2015, well before the default 2021+ range — only found once
    // the all-years fallback (mirroring the existing draft-pick one) fetches
    // every year of free-agent data, not just the default window.
    expect(
      await screen.findByTestId('player-overall-score'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Old Undrafted').length).toBeGreaterThan(0);
  });
});
