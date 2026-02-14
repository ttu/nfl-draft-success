import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftClassCard } from './DraftClassCard';

const mockMetrics = {
  totalPicks: 8,
  coreStarterCount: 2,
  starterWhenHealthyCount: 1,
  contributorCount: 5,
  retentionCount: 6,
  coreStarterRate: 0.25,
  contributorRate: 0.625,
  retentionRate: 0.75,
};

describe('DraftClassCard', () => {
  it('displays picks, core starters, contributors, retention', () => {
    render(<DraftClassCard year={2023} metrics={mockMetrics} />);
    expect(
      screen.getByRole('heading', { name: /Draft 2023/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Picks')).toBeInTheDocument();
    expect(screen.getByText('Core starters')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.getByText('Retained')).toBeInTheDocument();
    const values = screen.getAllByRole('definition');
    expect(values.map((el) => el.textContent)).toEqual(['8', '2', '5', '6']);
  });
});
