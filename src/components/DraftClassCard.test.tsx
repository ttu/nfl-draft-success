import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftClassCard } from './DraftClassCard';

const mockMetrics = {
  totalPicks: 8,
  coreStarterCount: 2,
  starterWhenHealthyCount: 1,
  significantContributorCount: 1,
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
    expect(screen.getByText('Depth')).toBeInTheDocument();
    expect(screen.getByText('Non contributors')).toBeInTheDocument();
    expect(screen.getByText('Retained')).toBeInTheDocument();
    const breakdownValues = screen.getAllByRole('definition');
    expect(breakdownValues.map((el) => el.textContent)).toEqual([
      '2',
      '1',
      '1',
      '1',
      '3',
    ]);
    expect(screen.getByText('6')).toBeInTheDocument();
  });
});
