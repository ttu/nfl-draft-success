/**
 * Who is eligible for the undrafted free-agent cohort.
 *
 * Eligibility is decided from `players.csv` alone — `rookie_season` is
 * authoritative rather than a first-snap heuristic, so a veteran whose earliest
 * snap happens to land inside the data window is never mislabeled a
 * first-timer. Which class an eligible player lands in is a separate question,
 * answered by his first snap (see `firstSnapTeam.ts`); the snap data that
 * decides it lives with the caller.
 */

/** Earliest class the site tracks; matches the draft's `FIRST_DRAFT_YEAR`. */
export const FA_FIRST_CLASS_YEAR = 2013;

/** The `players.csv` fields the cohort rule reads, already parsed. */
export interface NflversePlayerRow {
  pfrId: string;
  gsisId: string;
  playerName: string;
  position: string;
  rookieSeason: number | null;
  draftYear: number | null;
  draftPick: number | null;
  headshot: string;
  espnId: string;
}

/**
 * True when this player is eligible for the free-agent cohort at all: he
 * entered the league undrafted, in a season the site tracks.
 *
 * Eligibility is deliberately separate from which class he lands in. His class
 * is the season he first played, which can be later than his `rookie_season` —
 * a player who spent his first year on a practice squad belongs to the class of
 * his debut. But `rookie_season` is still what makes him a first-timer rather
 * than a veteran whose earliest snap merely happens to fall inside the data
 * window, so it stays the gate.
 *
 * A recorded `draftYear` *or* `draftPick` disqualifies him: nflverse rows are
 * inconsistent about which draft columns are populated, and a player with one
 * but not the other is a drafted player with a gap in his record, not an
 * undrafted one.
 */
export function isUndraftedAndTracked(row: NflversePlayerRow): boolean {
  if (row.draftYear != null || row.draftPick != null) return false;
  return row.rookieSeason != null && row.rookieSeason >= FA_FIRST_CLASS_YEAR;
}
