import { describe, it, expect } from 'vitest';
import { acquisitionWindow, isDraftPick, FA_WINDOW } from './acquisition';
import { makePick } from '../test/factories';
import type { FreeAgent } from '../types';

const freeAgent: FreeAgent = {
  playerId: 'fa-1',
  playerName: 'Undrafted Guy',
  position: 'ZZ',
  teamId: 'BUF',
  draftYear: 2020,
  seasons: [],
};

describe('isDraftPick', () => {
  it('is true for a pick, which carries a round', () => {
    expect(isDraftPick(makePick({ round: 3 }))).toBe(true);
  });

  it('is false for a free agent, which has no round', () => {
    expect(isDraftPick(freeAgent)).toBe(false);
  });
});

describe('acquisitionWindow', () => {
  it('gives a first-rounder five years for the fifth-year option', () => {
    expect(acquisitionWindow(makePick({ round: 1 }))).toBe(5);
  });

  it('gives a later pick four years', () => {
    expect(acquisitionWindow(makePick({ round: 4 }))).toBe(4);
  });

  it('gives a free agent three, the undrafted rookie deal', () => {
    expect(acquisitionWindow(freeAgent)).toBe(FA_WINDOW);
    expect(FA_WINDOW).toBe(3);
  });
});
