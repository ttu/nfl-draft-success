import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamRankingsView } from './TeamRankingsView';
import type { TeamRanking } from './RollingDraftScoreCard';

const sample: TeamRanking[] = [
  { teamId: 'KC', teamName: 'Chiefs', score: 1.2, rank: 1 },
  { teamId: 'PHI', teamName: 'Eagles', score: 0.9, rank: 2 },
];

describe('TeamRankingsView', () => {
  it('uses a short title and a subtitle for the year window', () => {
    render(
      <TeamRankingsView
        rankings={sample}
        yearCount={3}
        onTeamSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Team rankings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rolling draft score · 3 seasons in window/),
    ).toBeInTheDocument();
  });
});
