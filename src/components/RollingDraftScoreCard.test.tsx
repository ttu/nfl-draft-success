import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RollingDraftScoreCard } from './RollingDraftScoreCard';

const mockScore = {
  score: 1.5,
  totalPicks: 20,
  coreStarterRate: 0.25,
  retentionRate: 0.8,
};

describe('RollingDraftScoreCard', () => {
  it('displays score, Core Starter %, Retention %', () => {
    render(<RollingDraftScoreCard score={mockScore} yearCount={5} />);
    expect(
      screen.getByRole('heading', { name: 'Rolling draft score' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 seasons')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('displays dynamic season span below title', () => {
    render(<RollingDraftScoreCard score={mockScore} yearCount={8} />);
    expect(screen.getByText('8 seasons')).toBeInTheDocument();
  });

  it('displays rank when provided', () => {
    render(
      <RollingDraftScoreCard
        score={mockScore}
        yearCount={5}
        rank={{ rank: 12, total: 32, rankings: [] }}
      />,
    );
    expect(screen.getByText(/Rank 12 of 32/)).toBeInTheDocument();
  });
});
