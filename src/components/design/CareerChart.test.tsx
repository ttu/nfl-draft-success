import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CareerChart } from './CareerChart';
import { makeSeason } from '../../test/factories';

const seasons = [2022, 2023, 2024].map((year) =>
  makeSeason({ year, snapShare: 0.9 }),
);

describe('CareerChart', () => {
  it('labels every season on the axis', () => {
    render(<CareerChart seasons={seasons} color="#c00" position="TE" />);
    const chart = screen.getByRole('img', { name: /career snap share/i });
    for (const year of ['2022', '2023', '2024']) {
      expect(chart).toHaveTextContent(year);
    }
  });

  it('draws at its design width before the container is measured', () => {
    render(<CareerChart seasons={seasons} color="#c00" position="TE" />);
    expect(
      screen.getByRole('img', { name: /career snap share/i }),
    ).toHaveAttribute('viewBox', '0 0 560 200');
  });
});
