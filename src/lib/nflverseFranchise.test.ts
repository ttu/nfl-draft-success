import { describe, it, expect } from 'vitest';
import { normalizeNflverseTeam } from './nflverseFranchise';

describe('normalizeNflverseTeam', () => {
  it('maps a relocated franchise to the city it plays in now', () => {
    expect(normalizeNflverseTeam('STL')).toBe('LAR');
    expect(normalizeNflverseTeam('SD')).toBe('LAC');
    expect(normalizeNflverseTeam('OAK')).toBe('LV');
  });

  it('maps the abbreviations the roster feed spells differently', () => {
    // `roster_{season}.csv` writes Arizona as AZ and the Rams as LA, while
    // snap counts, injuries and draft picks all write ARI and LAR. Left
    // unmapped, AZ reads as a franchise nobody was drafted by, so every
    // Cardinal shows as departed to a team that does not exist.
    expect(normalizeNflverseTeam('AZ')).toBe('ARI');
    expect(normalizeNflverseTeam('LA')).toBe('LAR');
  });

  it('maps the four-letter codes the draft feed uses', () => {
    expect(normalizeNflverseTeam('KAN')).toBe('KC');
    expect(normalizeNflverseTeam('GNB')).toBe('GB');
  });

  it('maps a relocated franchise spelled in the four-letter style', () => {
    // The draft feed writes San Diego as SDG, not SD — invisible until the
    // 2013–2016 classes shipped, where it surfaced on the board as a team with
    // no colour and no logo (D.J. Fluker, 2013 pick 11).
    expect(normalizeNflverseTeam('SDG')).toBe('LAC');
  });

  it('leaves a code that is already canonical alone', () => {
    expect(normalizeNflverseTeam('ARI')).toBe('ARI');
    expect(normalizeNflverseTeam('BUF')).toBe('BUF');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(normalizeNflverseTeam(' AZ ')).toBe('ARI');
  });

  it('passes an unknown code through rather than guessing', () => {
    expect(normalizeNflverseTeam('ZZZ')).toBe('ZZZ');
    expect(normalizeNflverseTeam('')).toBe('');
  });
});
