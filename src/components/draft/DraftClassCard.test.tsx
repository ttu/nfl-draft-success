import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftClassCard } from './DraftClassCard';

const mockMetrics = {
  totalPicks: 8,
  awaitingDataCount: 0,
  coreStarterCount: 2,
  starterWhenHealthyCount: 1,
  significantContributorCount: 1,
  contributorRoleCount: 0,
  depthCount: 1,
  nonContributorCount: 3,
  contributorCount: 5,
  retentionCount: 6,
  coreStarterRate: 0.25,
  contributorRate: 0.625,
  retentionRate: 0.75,
};

describe('DraftClassCard', () => {
  it('displays picks and retained separate from role breakdown', () => {
    render(<DraftClassCard year={2023} metrics={mockMetrics} />);
    expect(
      screen.getByRole('heading', { name: /Draft 2023/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('8 picks')).toBeInTheDocument();
    expect(screen.getByText('Core starters')).toBeInTheDocument();
    expect(screen.getByText('Starters when healthy')).toBeInTheDocument();
    expect(screen.getByText('Significant contributors')).toBeInTheDocument();
    expect(screen.getByText(/^Contributors$/)).toBeInTheDocument();
    expect(screen.getByText('Depth')).toBeInTheDocument();
    expect(screen.getByText('Non contributors')).toBeInTheDocument();
    expect(screen.getByText('Retained')).toBeInTheDocument();
    const breakdownValues = screen.getAllByRole('definition');
    expect(breakdownValues.map((el) => el.textContent)).toEqual([
      '2',
      '1',
      '1',
      '0',
      '1',
      '3',
    ]);
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('shows pending copy when no pick has season data yet', () => {
    render(
      <DraftClassCard
        year={2026}
        showAwaitingDataNote
        metrics={{
          ...mockMetrics,
          awaitingDataCount: 5,
          totalPicks: 5,
          coreStarterCount: 0,
          starterWhenHealthyCount: 0,
          significantContributorCount: 0,
          contributorRoleCount: 0,
          depthCount: 0,
          nonContributorCount: 0,
          contributorCount: 0,
          retentionCount: 0,
          coreStarterRate: 0,
          contributorRate: 0,
          retentionRate: 0,
        }}
      />,
    );
    expect(
      screen.getByText(/NFL season data is not available for this class yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Core starters')).not.toBeInTheDocument();
  });

  it('hides pending line when showAwaitingDataNote is false', () => {
    render(
      <DraftClassCard
        year={2023}
        showAwaitingDataNote={false}
        metrics={{
          ...mockMetrics,
          awaitingDataCount: 2,
          totalPicks: 8,
        }}
      />,
    );
    expect(
      screen.queryByText(/not yet in season data/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Core starters')).toBeInTheDocument();
  });

  it('hides Starters when healthy when count is 0', () => {
    render(
      <DraftClassCard
        year={2022}
        metrics={{
          ...mockMetrics,
          starterWhenHealthyCount: 0,
        }}
      />,
    );
    expect(screen.getByText('Core starters')).toBeInTheDocument();
    expect(screen.queryByText('Starters when healthy')).not.toBeInTheDocument();
  });
});
