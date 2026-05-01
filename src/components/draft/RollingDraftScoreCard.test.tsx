import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RollingDraftScoreCard } from './RollingDraftScoreCard';

const mockScore = {
  score: 1.5,
  totalPicks: 20,
  scoredPickCount: 20,
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

  it('shows em dash score when no picks have season data yet', () => {
    render(
      <RollingDraftScoreCard
        score={{
          score: 0,
          totalPicks: 8,
          scoredPickCount: 0,
          coreStarterRate: 0,
          retentionRate: 0,
        }}
        yearCount={1}
      />,
    );
    expect(screen.getAllByText('—')).toHaveLength(3);
  });

  it('renders score and rates without explanatory copy when some picks lack season rows', () => {
    render(
      <RollingDraftScoreCard
        score={{
          score: 1.24,
          totalPicks: 48,
          scoredPickCount: 39,
          coreStarterRate: 0.103,
          retentionRate: 0.41,
        }}
        yearCount={6}
      />,
    );
    expect(screen.getByText('1.24')).toBeInTheDocument();
    expect(screen.getByText('10.3%')).toBeInTheDocument();
    expect(screen.getByText('41.0%')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/not averaged over all/i),
    ).not.toBeInTheDocument();
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
