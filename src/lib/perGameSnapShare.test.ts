import { describe, expect, it } from 'vitest';
import {
  isSpecialTeamsSpecialistPosition,
  perGameSnapShareForRole,
} from './perGameSnapShare';

describe('isSpecialTeamsSpecialistPosition', () => {
  it('is true for SPEC position group', () => {
    expect(isSpecialTeamsSpecialistPosition('SPEC', 'K')).toBe(true);
    expect(isSpecialTeamsSpecialistPosition('SPEC', 'P')).toBe(true);
    expect(isSpecialTeamsSpecialistPosition('SPEC', 'LS')).toBe(true);
  });

  it('is true for K, P, LS when position group missing', () => {
    expect(isSpecialTeamsSpecialistPosition(undefined, 'K')).toBe(true);
    expect(isSpecialTeamsSpecialistPosition('', 'P')).toBe(true);
    expect(isSpecialTeamsSpecialistPosition('', 'LS')).toBe(true);
  });

  it('is false for typical positional groups', () => {
    expect(isSpecialTeamsSpecialistPosition('DB', 'SAF')).toBe(false);
    expect(isSpecialTeamsSpecialistPosition('WR', 'WR')).toBe(false);
  });
});

describe('perGameSnapShareForRole', () => {
  it('uses max(off, def, st) for specialists', () => {
    expect(perGameSnapShareForRole(0, 0, 0.55, 'SPEC', 'K')).toBe(0.55);
  });

  it('ignores st for DB/SAF so ST-only games do not inflate share', () => {
    expect(perGameSnapShareForRole(0, 0, 0.48, 'DB', 'SAF')).toBe(0);
  });

  it('uses defense pct for defensive players when higher than ST', () => {
    expect(perGameSnapShareForRole(0, 0.42, 0.5, 'DB', 'SAF')).toBe(0.42);
  });

  it('treats unknown position meta like non-specialist', () => {
    expect(perGameSnapShareForRole(0, 0, 0.6, undefined, undefined)).toBe(0);
  });
});
