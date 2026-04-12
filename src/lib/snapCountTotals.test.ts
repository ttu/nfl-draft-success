import { describe, it, expect } from 'vitest';
import {
  teamScrimmagePlaysFromRow,
  teamDenominatorForCumulativeLoad,
  playerSnapsForCumulativeLoad,
} from './snapCountTotals';
import { isSpecialTeamsSpecialistPosition } from './perGameSnapShare';

describe('snapCountTotals', () => {
  it('derives team scrimmage plays from pct (example: full-time OL)', () => {
    const team = teamScrimmagePlaysFromRow(71, 1, 0, 0);
    expect(team).toBeCloseTo(71, 5);
  });

  it('computes cumulative denominator for non-specialist (scrimmage only)', () => {
    const den = teamDenominatorForCumulativeLoad(
      40,
      0.57,
      0,
      0,
      10,
      0.2,
      false,
    );
    const scrim = teamScrimmagePlaysFromRow(40, 0.57, 0, 0);
    expect(den).toBe(scrim);
  });

  it('includes ST in denominator for specialists', () => {
    const isSpec = isSpecialTeamsSpecialistPosition('SPEC', 'K');
    const den = teamDenominatorForCumulativeLoad(0, 0, 0, 0, 5, 0.12, isSpec);
    expect(den).toBeGreaterThan(0);
    expect(playerSnapsForCumulativeLoad(0, 0, 5, true)).toBe(5);
  });
});
