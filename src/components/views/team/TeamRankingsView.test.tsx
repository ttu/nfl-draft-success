import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamRankingsView } from './TeamRankingsView';
import type { TeamRanking } from '../../../lib/getRollingDraftScore';

const sample: TeamRanking[] = [
  { teamId: 'KC', teamName: 'Chiefs', score: 1.2, rank: 1 },
  { teamId: 'PHI', teamName: 'Eagles', score: 0.9, rank: 2 },
];

describe('TeamRankingsView', () => {
  it('renders the ranking headline and the year-window subtitle', () => {
    render(
      <TeamRankingsView
        rankings={sample}
        yearCount={3}
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
});
