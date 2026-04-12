# Calculation Reference

Detailed documentation of all formulas and calculations used in the NFL Draft Retention & Role Tracker. See also [SPEC_CLARIFICATIONS.md](./SPEC_CLARIFICATIONS.md) for spec decisions and [datamodel.md](./datamodel.md) for data structures.

---

## 1. Raw Data Derivation (update-data.ts)

Data comes from [nflverse](https://github.com/nflverse/nflverse-data). The `scripts/update-data.ts` script fetches and transforms CSV data into the JSON format consumed by the app.

### 1.1 Snap Share (per season, per player)

**Source:** `snap_counts_{season}.csv` plus `players.csv` (`position_group`, `position` by `pfr_id`).

**Definition:** Average of a per-game share across games with snaps &gt; 0. The per-game share depends on whether the player is a special-teams specialist:

- **Kickers, punters, long snappers** (`position_group` = `SPEC`, or `position` is `K`, `P`, or `LS`):  
  `share[game] = max(offense_pct, defense_pct, st_pct)`
- **All other players:**  
  `share[game] = max(offense_pct, defense_pct)`  
  Special teams pct is omitted so positional players who mostly play ST (e.g. a safety with few defensive snaps) are not classified like full-time starters.

**Formula:**

```
For each game row where the player had snaps > 0:
  share[game] = per-game share (see above)

snapShare = (sum of share[game] for all games) / gamesPlayed
```

**Range:** 0.0–1.0 (unit share)

**Notes:**

- Including `st_pct` only for specialists matches contribution for K/P/LS while keeping role bands meaningful for offense/defense positions.
- If `pfr_id` is missing from `players.csv`, the non-specialist rule applies (conservative).
- Games with zero snaps are excluded; the player does not increment `gamesPlayed` for that week.

### 1.2 Season load share (cumulative, per season, per player)

**Purpose:** Role tier thresholds (65% / 35% / 10%) use this value so **missed games** reduce a player’s tier: inactive weeks add nothing to the numerator but the denominator still reflects the **full team season**.

**Numerator (`playerNum`):** For each game row with snaps &gt; 0, add player scrimmage snaps (offense + defense; kickers/punters/long snappers also add ST snaps), same rules as `playerSnapsForCumulativeLoad` in `src/lib/snapCountTotals.ts`.

**Denominator (single-franchise seasons):** Sum team snap capacity **for every game that franchise played** in that season (from `snap_counts`, one row per `(game_id, team)`):

- **Non-specialists:** Sum of `team_offense_snaps + team_defense_snaps` per game (from percentages on any row for that game).
- **Specialists (K, P, LS / SPEC):** Sum of scrimmage capacity **plus** team special-teams capacity per game (so numerator and denominator stay comparable).

Franchise codes are normalized (`src/lib/nflverseFranchise.ts`). Let `teamSeasonDen` be that full-season total for the player’s **primary team** (most snaps).

```
cumulativeSnapShare = sum(playerNum) / teamSeasonDen
```

**Injury adjustment:** After the base load is computed, we optionally **shrink the denominator** using nflverse injury data (`injuryReportWeeks` on the season). Let `missedGames = max(0, teamGames - gamesPlayed)` and `excusedWeeks = min(injuryReportWeeks, missedGames)`. We subtract `excusedWeeks × (teamSeasonDen / gameCount)` where `gameCount` is the number of distinct games that franchise played in `snap_counts`. That approximates “weeks missed while on the injury report” without penalizing load for those absences as harshly as healthy scratches. Applied only for single-franchise seasons when merging draft output (`resolveCumulativeLoadShareWithInjury`).

**Cap vs Avg snap:** Full-season + injury math can still produce a load **above** average weekly role share. We set `cumulativeSnapShare = min(computedLoad, snapShare)` when storing JSON and in `snapShareForRoleTier`, so Load never exceeds **Avg snap** (typical usage when active).

**Multi-team seasons (traded mid-year):** If the player appears on more than one franchise in `snap_counts` for that year, fall back to the **games-played** ratio: `sum(playerNum) / sum(teamDen per game row)` so we do not attribute one team’s full-season denominator to snaps earned with another club. Injury adjustment is **not** applied (no `loadMeta`).

**Implementation:** `scripts/update-data.ts`, `buildTeamSeasonDenominatorTotals`, `injuryAdjustedFullSeasonDenominator`, and `resolveCumulativeLoadShareWithInjury` in `src/lib/teamSeasonDenominator.ts`; per-game helpers in `src/lib/snapCountTotals.ts`. Stored as `cumulativeSnapShare` on each `Season`.

**Range:** 0.0–1.0 (values above 1.0 are not expected but would clamp in display if ever needed).

### 1.3 Games Played (per season, per player)

**Definition:** Count of games in which the player had at least one snap (offense + defense + ST > 0).

**Source:** Accumulated per-game in snap_counts data. Each row with `snaps > 0` increments the count.

### 1.4 Team Games (per season)

**Definition:** Number of games the team played in that season. Used as the denominator for `gamesPlayedShare`.

**Formula (in script):**

```
maxPlayed = max(gamesPlayed) across all players in the league for that season
teamGames = Math.max(1, Math.min(17, maxPlayed))
```

**Behavior:**

- Regular season is 17 games (since 2021); prior years used 16.
- For ongoing/incomplete seasons: `teamGames` = games played so far by any team (clamped to 1–17).
- Ensures `gamesPlayedShare` is meaningful for partial seasons.

### 1.5 Retention (per season, per player)

**Definition:** Player is considered retained if their primary team (by snap count) matches the drafting franchise.

**Primary team:** Team for which the player accumulated the most snaps in that season. Derived from `teamSnaps` in snap data (or injury report team when no snap data exists).

**Franchise normalization:**
| Old ID | Current ID |
|--------|------------|
| STL | LAR |
| LA | LAR |
| SD | LAC |
| OAK | LV |
| LVR | LV |

**Logic:**

1. If snap data exists: `retained = (normalize(primaryTeam) === teamId)`
2. If no snap data but injury report exists: use injury report team as primary
3. If neither: infer from previous/next season primary team (player on roster but inactive)

---

## 2. Games Played Share

**Formula:**

```
gamesPlayedShare = gamesPlayed / teamGames
```

**Range:** 0.0–1.0+ (can exceed 1.0 if a player appears in more games than team total, e.g., traded mid-season)

**Usage:** Input to role classification. Combined with **cumulative snap share** (`snapShareForRoleTier(season)` — `Season.cumulativeSnapShare` capped at `Season.snapShare` when needed, else fallback) to distinguish Core Starter vs Starter When Healthy.

---

## 3. Role Classification (per season)

**Function:** `classifyRole(cumulativeSnapShare, gamesPlayedShare, gamesPlayed)` in `src/lib/classifyRole.ts`. **`cumulativeSnapShare`** is that effective cumulative value from `snapShareForRoleTier` (stored season load when set, else average share for legacy JSON).

Classification uses a **first-match-wins** order. All thresholds use `>=` (inclusive).

### 3.1 Classification Table

| Order | Condition                                                   | Role                    |
| ----- | ----------------------------------------------------------- | ----------------------- |
| 1     | `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare >= 0.5` | Core Starter            |
| 2     | `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare < 0.5`  | Starter When Healthy    |
| 3     | `cumulativeSnapShare >= 0.35` AND `gamesPlayed >= 2`        | Significant Contributor |
| 4     | `cumulativeSnapShare >= 0.1`                                | Depth                   |
| 5     | (else)                                                      | Non-Contributor         |

### 3.2 Threshold Summary

| Metric              | Core Starter | Starter When Healthy | Significant Contributor | Depth  |
| ------------------- | ------------ | -------------------- | ----------------------- | ------ |
| cumulativeSnapShare | ≥ 0.65       | ≥ 0.65               | ≥ 0.35                  | ≥ 0.10 |
| gamesPlayedShare    | ≥ 0.5        | < 0.5                | —                       | —      |
| gamesPlayed         | —            | —                    | ≥ 2                     | —      |

### 3.3 Edge Cases

- **cumulativeSnapShare = 0, teamGames = 0:** `gamesPlayedShare` is 0; role = `non_contributor`
- **cumulativeSnapShare = 0.65, gamesPlayedShare = 0.5:** Exactly on boundary → `core_starter`
- **cumulativeSnapShare = 0.649, gamesPlayed >= 2:** Fails first two checks → `significant_contributor`
- **cumulativeSnapShare >= 0.35 but `gamesPlayed < 2`:** Not SC; if `cumulativeSnapShare >= 0.1` → `depth` (avoids labeling a one-game sample as a significant contributor)

---

## 4. Player Overall Role (across seasons)

**Functions:** `getPlayerAverageScoreWeight`, `getPlayerRole` in `src/lib/getPlayerRole.ts`

**Definition:** Each season gets a **score weight** (0–3) from its classified role. The pick’s **draft value** is the **mean** of those weights across in-scope seasons. **Overall role** (UI badge, filters, draft-class counts) maps that mean to a representative `Role`, with thresholds at 0.5 / 1.5 / 2.5 on the 0–3 scale. If the mean is in the top band (≥ 2.5), Core Starter vs Starter when healthy is taken from the **peak** single-season role so both weight-3 roles stay distinguishable.

### 4.1 Role Hierarchy (low to high)

Used for peak comparison and mapping; score weights collapse the two starter roles to 3.

1. Non-Contributor
2. Depth
3. Significant Contributor
4. Starter When Healthy
5. Core Starter

### 4.2 Algorithm

1. **Season filter:** If `draftingTeamOnly` is true, only consider seasons where `retained === true`.
2. **Per season:** `classifyRole` → map to score weight via `ROLE_SCORE_WEIGHTS`.
3. **Mean:** Average weight across those seasons (`getPlayerAverageScoreWeight`).
4. **Representative role:** Map mean to Non-Contributor / Depth / Significant Contributor, or (if mean ≥ 2.5) use peak season among `{core_starter, starter_when_healthy}` (`getPlayerRole`).

### 4.3 Option: draftingTeamOnly

When true, only seasons where the player was retained (on drafting team) count toward the mean and peak. Useful to measure contribution _to the drafting team_ rather than career totals elsewhere.

---

## 5. Role Weights (for scoring)

| Role                    | Weight |
| ----------------------- | ------ |
| Core Starter            | 3      |
| Starter When Healthy    | 3      |
| Significant Contributor | 2      |
| Depth                   | 1      |
| Non-Contributor         | 0      |

---

## 6. Draft Class Metrics

**Function:** `getDraftClassMetrics(draft, teamId, options)` in `src/lib/getDraftClassMetrics.ts`

**Scope:** All picks by the given `teamId` in the given `draft` (single year).

### 6.1 Counts

| Metric                      | Definition                                                            |
| --------------------------- | --------------------------------------------------------------------- |
| totalPicks                  | Number of picks by the team in that draft                             |
| coreStarterCount            | Picks with overall role = Core Starter                                |
| starterWhenHealthyCount     | Picks with overall role = Starter When Healthy                        |
| significantContributorCount | Picks with overall role = Significant Contributor                     |
| depthCount                  | Picks with overall role = Depth                                       |
| nonContributorCount         | Picks with overall role = Non-Contributor                             |
| contributorCount            | core_starter + starter_when_healthy + significant_contributor + depth |
| retentionCount              | Picks where `retained === true` in most recent season                 |

### 6.2 Rates

All rates are fractions (0–1). Division by zero yields 0.

| Rate            | Formula                         |
| --------------- | ------------------------------- |
| coreStarterRate | `coreStarterCount / totalPicks` |
| contributorRate | `contributorCount / totalPicks` |
| retentionRate   | `retentionCount / totalPicks`   |

### 6.3 Retention (per pick)

Retention for metrics uses the **most recent season** only:

- Sort seasons by `year` descending
- `retained = latestSeason.retained ?? false`

---

## 7. 5-Year Rolling Score

**Function:** `getFiveYearScore(draftClasses, teamId, options)` in `src/lib/getFiveYearScore.ts`

**Scope:** All picks by the team across the provided draft classes (typically 5 consecutive years).

### 7.1 Score Formula

```
score = sum(player role weight) / totalPicks
```

Where:

- **Player role weight:** The weight for the pick’s overall role (see §5).
- **totalPicks:** Total number of picks by the team across all draft classes.

**Range:** 0.0–3.0 (all Core Starters → 3.0; all Non-Contributors → 0.0)

### 7.2 Auxiliary Metrics

| Metric          | Formula                         |
| --------------- | ------------------------------- |
| coreStarterRate | `coreStarterCount / totalPicks` |
| retentionRate   | `retentionCount / totalPicks`   |

Same retention logic as draft class metrics (most recent season per pick).

### 7.3 Example

Team drafts 10 players across 5 years:

- 2 Core Starters (3 each) → 6
- 3 Significant Contributors (2 each) → 6
- 2 Depth (1 each) → 2
- 3 Non-Contributors (0 each) → 0

Score = (6 + 6 + 2 + 0) / 10 = **1.4**

---

## 8. Contributor Definition

**Contributor** = any non-zero role:

- Core Starter
- Starter When Healthy
- Significant Contributor
- Depth

**Non-Contributor** is excluded from contributor count.

---

## 9. Summary: Calculation Flow

```
Raw nflverse data
    ↓
[update-data.ts] → gamesPlayed, snapShare, teamGames, retained per season
    ↓
gamesPlayedShare = gamesPlayed / teamGames
    ↓
classifyRole(cumulativeSnapShare, gamesPlayedShare, gamesPlayed) → per-season role
    ↓
getPlayerAverageScoreWeight(pick) → mean seasonal weight; getPlayerRole(pick) → representative role from mean (+ peak for starter label)
    ↓
getDraftClassMetrics() → counts, rates per draft class
getFiveYearScore() → score, coreStarterRate, retentionRate across classes
```

---

## 10. Code References

| Calculation         | Source File                       |
| ------------------- | --------------------------------- |
| Role classification | `src/lib/classifyRole.ts`         |
| Player overall role | `src/lib/getPlayerRole.ts`        |
| Draft class metrics | `src/lib/getDraftClassMetrics.ts` |
| 5-Year score        | `src/lib/getFiveYearScore.ts`     |
| Raw data derivation | `scripts/update-data.ts`          |
