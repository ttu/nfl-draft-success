/**
 * Was a player still with the team that acquired him, in a given season?
 * Used by scripts/update-data.ts; see docs/calculations.md.
 *
 * Nothing in the nflverse feeds states retention directly, so it is read off
 * whichever feed named a team that year. They are consulted in order of how
 * directly each one observed him.
 */
import { normalizeNflverseTeam } from './nflverseFranchise';

/** A season's worth of a feed, reduced to the team it put the player on. */
interface TeamBySeason {
  primaryTeam: string;
}

export interface RetentionSignals {
  /** Team he took most of his snaps for, from snap counts. Strongest signal. */
  primaryTeam: string;
  /** Team he was listed against on the weekly injury report. */
  injuryTeam: string;
  /** Team he spent his reserve weeks with, from the weekly roster feed. */
  reserveTeam: string;
  /**
   * Whether the weekly roster feed carried him anywhere in the league this
   * season. `undefined` when that feed did not speak for the season at all —
   * before 2016, or a release that failed to load — where absence proves
   * nothing. See {@link resolveRetained}.
   */
  rosteredThisSeason?: boolean;
  /** The team being judged: who drafted or signed him. */
  teamId: string;
  season: number;
  playerSnaps?: Map<number, TeamBySeason>;
  playerInjuries?: Map<number, TeamBySeason>;
}

/**
 * Whether a player was still with `teamId` in `season`.
 *
 * Snap data speaks first: a player who took snaps somewhere was, that year, a
 * member of that roster, whatever else any feed says. The injury report comes
 * next, covering a season spent dressed but unused.
 *
 * Reserve weeks are the third witness, and the reason the fallback below is
 * not the last word. A player who loses a season to injured reserve takes no
 * snaps *and* leaves the injury report the day he is placed, so the two feeds
 * above go quiet for exactly the players whose absence is least voluntary. The
 * weekly roster feed still carries him, named against the team that is paying
 * him. See `accumulateReserveTeams`.
 *
 * Only when no feed names a team at all — a practice-squad year, a season
 * entirely off the radar — is retention inferred from the seasons either side:
 * bracketed by the same team means he never left it. That inference needs an
 * adjacent season to exist, which is why it cannot stand in for the reserve
 * signal: a rookie who is hurt in camp has no previous season, and a player in
 * his newest tracked season has no next one.
 *
 * The inference runs only where there is genuinely nothing to go on. A season
 * the weekly roster feed covered, and in which it lists him on no roster in
 * the league, is positive evidence that he was not on one — the feed carries
 * every player on every roster every week — so it settles the season instead.
 * Without that, the year a player leaves football is read as one more season
 * with the team that drafted him: Anthony Barr's 2024, copied from the 2023
 * he really did play for Minnesota, scored 0 against the pick.
 */
export function resolveRetained(signals: RetentionSignals): boolean {
  const {
    primaryTeam,
    injuryTeam,
    reserveTeam,
    rosteredThisSeason,
    teamId,
    season,
    playerSnaps,
    playerInjuries,
  } = signals;

  const named = firstNamedTeam(primaryTeam, injuryTeam, reserveTeam);
  if (named !== '') return normalizeNflverseTeam(named) === teamId;

  // Nobody rostered him, and the feed is in a position to know: that is a
  // departure stated outright, not a gap to be guessed at.
  if (rosteredThisSeason === false) return false;

  const teamIn = (year: number): string =>
    playerSnaps?.get(year)?.primaryTeam ??
    playerInjuries?.get(year)?.primaryTeam ??
    '';

  return (
    normalizeNflverseTeam(teamIn(season + 1)) === teamId ||
    normalizeNflverseTeam(teamIn(season - 1)) === teamId
  );
}

/**
 * The first feed to name a team, in the order {@link resolveRetained} trusts
 * them. Shared with the caller that labels a departed season, so the team
 * shown is always the one retention was decided against.
 */
export function firstNamedTeam(...candidates: string[]): string {
  return candidates.find((team) => team !== '') ?? '';
}
