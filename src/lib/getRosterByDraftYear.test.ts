import { describe, it, expect } from 'vitest';
import { DEFAULT_ROLE_FILTER } from './roleFilter';
import { getRosterByDraftYear } from './getRosterByDraftYear';
import type { DraftClass, DraftPick } from '../types';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

const basePick = (
  overrides: Partial<DraftPick> & Pick<DraftPick, 'overallPick' | 'teamId'>,
): DraftPick => makePick({ position: 'WR', ...overrides });

describe('getRosterByDraftYear', () => {
  it('returns empty when selectedTeam is null', () => {
    const draftClasses: DraftClass[] = [
      makeDraftClass({
        year: 2021,
        picks: [basePick({ overallPick: 1, teamId: 'BUF' })],
      }),
    ];
    expect(
      getRosterByDraftYear(draftClasses, null, true, DEFAULT_ROLE_FILTER, true),
    ).toEqual([]);
  });

  it('groups picks by year and sorts by overall pick within a year', () => {
    const draftClasses: DraftClass[] = [
      makeDraftClass({
        year: 2021,
        picks: [
          basePick({ overallPick: 10, teamId: 'BUF' }),
          basePick({ overallPick: 5, teamId: 'BUF' }),
        ],
      }),
      makeDraftClass({
        year: 2022,
        picks: [basePick({ overallPick: 1, teamId: 'BUF' })],
      }),
    ];
    const result = getRosterByDraftYear(
      draftClasses,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
    );
    expect(result.map((g) => g.year)).toEqual([2021, 2022]);
    expect(result[0].picks.map((x) => x.pick.overallPick)).toEqual([5, 10]);
    expect(result[1].picks[0].draftYear).toBe(2022);
  });

  it('omits years with no picks for the team', () => {
    const draftClasses: DraftClass[] = [
      makeDraftClass({
        year: 2020,
        picks: [basePick({ overallPick: 1, teamId: 'KC' })],
      }),
      makeDraftClass({
        year: 2021,
        picks: [basePick({ overallPick: 2, teamId: 'BUF' })],
      }),
    ];
    const result = getRosterByDraftYear(
      draftClasses,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
    );
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2021);
  });

  it('when showDeparted is false, excludes picks whose latest season is not retained', () => {
    const departed = basePick({
      overallPick: 1,
      teamId: 'BUF',
      seasons: [
        makeSeason({
          year: 2024,
          gamesPlayed: 1,
          snapShare: 0.5,
          retained: false,
        }),
      ],
    });
    const draftClasses: DraftClass[] = [
      makeDraftClass({
        year: 2021,
        picks: [departed, basePick({ overallPick: 2, teamId: 'BUF' })],
      }),
    ];
    const kept = getRosterByDraftYear(
      draftClasses,
      'BUF',
      false,
      DEFAULT_ROLE_FILTER,
      true,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].picks).toHaveLength(1);
    expect(kept[0].picks[0].pick.overallPick).toBe(2);

    const all = getRosterByDraftYear(
      draftClasses,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
    );
    expect(all[0].picks).toHaveLength(2);
  });
});
