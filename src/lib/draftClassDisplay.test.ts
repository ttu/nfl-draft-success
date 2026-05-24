import { describe, it, expect } from 'vitest';
import {
  findLatestYearWithAwaitingData,
  shouldHideRosterYearHeading,
} from './draftClassDisplay';
import type { DraftClassMetrics } from './getDraftClassMetrics';
import type { DraftClass } from '../types';

const stubMetrics = (awaitingDataCount: number): DraftClassMetrics =>
  ({
    awaitingDataCount,
    totalPicks: 0,
    coreStarterCount: 0,
    starterWhenHealthyCount: 0,
    significantContributorCount: 0,
    contributorRoleCount: 0,
    depthCount: 0,
    nonContributorCount: 0,
    contributorCount: 0,
    retentionCount: 0,
    coreStarterRate: 0,
    contributorRate: 0,
    retentionRate: 0,
  }) as DraftClassMetrics;

const dc = (year: number): DraftClass => ({ year, picks: [] });

describe('findLatestYearWithAwaitingData', () => {
  it('returns null when nothing is awaiting', () => {
    expect(
      findLatestYearWithAwaitingData([
        { dc: dc(2022), metrics: stubMetrics(0) },
        { dc: dc(2023), metrics: stubMetrics(0) },
      ]),
    ).toBeNull();
  });
  it('returns the highest year among awaiting rows', () => {
    expect(
      findLatestYearWithAwaitingData([
        { dc: dc(2021), metrics: stubMetrics(2) },
        { dc: dc(2023), metrics: stubMetrics(0) },
        { dc: dc(2024), metrics: stubMetrics(1) },
        { dc: dc(2022), metrics: stubMetrics(5) },
      ]),
    ).toBe(2024);
  });
});

describe('shouldHideRosterYearHeading', () => {
  it('hides when scoped to a single matching year', () => {
    expect(
      shouldHideRosterYearHeading({
        yearCount: 1,
        draftClassesLength: 1,
        rosterByDraftYear: [{ year: 2023 }],
        draftClassYear: 2023,
      }),
    ).toBe(true);
  });
  it('keeps heading when years differ', () => {
    expect(
      shouldHideRosterYearHeading({
        yearCount: 1,
        draftClassesLength: 1,
        rosterByDraftYear: [{ year: 2023 }],
        draftClassYear: 2022,
      }),
    ).toBe(false);
  });
  it('keeps heading for multi-year ranges', () => {
    expect(
      shouldHideRosterYearHeading({
        yearCount: 3,
        draftClassesLength: 3,
        rosterByDraftYear: [{ year: 2021 }, { year: 2022 }, { year: 2023 }],
        draftClassYear: 2021,
      }),
    ).toBe(false);
  });
});
