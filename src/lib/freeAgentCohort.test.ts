import { describe, it, expect } from 'vitest';
import {
  isUndraftedAndTracked,
  type NflversePlayerRow,
} from './freeAgentCohort';

function row(overrides: Partial<NflversePlayerRow> = {}): NflversePlayerRow {
  return {
    pfrId: 'AbcdEf00',
    gsisId: '00-0012345',
    playerName: 'Undrafted Guy',
    position: 'WR',
    rookieSeason: 2020,
    draftYear: null,
    draftPick: null,
    headshot: '',
    espnId: '',
    ...overrides,
  };
}

describe('isUndraftedAndTracked', () => {
  it('accepts an undrafted player whose rookie season the site tracks', () => {
    expect(isUndraftedAndTracked(row())).toBe(true);
  });

  it('accepts him in the first tracked season', () => {
    expect(isUndraftedAndTracked(row({ rookieSeason: 2013 }))).toBe(true);
  });

  it('rejects a drafted player, who already has a class', () => {
    expect(
      isUndraftedAndTracked(row({ draftYear: 2020, draftPick: 201 })),
    ).toBe(false);
  });

  it('rejects a player drafted but with no recorded pick number', () => {
    expect(isUndraftedAndTracked(row({ draftYear: 2020 }))).toBe(false);
  });

  it('rejects a player with a pick number but no recorded draft year', () => {
    expect(isUndraftedAndTracked(row({ draftPick: 201 }))).toBe(false);
  });

  it('rejects a player with no rookie season recorded', () => {
    expect(isUndraftedAndTracked(row({ rookieSeason: null }))).toBe(false);
  });

  it('rejects a veteran whose rookie season predates the data window', () => {
    expect(isUndraftedAndTracked(row({ rookieSeason: 2009 }))).toBe(false);
  });
});
