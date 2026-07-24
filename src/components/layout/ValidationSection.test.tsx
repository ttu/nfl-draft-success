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

// Over slot perfectly (negatively) correlated with later win rate, while raw
// score is flat — so the two reported coefficients differ deterministically and
// the sign-dependent copy is exercised.
const scores: ScoreEntry[] = [
  { teamId: 'AAA', score: 50, overSlot: 12 },
  { teamId: 'BBB', score: 50, overSlot: 4 },
  { teamId: 'CCC', score: 50, overSlot: -4 },
  { teamId: 'DDD', score: 50, overSlot: -12 },
];
const successes: TeamSuccess[] = [
  success('AAA', 0.3, 0),
  success('BBB', 0.45, 1),
  success('CCC', 0.6, 3),
  success('DDD', 0.75, 4, 1, 1), // low over slot, champion
];

describe('ValidationSection', () => {
  it('renders nothing without correlation data', () => {
    const { container } = render(
      <ValidationSection correlation={null} windows={WINDOWS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reports both the over-slot and raw-usage coefficients for the win window', () => {
    render(
      <ValidationSection
        correlation={buildCorrelation(scores, successes)}
        windows={WINDOWS}
      />,
    );
    // Over slot is perfectly negatively correlated → −1.00 (headline figure).
    expect(screen.getAllByText('−1.00').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Pearson r · over slot → win 2022–2025/),
    ).toBeInTheDocument();
    // Flat raw score → 0.00 (the contrast figure).
    expect(
      screen.getByText(/Pearson r · raw usage → win 2022–2025/),
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
