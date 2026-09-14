import { describe, it, expect } from 'vitest';
import {
  expectedScoreForAcquisition,
  expectedScoreForFreeAgent,
  getAcquisitionOverSlot,
} from './overSlot';
import { getPlayerDraftSkill } from './draftSlotBaseline';
import { makePick, makeSeason } from '../test/factories';
import faBaseline from '../data/fa-baseline.json';
import type { FreeAgent } from '../types';

const productiveFreeAgent: FreeAgent = {
  playerId: 'fa-1',
  playerName: 'Undrafted Guy',
  position: 'ZZ',
  teamId: 'BUF',
  draftYear: 2019,
  seasons: [
    makeSeason({ year: 2019 }),
    makeSeason({ year: 2020 }),
    makeSeason({ year: 2021 }),
  ],
};

describe('expectedScoreForAcquisition', () => {
  it('reads the slot curve for a pick', () => {
    const pick = makePick({ round: 1, overallPick: 1 });
    expect(expectedScoreForAcquisition(pick)).toBeGreaterThan(50);
  });

  it('reads the cohort scalar for a free agent', () => {
    expect(expectedScoreForAcquisition(productiveFreeAgent)).toBe(
      expectedScoreForFreeAgent(),
    );
  });

  it('matches the derived free-agent baseline exactly', () => {
    expect(expectedScoreForFreeAgent()).toBe(faBaseline.expected);
  });

  it('expects far less of a free agent than of an early first-rounder', () => {
    expect(expectedScoreForFreeAgent()).toBeLessThan(
      expectedScoreForAcquisition(makePick({ round: 1, overallPick: 1 })),
    );
  });
});

describe('getAcquisitionOverSlot', () => {
  it('matches the existing pick path exactly', () => {
    const pick = makePick({
      round: 3,
      overallPick: 80,
      seasons: [makeSeason({ year: 2021 })],
    });
    expect(getAcquisitionOverSlot(pick)).toBe(getPlayerDraftSkill(pick));
  });

  it('credits a productive free agent well above his cohort', () => {
    expect(getAcquisitionOverSlot(productiveFreeAgent)).toBeGreaterThan(0);
  });
});
