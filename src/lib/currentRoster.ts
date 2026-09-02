import type { DraftClass, DraftPick, Role } from '../types';
import { DRAFT_YEAR_BOUNDS } from './draftYearBounds';
import { getPlayerDraftScore, getPlayerRole } from './getPlayerRole';
import { isUnplayedSeason, playedSeasons } from './seasonPlayed';
import { LATEST_SEASON } from './rookieWindow';
import {
  getPositionGroup,
  POSITION_GROUP_LABELS,
  POSITION_GROUP_ORDER,
  type PositionGroupId,
} from './positionGroup';

/** One tracked draftee on a team's current roster. */
export interface RosterEntry {
  pick: DraftPick;
  draftYear: number;
  /** Career mean season score (0–100), or undefined when nothing has been played. */
  score: number | undefined;
  /** Career role badge, or undefined when nothing has been played. */
  role: Role | undefined;
  seasonsPlayed: number;
  /** True when another team drafted him. */
  acquired: boolean;
}

export interface RosterGroup {
  id: PositionGroupId;
  label: string;
  entries: RosterEntry[];
  meanScore: number | undefined;
}

/**
 * The season `update-data.ts` writes the roster snapshot row for — one past
 * the newest *played* season, not the newest *draft class*.
 *
 * Mirrors `rosterSeason = maxSeason + 1` in `scripts/update-data.ts`. The two
 * happen to coincide with `DRAFT_YEAR_BOUNDS.max` (the newest draft class)
 * today, but they are different facts and will drift apart the moment a new
 * season's snap counts publish, months before the following April's draft.
 * Anchoring here on `DRAFT_YEAR_BOUNDS.max` instead would, from that moment,
 * read a real *played* row as if it were the forward-looking snapshot — see
 * the regression test in `currentRoster.test.ts` for what that breaks.
 */
export const ROSTER_SEASON = LATEST_SEASON + 1;

/**
 * Team the pick is on for the season ahead, or `undefined` when he is on no
 * roster at all.
 *
 * Reads the row for {@link ROSTER_SEASON} and nothing else, and only when it
 * is still an unplayed snapshot row (`teamGames === 0` — see
 * `Season.teamGames`). `update-data.ts` writes that row for every player who
 * is on a roster, so its absence is the statement that he is not — a player
 * whose newest row is last season played football but has since gone
 * unsigned, and taking "latest row" instead would keep him on his old team
 * forever.
 *
 * The one exception is the freshest draft class, whose picks have no rows at
 * all until they play: those are assumed to be with the team that drafted
 * them. That check is genuinely about the newest *draft class*, so it keeps
 * comparing against `DRAFT_YEAR_BOUNDS.max`.
 */
export function getCurrentTeamForPick(pick: DraftPick): string | undefined {
  const current = pick.seasons.find(
    (s) => s.year === ROSTER_SEASON && isUnplayedSeason(s),
  );
  if (current) {
    return current.retained ? pick.teamId : current.currentTeam;
  }
  if (pick.seasons.length === 0 && pick.draftYear === DRAFT_YEAR_BOUNDS.max) {
    return pick.teamId;
  }
  return undefined;
}

/**
 * Whether the data includes the {@link ROSTER_SEASON} snapshot row at all,
 * for anyone.
 *
 * `update-data.ts` writes that row from nflverse's offseason roster release,
 * which does not exist until some time after the season it forecasts wraps.
 * A refresh run in that gap produces data with no `ROSTER_SEASON` row for
 * any pick — a different situation from a team that simply has no tracked
 * draftees, and callers should say so rather than claiming an empty roster.
 */
export function hasRosterSnapshot(draftClasses: DraftClass[]): boolean {
  return draftClasses.some((dc) =>
    dc.picks.some((pick) => pick.seasons.some((s) => s.year === ROSTER_SEASON)),
  );
}

/**
 * Every tracked draftee currently on `teamId`, drafted by anyone.
 *
 * Scores in career mode — the mean of the seasons he actually played, for any
 * team. The question this page asks is how good the player has been, not what
 * his drafting team got out of him, so the rookie-window denominator that
 * `draftingTeamOnly` applies would be the wrong measure here.
 */
export function getCurrentRoster(
  draftClasses: DraftClass[],
  teamId: string,
): RosterEntry[] {
  const entries: RosterEntry[] = [];
  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      if (getCurrentTeamForPick(pick) !== teamId) continue;
      const seasonsPlayed = playedSeasons(pick).length;
      entries.push({
        pick,
        draftYear: dc.year,
        score: seasonsPlayed > 0 ? getPlayerDraftScore(pick) : undefined,
        role: seasonsPlayed > 0 ? getPlayerRole(pick) : undefined,
        seasonsPlayed,
        acquired: pick.teamId !== teamId,
      });
    }
  }
  return entries;
}

/** Mean score of the entries that have one; undefined when none have. */
export function rosterMeanScore(
  entries: Pick<RosterEntry, 'score'>[],
): number | undefined {
  const scored = entries.filter(
    (e): e is { score: number } => e.score !== undefined,
  );
  if (scored.length === 0) return undefined;
  return scored.reduce((sum, e) => sum + e.score, 0) / scored.length;
}

/**
 * Roster split into position groups in depth-chart order, best score first
 * within each. Players awaiting their first season sort last — they have no
 * score to rank, and a zero would read as a bad one.
 */
export function groupRosterByPosition(entries: RosterEntry[]): RosterGroup[] {
  const byGroup = new Map<PositionGroupId, RosterEntry[]>();
  for (const entry of entries) {
    const id = getPositionGroup(entry.pick.position);
    const list = byGroup.get(id) ?? [];
    list.push(entry);
    byGroup.set(id, list);
  }

  const groups: RosterGroup[] = [];
  for (const id of POSITION_GROUP_ORDER) {
    const list = byGroup.get(id);
    if (!list || list.length === 0) continue;
    // -1 sentinel for "no score yet" relies on scores never being negative
    // (season scores are clamped to 0–100), so it always sorts last.
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    groups.push({
      id,
      label: POSITION_GROUP_LABELS[id],
      entries: list,
      meanScore: rosterMeanScore(list),
    });
  }
  return groups;
}
