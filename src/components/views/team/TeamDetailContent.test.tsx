import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamDetailContent } from './TeamDetailContent';
import type { TeamDetailContentProps } from './TeamDetailContent';
import type { DraftClass } from '../../../types';
import { DEFAULT_ROLE_FILTER } from '../../../lib/roleFilter';

function makePick(overallPick: number, teamId: string, position = 'WR') {
  return {
    playerId: `p-${overallPick}`,
    playerName: `Player ${overallPick}`,
    position,
    round: 1,
    overallPick,
    teamId,
    seasons: [
      {
        year: 2021,
        gamesPlayed: 16,
        teamGames: 17,
        snapShare: 0.9,
        retained: true,
      },
    ],
  };
}

const TEAM = 'KC';

const draftClasses: DraftClass[] = [
  { year: 2021, picks: [makePick(10, TEAM)] },
  { year: 2022, picks: [makePick(20, TEAM)] },
];

function renderView(overrides: Partial<TeamDetailContentProps> = {}) {
  const props: TeamDetailContentProps = {
    rollingDraftScore: {
      score: 62.5,
      totalPicks: 2,
      scoredPickCount: 2,
      coreStarterRate: 0.5,
      retentionRate: 1,
    },
    yearCount: 2,
    teamRank: { rank: 3, total: 32, rankings: [] },
    onShowRankings: () => {},
    draftClasses,
    selectedTeam: TEAM,
    draftingTeamOnly: true,
    roleFilter: new Set(DEFAULT_ROLE_FILTER),
    setRoleFilter: () => {},
    rosterByDraftYear: [
      { year: 2021, picks: [{ pick: makePick(10, TEAM), draftYear: 2021 }] },
      { year: 2022, picks: [{ pick: makePick(20, TEAM), draftYear: 2022 }] },
    ],
    depthChartUrl: null,
    showDeparted: false,
    setShowDeparted: () => {},
    correlationRow: null,
    onShowMethodology: () => {},
    windows: { draftFrom: 2018, draftTo: 2021, winFrom: 2022, winTo: 2025 },
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <TeamDetailContent {...props} />
    </MemoryRouter>,
  );
}

describe('TeamDetailContent class cards', () => {
  // jsdom does not implement scrollIntoView, so stub it on the prototype.
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('scrolls to the matching roster year when a class card is clicked', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    renderView();

    fireEvent.click(screen.getByRole('button', { name: /2022 draft class/i }));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const scrolledEl = scrollSpy.mock.instances[0] as HTMLElement;
    expect(scrolledEl.id).toBe('roster-year-2022');
  });

  it('activates the jump with keyboard (Enter)', () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    renderView();

    fireEvent.keyDown(
      screen.getByRole('button', { name: /2021 draft class/i }),
      { key: 'Enter' },
    );

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const scrolledEl = scrollSpy.mock.instances[0] as HTMLElement;
    expect(scrolledEl.id).toBe('roster-year-2021');
  });
});

describe('TeamDetailContent side-rail breakdowns', () => {
  const sideRailClasses: DraftClass[] = [
    {
      year: 2021,
      picks: [
        makePick(1, TEAM, 'WR'),
        makePick(2, TEAM, 'CB'),
        makePick(3, TEAM, 'EDGE'),
        makePick(4, TEAM, 'P'),
        makePick(5, 'SF', 'WR'), // another team — must be excluded
      ],
    },
  ];

  it('renders the "Where the picks went" unit split for team picks only', () => {
    renderView({ draftClasses: sideRailClasses });

    const card = screen.getByText('Where the picks went').closest('.side-card');
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    // Offense (1 WR), Defense (CB + EDGE = 2), Special teams (1 P)
    expect(scope.getByText('Offense').parentElement).toHaveTextContent('1');
    expect(scope.getByText('Defense').parentElement).toHaveTextContent('2');
    expect(scope.getByText('Special teams').parentElement).toHaveTextContent(
      '1',
    );
  });

  it('renders the "Picks by position" breakdown', () => {
    renderView({ draftClasses: sideRailClasses });

    const card = screen.getByText('Picks by position').closest('.side-card');
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByText('WR')).toBeInTheDocument();
    expect(scope.getByText('CB')).toBeInTheDocument();
    expect(scope.getByText('EDGE')).toBeInTheDocument();
    expect(scope.getByText('P')).toBeInTheDocument();
  });

  it('shows the depth-chart CTA in the summary when a URL is provided', () => {
    renderView({ depthChartUrl: 'https://example.com/depth' });

    const link = screen.getByRole('link', {
      name: /open external depth chart/i,
    });
    expect(link).toHaveAttribute('href', 'https://example.com/depth');
  });
});

describe('TeamDetailContent validation card', () => {
  const correlationRow = {
    teamId: TEAM,
    seasons: 5,
    score: 45.2,
    wins: 60,
    losses: 24,
    ties: 0,
    winPct: 0.7142857,
    playoffApps: 5,
    sbApps: 0,
    sbWins: 0,
    scorePercentile: 6,
    winPctPercentile: 100,
  };

  it('is omitted when the team has no correlation row', () => {
    renderView({ correlationRow: null });
    expect(screen.queryByText(/draft, then winning/i)).not.toBeInTheDocument();
  });

  it('shows both percentile bars and the outcome counts', () => {
    renderView({ correlationRow });

    const card = screen
      .getByText(/draft, then winning/i)
      .closest('.side-card') as HTMLElement;
    const scope = within(card);
    expect(scope.getByText(/Draft score '18–'21/)).toBeInTheDocument();
    expect(scope.getByText(/45\.2 · 6th pct/)).toBeInTheDocument();
    expect(scope.getByText(/Win rate '22–'25/)).toBeInTheDocument();
    expect(scope.getByText(/71% · 100th pct/)).toBeInTheDocument();
    expect(scope.getByText('5/5')).toBeInTheDocument();
  });

  it('reads a big win-over-draft gap as winning beyond draft returns', () => {
    renderView({ correlationRow });
    expect(
      screen.getByText(/winning beyond what its draft returns/i),
    ).toBeInTheDocument();
  });

  it('opens the methodology from the card link', () => {
    const onShowMethodology = vi.fn();
    renderView({ correlationRow, onShowMethodology });
    fireEvent.click(
      screen.getByRole('button', { name: /see all 32 teams in methodology/i }),
    );
    expect(onShowMethodology).toHaveBeenCalledTimes(1);
  });
});
