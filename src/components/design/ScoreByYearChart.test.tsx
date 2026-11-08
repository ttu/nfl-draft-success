import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreByYearChart } from './ScoreByYearChart';
import type { YearScore } from '../../lib/getScoreByYear';

const points: YearScore[] = [
  { year: 2021, score: 27, hasData: true },
  { year: 2022, score: 63, hasData: true },
  { year: 2023, score: 53, hasData: true },
];

describe('ScoreByYearChart', () => {
  it('labels every plotted year and score', () => {
    render(<ScoreByYearChart points={points} />);
    const chart = screen.getByRole('img', { name: /Score by year/ });
    for (const label of ['2021', '2022', '2023', '27', '63', '53']) {
      expect(chart).toHaveTextContent(label);
    }
  });

  it('uses the design width before any measurement', () => {
    render(<ScoreByYearChart points={points} />);
    expect(screen.getByRole('img', { name: /Score by year/ })).toHaveAttribute(
      'viewBox',
      '0 0 800 240',
    );
  });
});
