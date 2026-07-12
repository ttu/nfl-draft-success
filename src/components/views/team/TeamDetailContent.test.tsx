import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamDetailContent } from './TeamDetailContent';
import type { TeamDetailContentProps } from './TeamDetailContent';
import type { DraftClass } from '../../../types';
import { DEFAULT_ROLE_FILTER } from '../../../lib/roleFilter';

function makePick(overallPick: number, teamId: string) {
  return {
    playerId: `p-${overallPick}`,
    playerName: `Player ${overallPick}`,
    position: 'WR',
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
