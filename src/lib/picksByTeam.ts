import type { DraftClass, DraftPick } from '../types';

/**
 * Team → picks index, built once per draft class object.
 *
 * The league aggregates ask "which picks belong to team X?" 32 times per class
 * (once per team), and several of them ask more than once. Scanning the class
 * each time makes that O(teams x picks); grouping once makes it O(picks).
 *
 * Keyed weakly on the class object, so an index dies with the class it
 * describes. Sound only because a loaded class is never mutated.
 */
const indexByClass = new WeakMap<DraftClass, Map<string, DraftPick[]>>();

/** Picks in `draft` grouped by drafting team, in original pick order. */
export function getPicksByTeam(
  draft: DraftClass,
): ReadonlyMap<string, readonly DraftPick[]> {
  const hit = indexByClass.get(draft);
  if (hit) return hit;

  const grouped = new Map<string, DraftPick[]>();
  for (const pick of draft.picks) {
    const existing = grouped.get(pick.teamId);
    if (existing) {
      existing.push(pick);
    } else {
      grouped.set(pick.teamId, [pick]);
    }
  }
  indexByClass.set(draft, grouped);
  return grouped;
}

/**
 * One team's picks across `draftClasses`, in class order. Returns a fresh array
 * each call, so callers cannot reach back into the cached index.
 */
export function getTeamPicks(
  draftClasses: DraftClass[],
  teamId: string,
): DraftPick[] {
  const out: DraftPick[] = [];
  for (const draft of draftClasses) {
    const picks = getPicksByTeam(draft).get(teamId);
    if (picks) out.push(...picks);
  }
  return out;
}
