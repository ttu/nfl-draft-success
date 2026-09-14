import type { Acquisition, DraftClass, FreeAgentClass, Role } from '../types';
import { isDraftPick } from './acquisition';
import { isDraftPickRetainedForRoster } from './draftPickLatestSeason';
import { getPlayerDraftScore, getPlayerRole } from './getPlayerRole';
import { roleFilterAllows } from './roleFilter';

/** One roster row: the player, and the class year he belongs to. */
export type RosterEntry = { pick: Acquisition; draftYear: number };

export type RosterByDraftYear = { year: number; players: RosterEntry[] };

/**
 * A team's roster grouped by class year — drafted picks and the undrafted
 * players who debuted alongside them, in one list per year.
 *
 * The two populations are scored on separate axes (see `getFreeAgentScore`),
 * but a roster is a roster: what a team has from 2022 is its 2022 picks plus
 * whoever it developed undrafted that year, and splitting them across two
 * places on the page made the reader do the joining.
 *
 * Both populations pass the same three filters — roster retention, the role
 * filter, and `draftingTeamOnly` — so the controls above the list govern
 * everything in it.
 *
 * Undrafted players are opt-in via `showFreeAgents`: hidden, they leave no
 * trace, and a year that existed only because of them disappears with them
 * rather than rendering an empty group.
 */
export function getRosterByDraftYear(
  draftClasses: DraftClass[],
  freeAgentClasses: FreeAgentClass[],
  selectedTeam: string | null,
  showDeparted: boolean,
  roleFilter: Set<Role>,
  draftingTeamOnly: boolean,
  showFreeAgents: boolean,
): RosterByDraftYear[] {
  const allTeamPicks: RosterEntry[] = draftClasses.flatMap((dc) =>
    dc.picks
      .filter((p) => p.teamId === selectedTeam)
      .map((p) => ({ pick: p, draftYear: dc.year })),
  );
  allTeamPicks.sort(
    (a, b) =>
      a.draftYear - b.draftYear ||
      (isDraftPick(a.pick) && isDraftPick(b.pick)
        ? a.pick.overallPick - b.pick.overallPick
        : 0),
  );

  // Best first, because an undrafted class has no draft order to preserve —
  // the only ranking it carries is what the players went on to do.
  const allTeamFreeAgents: RosterEntry[] = (
    showFreeAgents ? freeAgentClasses : []
  )
    .flatMap((fc) =>
      fc.freeAgents
        .filter((fa) => fa.teamId === selectedTeam)
        .map((fa) => ({ pick: fa as Acquisition, draftYear: fc.year })),
    )
    .sort(
      (a, b) =>
        a.draftYear - b.draftYear ||
        getPlayerDraftScore(b.pick, { draftingTeamOnly }) -
          getPlayerDraftScore(a.pick, { draftingTeamOnly }),
    );

  const keep = (entries: RosterEntry[]) =>
    entries
      .filter(({ pick }) => showDeparted || isDraftPickRetainedForRoster(pick))
      .filter(
        ({ pick }) =>
          pick.seasons.length === 0 ||
          roleFilterAllows(
            roleFilter,
            getPlayerRole(pick, { draftingTeamOnly }),
          ),
      );

  const picksByYear = new Map<number, RosterEntry[]>();
  for (const entry of keep(allTeamPicks)) {
    const list = picksByYear.get(entry.draftYear) ?? [];
    list.push(entry);
    picksByYear.set(entry.draftYear, list);
  }

  const freeAgentsByYear = new Map<number, RosterEntry[]>();
  for (const entry of keep(allTeamFreeAgents)) {
    const list = freeAgentsByYear.get(entry.draftYear) ?? [];
    list.push(entry);
    freeAgentsByYear.set(entry.draftYear, list);
  }

  // Years come from the union of both populations, not from `draftClasses`
  // alone: a team can have a debut in a year whose picks were all traded away
  // or filtered out, and that player must not vanish with the empty group.
  const years = [
    ...new Set([...picksByYear.keys(), ...freeAgentsByYear.keys()]),
  ].sort((a, b) => a - b);

  return years.map((year) => ({
    year,
    players: [
      ...(picksByYear.get(year) ?? []),
      ...(freeAgentsByYear.get(year) ?? []),
    ],
  }));
}

/** How many of a year's roster entries were drafted by this team. */
export function countPicks(group: RosterByDraftYear): number {
  return group.players.filter((p) => isDraftPick(p.pick)).length;
}

/** How many of a year's roster entries arrived undrafted. */
export function countUndrafted(group: RosterByDraftYear): number {
  return group.players.length - countPicks(group);
}
