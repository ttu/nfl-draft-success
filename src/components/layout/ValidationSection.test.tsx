import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ValidationSection } from './ValidationSection';
import {
  buildCorrelation,
  type ScoreEntry,
} from '../../lib/draftSuccessCorrelation';
import type { TeamSuccess } from '../../lib/teamSuccess';
import type { LaggedWindows } from '../../lib/laggedWindow';

const WINDOWS: LaggedWindows = {
  draftFrom: 2018,
  draftTo: 2021,
  winFrom: 2022,
  winTo: 2025,
};

function success(
  teamId: string,
  winPct: number,
  playoffApps = 0,
  sbApps = 0,
  sbWins = 0,
): TeamSuccess {
  return {
    teamId,
    seasons: 5,
    wins: 0,
    losses: 0,
    ties: 0,
    winPct,
    playoffApps,
    sbApps,
    sbWins,
  };
}

// High draft scores paired with LOW later win rates — a perfectly negative
// relationship, so the sign-dependent copy is exercised deterministically.
const scores: ScoreEntry[] = [
  { teamId: 'AAA', score: 80 },
  { teamId: 'BBB', score: 65 },
  { teamId: 'CCC', score: 50 },
  { teamId: 'DDD', score: 35 },
];
const successes: TeamSuccess[] = [
  success('AAA', 0.3, 0),
  success('BBB', 0.45, 1),
  success('CCC', 0.6, 3),
  success('DDD', 0.75, 4, 1, 1), // low score, champion
];

describe('ValidationSection', () => {
  it('renders nothing without correlation data', () => {
    const { container } = render(
      <ValidationSection correlation={null} windows={WINDOWS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the Pearson r and labels the lagged draft→win windows', () => {
    render(
      <ValidationSection
        correlation={buildCorrelation(scores, successes)}
        windows={WINDOWS}
      />,
    );
    // These inputs are perfectly negatively correlated → −1.00.
    expect(screen.getByText('−1.00')).toBeInTheDocument();
    expect(
      screen.getByText(/Pearson r · draft 2018–2021 → win 2022–2025/),
    ).toBeInTheDocument();
  });

  it('describes the relationship honestly by direction', () => {
    render(
      <ValidationSection
        correlation={buildCorrelation(scores, successes)}
        windows={WINDOWS}
      />,
    );
    expect(screen.getByText(/negative relationship/i)).toBeInTheDocument();
  });

  it('labels each dot category in the legend', () => {
    render(
      <ValidationSection
        correlation={buildCorrelation(scores, successes)}
        windows={WINDOWS}
      />,
    );
    expect(screen.getByText('Won Super Bowl')).toBeInTheDocument();
    expect(screen.getByText('Reached Super Bowl')).toBeInTheDocument();
    expect(screen.getByText('Other teams')).toBeInTheDocument();
  });
});
