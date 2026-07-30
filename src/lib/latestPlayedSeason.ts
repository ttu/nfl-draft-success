/**
 * The newest NFL season that has actually been played, discovered by asking
 * the data rather than by hard-coding a year.
 *
 * A hard-coded value is wrong for a window of months every year: nobody
 * remembers to bump it in September, and until they do the pipeline ignores the
 * season in progress while still labelling it "not played yet". Deriving it
 * means a mid-season update just works.
 *
 * The search runs **downward** from `ceiling`. During a season that costs one
 * probe — the usual case — where walking up from `floor` would spend a request
 * per year since the dataset began, on every run.
 *
 * `floor` is returned when nothing above it reports data. It is a lower bound
 * on the answer, never an upper one, so unlike a hard-coded latest season it
 * cannot go stale in a way that hides real games.
 */
export async function resolveLatestPlayedSeason(options: {
  /** Oldest season worth considering; returned when no probe finds data. */
  floor: number;
  /** Newest season to consider, normally the current calendar year. */
  ceiling: number;
  /**
   * True when `season` has played games on record. A rejection counts as no
   * data: a transient failure must not promote a season nobody has played,
   * which would resize every pick's rookie window against phantom games.
   */
  hasPlayedData: (season: number) => Promise<boolean>;
}): Promise<number> {
  const { floor, ceiling, hasPlayedData } = options;

  for (let season = ceiling; season > floor; season--) {
    let hasData = false;
    try {
      hasData = await hasPlayedData(season);
    } catch {
      hasData = false;
    }
    if (hasData) return season;
  }

  return floor;
}
