import { describe, it, expect } from 'vitest';
import {
  getPositionGroup,
  POSITION_GROUP_ORDER,
  POSITION_GROUP_LABELS,
} from './positionGroup';

describe('getPositionGroup', () => {
  it('maps each offensive skill code to its own group', () => {
    expect(getPositionGroup('QB')).toBe('QB');
    expect(getPositionGroup('RB')).toBe('RB');
    expect(getPositionGroup('FB')).toBe('RB');
    expect(getPositionGroup('WR')).toBe('WR');
    expect(getPositionGroup('TE')).toBe('TE');
  });

  it('collects the offensive line', () => {
    for (const code of ['OT', 'G', 'C', 'OL', 'IOL']) {
      expect(getPositionGroup(code)).toBe('OL');
    }
  });

  it('collects the defensive line and linebackers', () => {
    for (const code of ['DE', 'DT', 'NT', 'DL']) {
      expect(getPositionGroup(code)).toBe('DL');
    }
    for (const code of ['LB', 'ILB', 'MLB', 'OLB', 'EDGE']) {
      expect(getPositionGroup(code)).toBe('LB');
    }
  });

  it('collects the secondary and the specialists', () => {
    for (const code of ['CB', 'S', 'SS', 'DB', 'NB']) {
      expect(getPositionGroup(code)).toBe('DB');
    }
    for (const code of ['K', 'P', 'LS']) {
      expect(getPositionGroup(code)).toBe('ST');
    }
  });

  it('normalizes feed aliases before grouping', () => {
    expect(getPositionGroup('T')).toBe('OL'); // T -> OT
    expect(getPositionGroup('OG')).toBe('OL'); // OG -> G
    expect(getPositionGroup('FS')).toBe('DB'); // FS -> S
    expect(getPositionGroup('  qb ')).toBe('QB');
  });

  it('sends an unknown code to OTHER rather than a real unit', () => {
    expect(getPositionGroup('ZZ')).toBe('OTHER');
    expect(getPositionGroup('')).toBe('OTHER');
  });

  it('orders groups offense, defense, special teams, other', () => {
    expect(POSITION_GROUP_ORDER).toEqual([
      'QB',
      'RB',
      'WR',
      'TE',
      'OL',
      'DL',
      'LB',
      'DB',
      'ST',
      'OTHER',
    ]);
  });

  it('labels every group in the order list', () => {
    for (const id of POSITION_GROUP_ORDER) {
      expect(POSITION_GROUP_LABELS[id]).toBeTruthy();
    }
  });
});
