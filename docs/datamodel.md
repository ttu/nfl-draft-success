# Data Model

Data structures for `public/data/draft-{year}.json` and TypeScript types in `src/types.ts`.

## Schema Overview

```mermaid
erDiagram
    DraftClass ||--o{ DraftPick : contains
    DraftPick ||--o{ Season : has

    DraftClass {
        int year
    }

    DraftPick {
        string playerId
        string playerName
        string position
        int round
        int overallPick
        string teamId
    }

    Season {
        int year
        int gamesPlayed
        int teamGames
        float snapShare
        boolean retained
        int injuryReportWeeks_optional
    }
```

## TypeScript Types

```ts
export type Role =
  | 'core_starter'
  | 'starter_when_healthy'
  | 'significant_contributor'
  | 'depth'
  | 'non_contributor';

export interface Season {
  year: number;
  gamesPlayed: number;
  teamGames: number;
  snapShare: number;
  retained: boolean;
  /** Weeks on official injury report (nflverse injuries data). Optional. */
  injuryReportWeeks?: number;
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
```

## JSON Layout

**Recommendation:** One file per year, all teams — `public/data/draft-{year}.json`.

Team-centric view filters client-side.

### Example: draft-2023.json

```json
{
  "year": 2023,
  "picks": [
    {
      "playerId": "00-0033873",
      "playerName": "Patrick Mahomes",
      "position": "QB",
      "round": 1,
      "overallPick": 10,
      "teamId": "KC",
      "espnId": "3139477",
      "headshotUrl": "https://static.www.nfl.com/image/upload/...",
      "seasons": [
        {
          "year": 2017,
          "gamesPlayed": 1,
          "teamGames": 16,
          "snapShare": 0.02,
          "retained": true
        },
        {
          "year": 2018,
          "gamesPlayed": 16,
          "teamGames": 16,
          "snapShare": 0.98,
          "retained": true,
          "injuryReportWeeks": 2
        }
      ]
    }
  ]
}
```

### Minimal Example (for testing)

```json
{
  "year": 2023,
  "picks": [
    {
      "playerId": "p1",
      "playerName": "Test Player",
      "position": "WR",
      "round": 1,
      "overallPick": 5,
      "teamId": "KC",
      "seasons": [
        {
          "year": 2023,
          "gamesPlayed": 15,
          "teamGames": 17,
          "snapShare": 0.72,
          "retained": true
        }
      ]
    }
  ]
}
```

## Team Metadata

32 teams with id, name, abbreviation. IDs align with nflverse (e.g. KC, BUF, LAR). Include franchise history for retention: OAK→LV, SD→LAC, STL→LAR.
