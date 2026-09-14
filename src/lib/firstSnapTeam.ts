import { normalizeNflverseTeam } from './nflverseFranchise';

/**
 * The one field of a player's season snap totals this rule reads.
 *
 * Declared structurally rather than importing the data script's
 * `SeasonSnapData`, so the rule stays a leaf that can be tested with a two-line
 * fixture instead of a fully populated season.
 */
export interface SnapSeasonPrimaryTeam {
  /** The franchise he took the most snaps for that season; `''` when he took none. */
  primaryTeam: string;
}

/** `pfr_id -> season -> that season's primary team`, as `loadSnapData` builds it. */
export type SnapDataIndex = ReadonlyMap<
  string,
  ReadonlyMap<number, SnapSeasonPrimaryTeam>
>;

/**
 * The franchise a player took his first snap for, and the season he took it —
 * `null` when he never took one.
 *
 * This decides two things for an undrafted player, which is why it is a rule
 * and not a lookup: whether he is in the free-agent cohort at all (a player who
 * never took a snap is not), and which class and team he belongs to. The debut
 * season is his class year and the debut franchise owns him, so that his
 * three-season window opens on a season somebody actually played him — the role
 * a draft year and a drafting team fill for a pick.
 *
 * `primaryTeam` is already the team he took the most snaps for that season, so
 * a player split across two rosters in his debut year is credited to the one
 * that actually played him. It is empty when every snap row that season was a
 * zero-snap appearance, which is why an empty team reads as "no snap yet" and
 * the walk continues rather than stopping.
 *
 * Seasons are sorted ascending rather than iterated as they come: the index is
 * a `Map`, which iterates in insertion order, and that order follows whatever
 * order the season CSVs were loaded in. The sort is what makes "first" mean
 * earliest.
 *
 * The team is normalized, so a player whose first snaps came for the Chargers
 * in San Diego is credited to the same franchise as one in Los Angeles.
 */
export function firstSnapTeam(
  pfrId: string,
  snapData: SnapDataIndex,
): { teamId: string; season: number } | null {
  const bySeason = snapData.get(pfrId);
  if (!bySeason) return null;
  for (const season of [...bySeason.keys()].sort((a, b) => a - b)) {
    const primaryTeam = bySeason.get(season)?.primaryTeam ?? '';
    if (primaryTeam) {
      return { teamId: normalizeNflverseTeam(primaryTeam), season };
    }
  }
  return null;
}
