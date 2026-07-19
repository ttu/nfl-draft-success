import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamRankingsView } from './TeamRankingsView';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';
import type { LeagueContext } from '../../../lib/getLeagueContext';

const sample: TeamRanking[] = [
  { teamId: 'KC', teamName: 'Chiefs', score: 1.2, rank: 1 },
  { teamId: 'PHI', teamName: 'Eagles', score: 0.9, rank: 2 },
];

/** A row carrying the extended per-team stats the table renders. */
const extendedRow = {
  teamId: 'DET',
  teamName: 'Lions',
  score: 76.1,
  rank: 1,
  picks: 39,
  coreRate: 0.42,
  retentionRate: 0.85,
  trend: [58, 63, 70, 74, 76],
  change: 6,
} as unknown as TeamRanking;

describe('TeamRankingsView', () => {
  it('renders the ranking headline and the year-window subtitle', () => {
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={3}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /which teams draft well/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Draft success score · 3 seasons in window/),
    ).toBeInTheDocument();
  });

  it('links each team name to that team, carrying the year window', () => {
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Chiefs/ })).toHaveAttribute(
      'href',
      '/KC?from=2021&to=2025',
    );
    expect(screen.getByRole('link', { name: /Eagles/ })).toHaveAttribute(
      'href',
      '/PHI?from=2021&to=2025',
    );
  });

  it('does not double-navigate when the team link inside a clickable row is used', () => {
    const onTeamSelect = vi.fn();
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          onTeamSelect={onTeamSelect}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: /Chiefs/ }));
    expect(onTeamSelect).not.toHaveBeenCalled();
  });

  it('labels the trend column with the two-digit season range', () => {
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('columnheader', { name: /Score · '21 → '25/ }),
    ).toBeInTheDocument();
  });

  it('renders the extended per-team stats: picks, core %, retained and the trend range', () => {
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={[extendedRow]}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('39')).toBeInTheDocument(); // picks
    expect(screen.getByText('42%')).toBeInTheDocument(); // core rate
    expect(screen.getByText('85%')).toBeInTheDocument(); // retention
    expect(screen.getByText('58→76')).toBeInTheDocument(); // trend range
  });

  it('omits the league context band when no context is provided', () => {
    const { container } = render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={3}
          startYear={2021}
          endYear={2025}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(container.querySelector('.league-context')).toBeNull();
  });

  it('renders the league context band: average, spread and role distribution', () => {
    const leagueContext: LeagueContext = {
      avgScore: 58.2,
      spread: {
        topId: 'KC',
        topScore: 92,
        bottomId: 'CHI',
        bottomScore: 49.9,
        gap: 42.1,
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
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={5}
          startYear={2021}
          endYear={2025}
          leagueContext={leagueContext}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('58.2')).toBeInTheDocument(); // league average
    expect(screen.getByText('42.1')).toBeInTheDocument(); // spread gap
    expect(screen.getByText('KC → CHI')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument(); // core share
    expect(screen.getByText('44%')).toBeInTheDocument(); // contributor share
    expect(screen.getByText('38%')).toBeInTheDocument(); // non-contributor share
  });

  it('shows an empty state in the band when the window has no scored picks', () => {
    const leagueContext: LeagueContext = {
      avgScore: 0,
      spread: null,
      roleDistribution: {
        coreCount: 0,
        contributorCount: 0,
        nonContributorCount: 0,
        total: 0,
        corePct: 0,
        contributorPct: 0,
        nonContributorPct: 0,
      },
    };
    render(
      <MemoryRouter>
        <TeamRankingsView
          rankings={sample}
          yearCount={1}
          startYear={2026}
          endYear={2026}
          leagueContext={leagueContext}
          onTeamSelect={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/no scored picks in this window yet/i),
    ).toBeInTheDocument();
    expect(screen.getByText('need 2+ teams')).toBeInTheDocument();
  });
});
