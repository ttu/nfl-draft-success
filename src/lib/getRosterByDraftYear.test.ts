import { describe, it, expect } from 'vitest';
import { DEFAULT_ROLE_FILTER } from './roleFilter';
import { getRosterByDraftYear } from './getRosterByDraftYear';
import { isDraftPick } from './acquisition';
import { stampFreeAgentYear } from './freeAgentClass';
import type { DraftClass, DraftPick, FreeAgentClass, Role } from '../types';
import {
  makeDraftClass,
  makeFreeAgent,
  makePick,
  makeSeason,
} from '../test/factories';

const basePick = (
  overrides: Partial<DraftPick> & Pick<DraftPick, 'overallPick' | 'teamId'>,
): DraftPick => makePick({ position: 'WR', ...overrides });

/** No free agents — for the pick-only cases that predate the merge. */
const NO_FREE_AGENTS: FreeAgentClass[] = [];

/** Names in group order, so a test can assert ordering without index juggling. */
const namesOf = (group: { players: { pick: { playerName: string } }[] }) =>
  group.players.map((p) => p.pick.playerName);

describe('getRosterByDraftYear', () => {
  it('returns empty when selectedTeam is null', () => {
    const draftClasses: DraftClass[] = [
      makeDraftClass({
        year: 2021,
        picks: [basePick({ overallPick: 1, teamId: 'BUF' })],
      }),
    ];
    expect(
      getRosterByDraftYear(
        draftClasses,
        NO_FREE_AGENTS,
        null,
        true,
        DEFAULT_ROLE_FILTER,
        true,
        true,
      ),
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
      NO_FREE_AGENTS,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );
    expect(result.map((g) => g.year)).toEqual([2021, 2022]);
    expect(
      result[0].players.map((x) =>
        isDraftPick(x.pick) ? x.pick.overallPick : null,
      ),
    ).toEqual([5, 10]);
    expect(result[1].players[0].draftYear).toBe(2022);
  });

  it('omits years with neither picks nor free agents for the team', () => {
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
      NO_FREE_AGENTS,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
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
      NO_FREE_AGENTS,
      'BUF',
      false,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].players).toHaveLength(1);
    const only = kept[0].players[0].pick;
    expect(isDraftPick(only) && only.overallPick).toBe(2);

    const all = getRosterByDraftYear(
      draftClasses,
      NO_FREE_AGENTS,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );
    expect(all[0].players).toHaveLength(2);
  });
});

