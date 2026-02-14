import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FiveYearScoreCard } from './FiveYearScoreCard';

const mockScore = {
  score: 1.5,
  totalPicks: 20,
  coreStarterRate: 0.25,
  retentionRate: 0.8,
};

describe('FiveYearScoreCard', () => {
  it('displays score, Core Starter %, Retention %', () => {
    render(<FiveYearScoreCard score={mockScore} yearCount={5} />);
    expect(screen.getByText('5-Year Draft Score')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('displays dynamic year count in title', () => {
    render(<FiveYearScoreCard score={mockScore} yearCount={8} />);
    expect(screen.getByText('8-Year Draft Score')).toBeInTheDocument();
  });

  it('displays rank when provided', () => {
    render(
      <FiveYearScoreCard
        score={mockScore}
        yearCount={5}
        rank={{ rank: 12, total: 32, rankings: [] }}
      />,
    );
    expect(screen.getByText(/Rank 12 of 32/)).toBeInTheDocument();
  });
});
