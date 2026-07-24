import { describe, it, expect } from 'vitest';
import { getPositionUnit } from './positionUnit';

describe('getPositionUnit', () => {
  it('maps offensive positions to offense', () => {
    for (const pos of [
      'QB',
      'RB',
      'FB',
      'WR',
      'TE',
      'OT',
      'G',
      'C',
      'OL',
      'IOL',
    ]) {
      expect(getPositionUnit(pos)).toBe('offense');
    }
  });

  it('maps defensive positions to defense', () => {
    for (const pos of [
      'DL',
      'DE',
      'DT',
      'NT',
      'LB',
      'ILB',
      'MLB',
      'OLB',
      'EDGE',
      'CB',
      'DB',
      'NB',
      'FS',
      'SS',
      'S',
    ]) {
      expect(getPositionUnit(pos)).toBe('defense');
    }
  });

  it('maps kicking positions to special teams', () => {
    for (const pos of ['K', 'P', 'LS']) {
      expect(getPositionUnit(pos)).toBe('special_teams');
    }
  });

  it('normalizes aliases before classifying (T -> OT, SAF -> S)', () => {
    expect(getPositionUnit('T')).toBe('offense');
    expect(getPositionUnit('SAF')).toBe('defense');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(getPositionUnit('  wr ')).toBe('offense');
    expect(getPositionUnit('edge')).toBe('defense');
  });

  it('classifies unknown codes as offense (none expected in current data)', () => {
    expect(getPositionUnit('ZZ')).toBe('offense');
  });
});
