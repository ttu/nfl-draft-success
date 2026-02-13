# Spec Clarifications

Single source of truth for all spec decisions, edge cases, and formulas. Prevents drift during implementation.

## Role Weights

| Role                    | Weight |
| ----------------------- | ------ |
| Core Starter            | 3      |
| Starter when healthy    | 3      |
| Significant Contributor | 2      |
| Depth                   | 1      |
| Non-Contributor         | 0      |

## Role Classification (per season)

```
gamesPlayedShare = gamesPlayed / teamGames
```

Classification order (first match wins):

1. `snapShare >= 0.65` AND `gamesPlayedShare >= 0.5` → `core_starter`
2. `snapShare >= 0.65` AND `gamesPlayedShare < 0.5` → `starter_when_healthy`
3. `snapShare >= 0.35` → `significant_contributor`
4. `snapShare >= 0.1` → `depth`
5. Else → `non_contributor`

**Overall classification:** Player's highest achieved role across all seasons determines their overall classification.

## Retention

**Definition:** Still on the drafting team (same franchise).

**Franchise moves to handle:** STL→LAR, SD→LAC, OAK→LV.

## Contributor Count

**Definition:** All non-zero roles — Core Starter + Starter when healthy + Significant Contributor + Depth.

## Ongoing Seasons

Include with partial data. Metrics computed from available games. `teamGames` = games played by team so far in that season.

## Team Metrics (per draft class)

- Total picks
- Core starter count
- Starter when healthy count
- Contributor count (all non-zero roles)
- Retention count (still on drafting team)
- Core Starter Rate
- Contributor Rate
- Retention Rate

## 5-Year Rolling Score

- Score per player = highest role weight
- Team Score = (sum of player scores) / (total picks)
- Display: 5-Year Draft Score, Core Starter %, Retention %

## JSON Field Names

| Field          | Type     |
| -------------- | -------- |
| playerId       | string   |
| playerName     | string   |
| position       | string   |
| round          | number   |
| overallPick    | number   |
| teamId         | string   |
| espnId         | string?  |
| seasons        | Season[] |

| Season field   | Type    |
| -------------- | ------- |
| year           | number  |
| gamesPlayed    | number  |
| teamGames      | number  |
| snapShare      | number  |
| retained       | boolean |
