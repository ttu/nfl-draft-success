import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamRankingsView } from './TeamRankingsView';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';

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
      <TeamRankingsView
        rankings={sample}
        yearCount={3}
        startYear={2021}
        endYear={2025}
        onTeamSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /which teams draft well/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Draft success score · 3 seasons in window/),
    ).toBeInTheDocument();
  });

  it('labels the trend column with the two-digit season range', () => {
    render(
      <TeamRankingsView
        rankings={sample}
        yearCount={5}
        startYear={2021}
        endYear={2025}
        onTeamSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: /Score · '21 → '25/ }),
    ).toBeInTheDocument();
  });

  it('renders the extended per-team stats: picks, core %, retained and the trend range', () => {
    render(
      <TeamRankingsView
        rankings={[extendedRow]}
        yearCount={5}
        startYear={2021}
        endYear={2025}
        onTeamSelect={() => {}}
      />,
    );
    expect(screen.getByText('39')).toBeInTheDocument(); // picks
    expect(screen.getByText('42%')).toBeInTheDocument(); // core rate
    expect(screen.getByText('85%')).toBeInTheDocument(); // retention
    expect(screen.getByText('58→76')).toBeInTheDocument(); // trend range
  });
});
