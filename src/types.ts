export type Role =
  | 'core_starter'
  | 'starter_when_healthy'
  | 'significant_contributor'
  | 'contributor'
  | 'depth'
  | 'non_contributor';

export interface Season {
  year: number;
  gamesPlayed: number;
  /**
   * Team games the season offered. **Zero means the season has not been
   * played** — the row exists only to carry `retained`/`currentTeam` for an
   * upcoming season, sourced from the offseason roster release.
   *
   * Such a row says where a player stands, not how he did: `gamesPlayed` and
   * `snapShare` are zero because nothing has happened, not because he was bad.
   * Anything measuring football must therefore skip it — see
   * `src/lib/seasonPlayed.ts`, which is the only place this rule is spelled out.
   */
  teamGames: number;
  /** Average per-game role share in games with snaps (UI “Snap” column) */
  snapShare: number;
  /**
   * Season load: player snaps ÷ primary team’s full-season snap capacity (K/P/LS
   * include ST in both parts), with injury-report adjustment when available.
   * Traded seasons use games-played ratio in data script. Stored capped at
   * snapShare when computed load would exceed weekly average. Role tiering only;
   * omit in older data.
   */
  cumulativeSnapShare?: number;
  retained: boolean;
  /** Weeks on official injury report (from nflverse injuries data) */
  injuryReportWeeks?: number;
  /**
   * Team games missed after the player's last snap of the season — an injury
   * that ended his year. Present only when non-zero. A player on IR leaves the
   * weekly injury report, so `injuryReportWeeks` misses these seasons entirely;
   * see `src/lib/seasonEndingAbsence.ts`.
   */
  seasonEndingAbsenceGames?: number;
  /** Team abbreviation the player played for (set when retained === false) */
  currentTeam?: string;
}

export interface DraftPick {
  playerId: string;
  playerName: string;
  position: string;
  round: number;
  overallPick: number;
  teamId: string;
  /**
   * Year the pick was made. Not present in `draft-{year}.json` — stamped from
   * the enclosing class by `stampDraftYear` at parse time, so scoring can size
   * a pick's rookie-contract window without reaching for the class.
   */
  draftYear: number;
  espnId?: string;
  /** NFL headshot URL from nflverse players */
  headshotUrl?: string;
  seasons: Season[];
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
}

export interface DraftClass {
  year: number;
  picks: DraftPick[];
}

/** Written by `npm run update-data` as `public/data/data-meta.json` */
export interface DataMeta {
  /** UTC calendar date `YYYY-MM-DD` when draft JSON was last regenerated */
  lastUpdated: string;
}

export interface DefaultRankingsData {
  from: number;
  to: number;
  rankings: Array<{
    teamId: string;
    teamName: string;
    score: number;
    rank: number;
    /** Mean pick score above draft-slot expectation ("over slot"). */
    overSlot: number;
    totalPicks: number;
    coreStarterRate: number;
    retentionRate: number;
  }>;
}

/** Pre-computed draft scores for the fixed lagged draft window (2018–2021). */
export interface LaggedDraftRankingsData {
  from: number;
  to: number;
  rankings: Array<{
    teamId: string;
    teamName: string;
    score: number;
    /** Over slot: draft value above what each pick's slot predicted. */
    overSlot: number;
  }>;
}

export interface PositionBaselinesData {
  /** UTC calendar date `YYYY-MM-DD` when baselines were derived. */
  generatedAt: string;
  /** Human-readable description of the derivation method. */
  method: string;
  /** Full-time-starter snap share per draft position label (0–1]. */
  baselines: Record<string, number>;
}

/**
 * The empirical draft-slot expectation curve, smoothed over `ln(pick)` from
 * mature draft classes (see `scripts/derive-draft-slot-baseline.ts`).
 * Drives the "over slot" residual — a pick's score above what its draft position
 * predicts.
 */
export interface DraftSlotBaselineData {
  /** UTC calendar date `YYYY-MM-DD` when the fit was derived. */
  generatedAt: string;
  /** Human-readable description of the derivation method. */
  method: string;
  /** Earliest mature draft year contributing to the fit. */
  matureFrom: number;
  /** Latest mature draft year contributing to the fit. */
  matureTo: number;
  /** Number of scored picks the fit was computed from. */
  pointCount: number;
  /**
   * The expectation curve as knots in ascending pick order, with non-increasing
   * expected scores. Evaluated by log-space interpolation between knots.
   */
  knots: { overallPick: number; expected: number }[];
}

/**
 * Hand-maintained list of picks held off the "biggest busts" highlight because
 * their career ended for a reason outside football. See
 * `src/lib/bustExclusions.ts` for the scope rules.
 */
export interface BustExclusionsData {
  /** Why this file exists and what belongs in it. */
  note: string;
  exclusions: Array<{
    playerId: string;
    playerName: string;
    /** One of `BUST_EXCLUSION_REASONS`. */
    reason: string;
    /** One-line justification, so entries can be audited in place. */
    detail: string;
  }>;
}

export const ActiveView = {
  TeamDetail: 'teamDetail',
  TeamRankings: 'teamRankings',
  DraftYears: 'draftYears',
  Position: 'position',
  Highlights: 'highlights',
} as const;

export type ActiveView = (typeof ActiveView)[keyof typeof ActiveView];
