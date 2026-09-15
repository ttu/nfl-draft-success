# Data Model

Data structures for `public/data/draft-{year}.json`, `public/data/fa-{year}.json`, and TypeScript types in `src/types.ts`.

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
        float cumulativeSnapShare_optional
        boolean retained
        int injuryReportWeeks_optional
        int seasonEndingAbsenceGames_optional
        int reserveWeeks_optional
        int excusedGames_optional
    }
```

## TypeScript Types

```ts
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
  snapShare: number;
  /** Season load (player snaps / primary team full-season capacity; see calculations.md). Stored capped at `snapShare` when computed load would exceed it. Optional on older files. */
  cumulativeSnapShare?: number;
  retained: boolean;
  /** Weeks on official injury report (nflverse injuries data). Optional. */
  injuryReportWeeks?: number;
  /** Team games missed after the player's last snap — an injury that ended his season. Present only when non-zero; a player on IR leaves the injury report, so these seasons have no `injuryReportWeeks`. */
  seasonEndingAbsenceGames?: number;
  /** Weeks on a reserve list (nflverse weekly rosters) — the direct IR measurement. Present only when non-zero, and only from 2016 on. Era-exclusive with `seasonEndingAbsenceGames`: a season carries one or the other, never both — 2016+ writes `reserveWeeks`, 2013–2015 writes `seasonEndingAbsenceGames`. */
  reserveWeeks?: number;
  /** Games the load denominator actually forgave for injury: `| missedWeeks ∩ (injury-report weeks ∪ reserve weeks) |` (see `src/lib/absenceWeeks.ts`). Present only when non-zero. The authoritative figure — consumers must read this rather than re-derive it from `injuryReportWeeks` / `reserveWeeks`, which count documented weeks, not games lost, and disagree with the stored score. */
  excusedGames?: number;
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
  "seasonsThrough": 2025,
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

## Undrafted Free Agents

`public/data/fa-{year}.json`, one file per class from 2013 through 2025 — no 2026 file, deliberately: the incoming class has taken no snaps yet, and the loader resolves a missing year to an empty class rather than an error.

```ts
export interface FreeAgent {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  /**
   * The class year he belongs to: the season he debuted, not his
   * `rookie_season` and not the year he signed. Stamped from the enclosing
   * class by `stampFreeAgentYear`, not stored in fa-{year}.json.
   */
  draftYear: number;
  espnId?: string;
  headshotUrl?: string;
  seasons: Season[];
}

export interface FreeAgentClass {
  year: number;
  freeAgents: FreeAgent[];
}
```

`FreeAgent` is deliberately `DraftPick` minus `round` and `overallPick` — the absence of `round` is what the code discriminates a free agent on, and `seasons` is the identical `Season[]` shape, so load, role tiering, injury forgiveness, and every other season-level calculation apply unchanged.

| Field       | Type     | Notes                                                                                                 |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------- |
| playerId    | string   |                                                                                                       |
| playerName  | string   |                                                                                                       |
| position    | string   |                                                                                                       |
| teamId      | string   | the franchise that owns him — his first-snap team (§ Undrafted Free Agents, `SPEC_CLARIFICATIONS.md`) |
| draftYear   | number   | **his debut season**, not `rookie_season` — stamped at load time, not present in the JSON file        |
| espnId      | string?  |                                                                                                       |
| headshotUrl | string?  |                                                                                                       |
| seasons     | Season[] | identical `Season` shape used by draft picks                                                          |

### Example: fa-2019.json

```json
{
  "year": 2019,
  "freeAgents": [
    {
      "playerId": "00-0035228",
      "playerName": "Austin Ekeler",
      "position": "RB",
      "teamId": "LAC",
      "seasons": [
        {
          "year": 2019,
          "gamesPlayed": 16,
          "teamGames": 16,
          "snapShare": 0.41,
          "retained": true
        }
      ]
    }
  ]
}
```

### Elided season rows

Both class files carry `seasonsThrough`: the newest played season the writer ran
season rows out to. Rows for years a player spent **out of the league** are left
out of the file up to that year and rebuilt at parse time by
`src/lib/trailingSeasons.ts`, from the per-franchise game counts in
`src/data/team-games.json`. About a quarter of the payload, and every field on
such a row is implied by the player's franchise and the year.

The rows still count. Career-mode scoring divides across every season since a
player entered the league, so those zeros are his penalty for a short career —
they are simply back in place before anything scores. `stampDraftYear` and
`stampFreeAgentYear` are the only places this happens, so nothing in `src/lib`
or `src/components` sees a shortened career.

Only a genuinely empty year is elided. A season the player was rostered for but
never played (`retained: true`), one spent on injured reserve (`reserveWeeks`),
and the offseason roster row (`teamGames: 0`) all stay in the file — they carry
information no lookup can put back. A class with no `seasonsThrough` (a test
fixture, or a file from a deploy that predates this) is left exactly as stored.

Note `draftYear` is absent from the stored file — it is stamped as `2019` (the enclosing class's `year`, his debut season) by `stampFreeAgentYear` at parse time, exactly as `stampDraftYear` stamps a `DraftPick.draftYear` from its enclosing `draft-{year}.json`.

## Team Metadata

32 teams with id, name, abbreviation. IDs align with nflverse (e.g. KC, BUF, LAR). Include franchise history for retention: OAK→LV, SD→LAC, STL→LAR.
