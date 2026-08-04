import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamRankingsView, RankingsBoot } from './TeamRankingsView';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type { LeagueContext } from '../../../lib/getLeagueContext';
import { MOBILE_WIDTH, setViewportWidth } from '../../../test/viewport';

const rankings: TeamRanking[] = [
  { teamId: 'DET', teamName: 'Lions', score: 76.1, rank: 1 },
  { teamId: 'KC', teamName: 'Chiefs', score: 71.4, rank: 2 },
  { teamId: 'PHI', teamName: 'Eagles', score: 68.9, rank: 3 },
  { teamId: 'BUF', teamName: 'Bills', score: 64.2, rank: 4 },
  { teamId: 'MIN', teamName: 'Vikings', score: 27.2, rank: 5 },
];

const leagueContext: LeagueContext = {
  avgScore: 58.2,
  spread: {
    topId: 'DET',
    topScore: 76.1,
    bottomId: 'MIN',
    bottomScore: 27.2,
    gap: 48.9,
  },
  roleDistribution: {
    coreCount: 18,
    contributorCount: 44,
    nonContributorCount: 38,
    total: 100,
    corePct: 0.18,
    contributorPct: 0.44,
    nonContributorPct: 0.38,
  },
};

function renderMobile(
  props: Partial<Parameters<typeof TeamRankingsView>[0]> = {},
) {
  return render(
    <MemoryRouter>
      <TeamRankingsView
        rankings={rankings}
        yearCount={5}
        startYear={2021}
        endYear={2025}
        leagueContext={leagueContext}
        onTeamSelect={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('TeamRankingsView on mobile', () => {
  beforeEach(() => setViewportWidth(MOBILE_WIDTH));

  it('leads with the short headline, kicker and one-line explainer', () => {
    renderMobile();
    expect(
      screen.getByRole('heading', { name: /who drafted best/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Draft success score · '21–'25/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Snap share, games played, and retention — how much of each draft class actually plays\./,
      ),
    ).toBeInTheDocument();
    // The desktop headline and its long lede are gone, not merely hidden.
    expect(screen.queryByText(/which teams draft/i)).toBeNull();
    expect(screen.queryByText(/Not wins or box-score stats/)).toBeNull();
  });

  it('puts the top three on a podium, in rank order, each with name and score', () => {
    const { container } = renderMobile();
    const podium = screen.getByRole('list', { name: /top three teams/i });
    const columns = within(podium).getAllByRole('listitem');
    expect(columns).toHaveLength(3);

    // Reading order stays 1-2-3; the visual 2-1-3 arrangement is CSS `order`.
    expect(columns[0]).toHaveTextContent('Lions');
    expect(columns[0]).toHaveTextContent('76.1');
    expect(columns[1]).toHaveTextContent('Chiefs');
    expect(columns[2]).toHaveTextContent('Eagles');

    // The winner's column is the enlarged, centred one.
    expect(columns[0].className).toMatch(/podium__col--lead/);
    expect(container.querySelectorAll('.podium__col--lead')).toHaveLength(1);
  });

  it('links each podium team to its page, carrying the year window', () => {
    renderMobile();
    expect(screen.getByRole('link', { name: /Lions/ })).toHaveAttribute(
      'href',
      '/DET?from=2021&to=2025',
    );
  });

  it('makes the ranked bar part of the team link, not dead space beside it', () => {
    const { container } = renderMobile();
    for (const bar of container.querySelectorAll('.podium__bar')) {
      expect(bar.closest('a.podium__link')).not.toBeNull();
    }
  });

  it('shows league average and score spread in the strip under the podium', () => {
    const { container } = renderMobile();
    const strip = container.querySelector('.podium-strip');
    expect(strip).not.toBeNull();
    expect(within(strip as HTMLElement).getByText('58.2')).toBeInTheDocument();
    expect(within(strip as HTMLElement).getByText('48.9')).toBeInTheDocument();
    expect(
      within(strip as HTMLElement).getByText(/full board/i),
    ).toBeInTheDocument();
  });

  it('starts the ranked list at #4 so the podium teams are not listed twice', () => {
    renderMobile();
    const rows = screen.getAllByRole('row').slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Bills');
    expect(rows[0]).toHaveTextContent('4');
    expect(rows[1]).toHaveTextContent('Vikings');
  });

  it('drops the duplicate average/spread stats from the league band', () => {
    const { container } = renderMobile();
    // The role-distribution bar still earns its place; the two figures now
    // live in the podium strip and must not be repeated below it.
    expect(container.querySelector('.league-context__bar')).not.toBeNull();
    expect(container.querySelector('.league-context__stats')).toBeNull();
  });

  it('keeps the podium standing while the figures are still loading', () => {
    const { container } = renderMobile({
      leagueContext: undefined,
      loading: true,
    });
    expect(
      screen.getByRole('list', { name: /top three teams/i }),
    ).toBeInTheDocument();
    const strip = container.querySelector('.podium-strip');
    expect(within(strip as HTMLElement).getAllByText('—')).toHaveLength(2);
  });

  it('reserves the podium before any team is known, so nothing shifts', () => {
    const boot = render(
      <MemoryRouter>
        <RankingsBoot yearCount={5} />
      </MemoryRouter>,
    );
    const skeleton = boot.container.querySelector('.podium--placeholder');
    expect(skeleton).not.toBeNull();
    // Three dashes say nothing worth announcing; the real podium will.
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');

    // Same column classes as the loaded podium — that is what makes the two
    // occupy the same box, since every height in the podium is class-driven.
    const classesOf = (root: HTMLElement) =>
      [...root.querySelectorAll('.podium__col')].map((c) => c.className);
    const loaded = render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={rankings}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(classesOf(boot.container)).toEqual(classesOf(loaded.container));
  });

  it('falls back to the full list when there are fewer than three teams', () => {
    renderMobile({ rankings: rankings.slice(0, 2) });
    expect(screen.queryByRole('list', { name: /top three teams/i })).toBeNull();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });
});
