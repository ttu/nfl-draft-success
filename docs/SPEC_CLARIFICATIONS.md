# Spec Clarifications

Single source of truth for all spec decisions, edge cases, and formulas. Prevents drift during implementation.

## Role Weights

| Role                    | Weight |
| ----------------------- | ------ |
| Core Starter            | 4      |
| Starter when healthy    | 4      |
| Significant Contributor | 3      |
| Contributor             | 2      |
| Depth                   | 1      |
| Non-Contributor         | 0      |

## Role Classification (per season)

```
gamesPlayedShare = gamesPlayed / teamGames
```

**Threshold inputs:** For **most positions**, classification uses **cumulative snap share** (Load in the UI): your season snaps ÷ **full-season** team snap capacity for your primary franchise when you only played for one team, with an **injury-report adjustment** that shrinks the denominator for missed games covered by `injuryReportWeeks` (capped by games actually missed); see `docs/calculations.md`. Load is then **capped at `snapShare`** (Avg) so it never exceeds typical per-game role share. For **kickers, punters, and long snappers**, cumulative load vs the entire team’s snap pool is tiny even for full-time starters, so effective tier input is **`snapShare`** (same as the Avg snap column). The career table’s **Load** column still shows stored cumulative share for transparency.

Effective tier input is `snapShareForRoleTier(season, position)` (`src/lib/snapShareForTier.ts`); if `cumulativeSnapShare` is absent (legacy JSON), non-specialists fall back to `snapShare`.

Classification order (first match wins). Let **cumulative snap share** mean `snapShareForRoleTier(season, position)` (stored load capped at Avg when needed for non-specialists; K/P/LS use `snapShare`; legacy JSON falls back to `snapShare`).

1. `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare >= 0.5` → `core_starter`
2. `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare < 0.5` → `starter_when_healthy`
3. `cumulativeSnapShare >=` **SC threshold** AND `gamesPlayed >= 2` → `significant_contributor` (single-game seasons cannot be SC; they fall through). **SC threshold** is **0.35** for most positions and **0.32** for kickers, punters, and long snappers (their avg in-game share rarely reaches the scrimmage-oriented 35% bar).
4. Else if `cumulativeSnapShare >= 0.2` → `contributor` (covers 20% up to the SC threshold and single-game SC fall-through)
5. Else if `cumulativeSnapShare >= 0.1` → `depth` (10–20% load)
6. Else → `non_contributor`

Together, **Depth** (10–20%) and **Contributor** (up to the SC threshold) cover usage below Significant Contributor.

**Overall classification (badges, filters, draft-class buckets):** Derived from the **mean** of each season’s role weight (0–4), then mapped to a representative role. A mixed career (e.g. starter years plus an injured or inactive year) scores below a steady peak. For the top band (mean ≥ 3.5), Core Starter vs Starter when healthy follows the player’s **peak** single-season role among in-scope seasons.

**5-Year / draft score:** Uses the same **mean seasonal weight** per pick (not the peak-only weight).

**Core Starter %:** Share of picks whose **representative** overall role (from mean seasonal weights) is Core Starter — same rule as draft-class “Core starters” counts.

## Retention

**Definition:** Still on the drafting team (same franchise).

**Franchise moves to handle:** STL→LAR, SD→LAC, OAK→LV.

## Contributor Count

**Definition:** All non-zero roles — Core Starter + Starter when healthy + Significant Contributor + Contributor + Depth.

## Ongoing Seasons

Include with partial data. Metrics computed from available games. `teamGames` = that franchise’s games in `snap_counts` so far (regular + postseason), resolved via primary team → injury team → drafting team → league max in file.

## Team Metrics (per draft class)

- Total picks
- Core starter count
- Starter when healthy count
- Significant contributor count
- Contributor tier count (overall role = Contributor)
- Depth count
- Contributor count (all non-zero roles; aggregate)
- Retention count (still on drafting team)
- Core Starter Rate
- Contributor Rate
- Retention Rate

## 5-Year Rolling Score

- Score per player = **mean** of that player’s per-season role weights (0–4)
- Team Score = (sum of player scores) / (total picks)
- Display: 5-Year Draft Score, Core Starter %, Retention %

## JSON Field Names

| Field       | Type     |
| ----------- | -------- |
| playerId    | string   |
| playerName  | string   |
| position    | string   |
| round       | number   |
| overallPick | number   |
| teamId      | string   |
| espnId      | string?  |
| headshotUrl | string?  |
| seasons     | Season[] |

| Season field      | Type    |
| ----------------- | ------- |
| year              | number  |
| gamesPlayed       | number  |
| teamGames         | number  |
| snapShare         | number  |
| retained          | boolean |
| injuryReportWeeks | number? |
