import type { DraftClass, DraftPick, Role } from '../types';
import { isDraftPickRetainedForRoster } from './draftPickLatestSeason';
import { getPlayerRole } from './getPlayerRole';
import { roleFilterAllows } from './roleFilter';

/** Pick plus draft class year (team roster grouping). */
export type RosterPickWithYear = { pick: DraftPick; draftYear: number };

export type RosterByDraftYear = { year: number; picks: RosterPickWithYear[] };

/**
 * Team picks across loaded draft classes, filtered by roster retention and role,
 * grouped by draft year in the same order as `draftClasses`.
 */
export function getRosterByDraftYear(
  draftClasses: DraftClass[],
  selectedTeam: string | null,
  showDeparted: boolean,
  roleFilter: Set<Role>,
  draftingTeamOnly: boolean,
): RosterByDraftYear[] {
  const allTeamPicks = draftClasses.flatMap((dc) =>
    dc.picks
      .filter((p) => p.teamId === selectedTeam)
      .map((p) => ({ pick: p, draftYear: dc.year })),
  );
  allTeamPicks.sort(
    (a, b) =>
      a.draftYear - b.draftYear || a.pick.overallPick - b.pick.overallPick,
  );

  const rosterPicks = showDeparted
    ? allTeamPicks
    : allTeamPicks.filter(({ pick }) => isDraftPickRetainedForRoster(pick));

  const filteredRosterPicks = rosterPicks.filter(
    ({ pick }) =>
      pick.seasons.length === 0 ||
      roleFilterAllows(roleFilter, getPlayerRole(pick, { draftingTeamOnly })),
  );

  const byYear = new Map<number, RosterPickWithYear[]>();
  for (const item of filteredRosterPicks) {
    const list = byYear.get(item.draftYear) ?? [];
    list.push(item);
    byYear.set(item.draftYear, list);
  }

  return draftClasses
    .map((dc) => ({ year: dc.year, picks: byYear.get(dc.year) ?? [] }))
    .filter((g) => g.picks.length > 0);
}
