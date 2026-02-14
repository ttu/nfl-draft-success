# Calculation Reference

Detailed documentation of all formulas and calculations used in the NFL Draft Retention & Role Tracker. See also [SPEC_CLARIFICATIONS.md](./SPEC_CLARIFICATIONS.md) for spec decisions and [datamodel.md](./datamodel.md) for data structures.

---

## 1. Raw Data Derivation (update-data.ts)

Data comes from [nflverse](https://github.com/nflverse/nflverse-data). The `scripts/update-data.ts` script fetches and transforms CSV data into the JSON format consumed by the app.

### 1.1 Snap Share (per season, per player)

**Source:** `snap_counts_{season}.csv`

**Definition:** Average of `max(offense_pct, defense_pct, st_pct)` across games played in that season.

**Formula:**

```
For each game row where the player had snaps > 0:
  share[game] = max(offense_pct, defense_pct, st_pct)

snapShare = (sum of share[game] for all games) / gamesPlayed
```

**Range:** 0.0–1.0 (unit share)

**Notes:**

- Using the maximum of offense/defense/ST ensures kickers, punters, and long snappers receive appropriate contribution credit (they play mainly special teams).
- Games with zero snaps are excluded; the player does not increment `gamesPlayed` for that week.

### 1.2 Games Played (per season, per player)

**Definition:** Count of games in which the player had at least one snap (offense + defense + ST > 0).

**Source:** Accumulated per-game in snap_counts data. Each row with `snaps > 0` increments the count.

### 1.3 Team Games (per season)

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

### 1.4 Retention (per season, per player)

**Definition:** Player is considered retained if their primary team (by snap count) matches the drafting franchise.

**Primary team:** Team for which the player accumulated the most snaps in that season. Derived from `teamSnaps` in snap data (or injury report team when no snap data exists).

**Franchise normalization:**
| Old ID | Current ID |
|--------|------------|
| STL | LAR |
| SD | LAC |
| OAK | LV |

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

**Usage:** Input to role classification. Combined with `snapShare` to distinguish Core Starter vs Starter When Healthy.

---

## 3. Role Classification (per season)

**Function:** `classifyRole(snapShare, gamesPlayedShare)` in `src/lib/classifyRole.ts`

Classification uses a **first-match-wins** order. All thresholds use `>=` (inclusive).

### 3.1 Classification Table

| Order | Condition                                         | Role                    |
| ----- | ------------------------------------------------- | ----------------------- |
| 1     | `snapShare >= 0.65` AND `gamesPlayedShare >= 0.5` | Core Starter            |
| 2     | `snapShare >= 0.65` AND `gamesPlayedShare < 0.5`  | Starter When Healthy    |
| 3     | `snapShare >= 0.35`                               | Significant Contributor |
| 4     | `snapShare >= 0.1`                                | Depth                   |
| 5     | (else)                                            | Non-Contributor         |

### 3.2 Threshold Summary

| Metric           | Core Starter | Starter When Healthy | Significant Contributor | Depth  |
| ---------------- | ------------ | -------------------- | ----------------------- | ------ |
| snapShare        | ≥ 0.65       | ≥ 0.65               | ≥ 0.35                  | ≥ 0.10 |
| gamesPlayedShare | ≥ 0.5        | < 0.5                | (any)                   | (any)  |

### 3.3 Edge Cases

- **snapShare = 0, teamGames = 0:** `gamesPlayedShare` is 0; role = `non_contributor`
- **snapShare = 0.65, gamesPlayedShare = 0.5:** Exactly on boundary → `core_starter`
- **snapShare = 0.649:** Fails first two checks → `significant_contributor`

---

## 4. Player Overall Role (across seasons)

**Function:** `getPlayerRole(pick, options)` in `src/lib/getPlayerRole.ts`

**Definition:** The player's **highest** achieved role across all seasons (by role hierarchy).

### 4.1 Role Hierarchy (low to high)

1. Non-Contributor
2. Depth
3. Significant Contributor
4. Starter When Healthy
5. Core Starter

### 4.2 Algorithm

1. **Season filter:** If `draftingTeamOnly` is true, only consider seasons where `retained === true`.
2. **Zero games in most recent season:** If the most recent season has `gamesPlayed === 0`, return `non_contributor` immediately. (Player is free agent, cut, holdout, etc.)
3. **Iterate seasons:** For each (filtered) season, compute `classifyRole(snapShare, gamesPlayedShare)`.
4. **Take maximum:** Return the highest role achieved (by position in hierarchy).

### 4.3 Option: draftingTeamOnly

When true, only seasons where the player was retained (on drafting team) count toward role. Useful to measure contribution _to the drafting team_ rather than career-best elsewhere.

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
classifyRole(snapShare, gamesPlayedShare) → per-season role
    ↓
getPlayerRole(pick) → overall role (max across seasons, with zero-games override)
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
