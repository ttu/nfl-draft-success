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
    totalPicks: number;
    coreStarterRate: number;
    retentionRate: number;
  }>;
}

export const ActiveView = {
  TeamDetail: 'teamDetail',
  TeamRankings: 'teamRankings',
  DraftYears: 'draftYears',
  Position: 'position',
} as const;

export type ActiveView = (typeof ActiveView)[keyof typeof ActiveView];