describe('getRosterByDraftYear with free agents', () => {
  /** A free agent who debuted in `year` and played it at `snapShare`. */
  const fa = (
    playerId: string,
    year: number,
    snapShare: number,
    overrides: { retained?: boolean; teamId?: string } = {},
  ) =>
    makeFreeAgent({
      playerId,
      playerName: playerId,
      teamId: overrides.teamId ?? 'BUF',
      seasons: [
        makeSeason({
          year,
          snapShare,
          retained: overrides.retained ?? true,
        }),
      ],
    });

  const classesWith = (year: number, ...members: ReturnType<typeof fa>[]) =>
    stampFreeAgentYear({ year, freeAgents: members });

  it('files a free agent under the year he debuted, after that year’s picks', () => {
    const draftClasses = [
      makeDraftClass({
        year: 2021,
        picks: [
          basePick({ overallPick: 20, teamId: 'BUF', playerName: 'Pick 20' }),
          basePick({ overallPick: 5, teamId: 'BUF', playerName: 'Pick 5' }),
        ],
      }),
    ];
    const result = getRosterByDraftYear(
      draftClasses,
      [classesWith(2021, fa('Undrafted A', 2021, 0.9))],
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );

    expect(result).toHaveLength(1);
    // Picks keep draft order; the undrafted player reads as an appendix to the
    // class rather than being interleaved by score.
    expect(namesOf(result[0])).toEqual(['Pick 5', 'Pick 20', 'Undrafted A']);
  });

  it('orders undrafted players within a year by score, best first', () => {
    const draftClasses = [makeDraftClass({ year: 2021, picks: [] })];
    const result = getRosterByDraftYear(
      draftClasses,
      [
        classesWith(
          2021,
          fa('Quiet', 2021, 0.05),
          fa('Starter', 2021, 0.95),
          fa('Rotational', 2021, 0.4),
        ),
      ],
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );

    expect(namesOf(result[0])).toEqual(['Starter', 'Rotational', 'Quiet']);
  });

  it('renders a year that has free agents but no picks left for the team', () => {
    // The group must be built from the union of both populations: a team can
    // have a debut in a year whose picks were all traded away or filtered out.
    const draftClasses = [
      makeDraftClass({
        year: 2021,
        picks: [basePick({ overallPick: 1, teamId: 'KC' })],
      }),
    ];
    const result = getRosterByDraftYear(
      draftClasses,
      [classesWith(2021, fa('Only Undrafted', 2021, 0.5))],
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );

    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2021);
    expect(namesOf(result[0])).toEqual(['Only Undrafted']);
  });

  it('keeps a free agent out of another team’s roster', () => {
    const draftClasses = [makeDraftClass({ year: 2021, picks: [] })];
    const result = getRosterByDraftYear(
      draftClasses,
      [classesWith(2021, fa('Chiefs Guy', 2021, 0.9, { teamId: 'KC' }))],
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );

    expect(result).toEqual([]);
  });

  it('hides a departed free agent when showDeparted is false', () => {
    const draftClasses = [makeDraftClass({ year: 2021, picks: [] })];
    const freeAgents = [
      classesWith(
        2021,
        fa('Stayed', 2021, 0.6),
        fa('Left', 2021, 0.6, { retained: false }),
      ),
    ];

    const hidden = getRosterByDraftYear(
      draftClasses,
      freeAgents,
      'BUF',
      false,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );
    expect(namesOf(hidden[0])).toEqual(['Stayed']);

    const shown = getRosterByDraftYear(
      draftClasses,
      freeAgents,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      true,
    );
    expect(namesOf(shown[0]).sort()).toEqual(['Left', 'Stayed']);
  });

  it('applies the role filter to free agents', () => {
    const draftClasses = [makeDraftClass({ year: 2021, picks: [] })];
    const coreOnly = new Set<Role>(['core_starter']);
    // A core-starter badge needs the whole three-season window, not one good
    // year: the role weight is averaged across the window a free agent is
    // judged on, so a single strong season lands well below the top band.
    const core = makeFreeAgent({
      playerId: 'Core',
      playerName: 'Core',
      teamId: 'BUF',
      seasons: [2021, 2022, 2023].map((year) => makeSeason({ year })),
    });
    const result = getRosterByDraftYear(
      draftClasses,
      [classesWith(2021, core, fa('Fringe', 2021, 0.05))],
      'BUF',
      true,
      coreOnly,
      true,
      true,
    );

    expect(namesOf(result[0])).toEqual(['Core']);
  });
});

describe('getRosterByDraftYear with free agents hidden', () => {
  const draftClasses = [
    makeDraftClass({
      year: 2021,
      picks: [
        basePick({ overallPick: 5, teamId: 'BUF', playerName: 'Pick 5' }),
      ],
    }),
    makeDraftClass({ year: 2022, picks: [] }),
  ];
  const freeAgentClasses = [
    stampFreeAgentYear({
      year: 2021,
      freeAgents: [
        makeFreeAgent({
          playerId: 'With Picks',
          playerName: 'With Picks',
          teamId: 'BUF',
          seasons: [makeSeason({ year: 2021 })],
        }),
      ],
    }),
    stampFreeAgentYear({
      year: 2022,
      freeAgents: [
        makeFreeAgent({
          playerId: 'Alone',
          playerName: 'Alone',
          teamId: 'BUF',
          seasons: [makeSeason({ year: 2022 })],
        }),
      ],
    }),
  ];

  const roster = (showFreeAgents: boolean) =>
    getRosterByDraftYear(
      draftClasses,
      freeAgentClasses,
      'BUF',
      true,
      DEFAULT_ROLE_FILTER,
      true,
      showFreeAgents,
    );

  it('leaves undrafted players out when they are not shown', () => {
    const result = roster(false);
    expect(result.map((g) => g.year)).toEqual([2021]);
    expect(namesOf(result[0])).toEqual(['Pick 5']);
  });

  it('drops a year that exists only because of undrafted players', () => {
    // 2022 has no picks for this team, so hiding the undrafted leaves nothing
    // to show — the group must go with them rather than render empty.
    expect(roster(false).some((g) => g.year === 2022)).toBe(false);
    expect(roster(true).some((g) => g.year === 2022)).toBe(true);
  });

  it('brings them back, in place, when shown', () => {
    const result = roster(true);
    expect(result.map((g) => g.year)).toEqual([2021, 2022]);
    expect(namesOf(result[0])).toEqual(['Pick 5', 'With Picks']);
    expect(namesOf(result[1])).toEqual(['Alone']);
  });
});
