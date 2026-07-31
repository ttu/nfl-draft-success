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

**Injury adjustment:** After the base load is computed, we optionally **shrink the denominator** for absences we treat as excused. Two signals feed it, and we take the **larger**, never the sum — both describe the same absence:

- `injuryReportWeeks`: weeks on the nflverse injury report.
- `seasonEndingAbsenceGames`: team games between a player's **last snap** and the end of their team's season, from `snap_counts` weeks (`src/lib/seasonEndingAbsence.ts`). The nflverse injury feed is the weekly practice/game-status report, and a player placed on IR leaves the 53-man roster and that report entirely — so the most severe injuries produce **zero** report weeks (Nick Bosa has no 2020 rows despite tearing his ACL in week 2). Snap data still shows the shape: present every week, then gone. Weeks are matched against the team's own schedule so byes and playoff runs count correctly, and a gap of one game is ignored (that reads as a rest day or healthy scratch, not an injury). This is a heuristic: a player cut mid-season who never signs elsewhere looks the same as one who went on IR.

Let `missedGames = max(0, teamGames - gamesPlayed)` and `excusedWeeks = min(max(injuryReportWeeks, seasonEndingAbsenceGames), missedGames)`. We subtract `excusedWeeks × (teamSeasonDen / gameCount)` where `gameCount` is the number of distinct games that franchise played in `snap_counts`. That approximates “weeks missed hurt” without penalizing load for those absences as harshly as healthy scratches. Applied only for single-franchise seasons when merging draft output (`resolveCumulativeLoadShareWithInjury`) — for a traded player, absence from one team's remaining schedule is a transaction, not an injury.

Note the **availability** term of the season score (`gamesPlayed / teamGames`, 30% weight) is untouched by this, so a season-ending injury still costs a player most of that component; the adjustment only stops Load from reading the missed games as bench time.

**Cap vs Avg snap:** Full-season + injury math can still produce a load **above** average weekly role share. We set `cumulativeSnapShare = min(computedLoad, snapShare)` when storing JSON and in `snapShareForRoleTier`, so Load never exceeds **Avg snap** (typical usage when active).

**Multi-team seasons (traded mid-year):** If the player appears on more than one franchise in `snap_counts` for that year, fall back to the **games-played** ratio: `sum(playerNum) / sum(teamDen per game row)` so we do not attribute one team’s full-season denominator to snaps earned with another club. Injury adjustment is **not** applied (no `loadMeta`).

**Implementation:** `scripts/update-data.ts`, `buildTeamSeasonDenominatorTotals`, `injuryAdjustedFullSeasonDenominator`, and `resolveCumulativeLoadShareWithInjury` in `src/lib/teamSeasonDenominator.ts`; `seasonEndingAbsenceGames` in `src/lib/seasonEndingAbsence.ts`; per-game helpers in `src/lib/snapCountTotals.ts`. Stored as `cumulativeSnapShare` on each `Season`.

**Range:** 0.0–1.0 (values above 1.0 are not expected but would clamp in display if ever needed).

### 1.3 Games Played (per season, per player)

**Definition:** Count of games in which the player had at least one snap (offense + defense + ST > 0).

**Source:** Accumulated per-game in snap_counts data. Each row with `snaps > 0` increments the count.

### 1.4 Team Games (per season)

**Definition:** Number of games the **relevant franchise** played that NFL season (regular season **and** postseason), used as the denominator for `gamesPlayedShare`. Counts come from distinct `game_id` rows per team in nflverse `snap_counts` (same source as cumulative load `gameCount`).

**Resolution (in script, `resolveTeamGamesDenominator`):**

1. Primary team from snap data (most snaps that season), if known
2. Else injury-report primary team
3. Else drafting franchise
4. Else `max` franchise game count in that season’s file (at least 1)

**Behavior:**

- Playoff games are included so `gamesPlayed` and `teamGames` stay aligned (e.g. 20/20 for a full Bills season with three playoff games).
- Pre-2021 seasons still reflect the schedule length in the data (16-game regular seasons, plus any postseason for that franchise).
- For ongoing/incomplete seasons: each franchise’s count reflects games played so far in `snap_counts`.

### 1.5 Retention (per season, per player)

**Definition:** Player is considered retained if their primary team (by snap count) matches the drafting franchise.

**Primary team:** Team for which the player accumulated the most snaps in that season. Derived from `teamSnaps` in snap data (or injury report team when no snap data exists).

**Franchise normalization:**

| Old ID | Current ID |
| ------ | ---------- |
| STL    | LAR        |
| LA     | LAR        |
| SD     | LAC        |
| OAK    | LV         |
| LVR    | LV         |

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

**Usage:** Input to role classification. Combined with **effective tier share** from `snapShareForRoleTier(season, position)` — for most players this is cumulative load (capped at `Season.snapShare` when needed); for K/P/LS it is `Season.snapShare`.

---

## 2.5 Position-Adjusted Snap Share

**Purpose:** Snap share is not comparable across positions. A full-time offensive lineman plays ~100% of snaps; a lead running back rotates at ~50–65%; a rotational defensive tackle who is unambiguously a starter plays ~45–60%. Applying one absolute Core Starter bar (65%) to all of them made that bar sit at roughly the **15th percentile for QBs** and the **90th percentile for RBs** — about six times harder to clear depending on where a player lines up. To fix this, the effective tier share is divided by a **per-position baseline** before classification and scoring.

**Baseline:** For each position, the snap share of a clearly full-time starter — the **p90** of "qualifying" seasons (those with `gamesPlayed / teamGames >= 0.5`, so we measure role size rather than injury absence). Baselines are derived from the actual draft dataset by `scripts/derive-position-baselines.ts` (logic in `src/lib/deriveBaselines.ts`) and stored in `src/data/position-baselines.json` (a committed, refreshable artifact regenerated during `pnpm update-data`, before the rankings).

```
rawShare        = rawSnapShareForRoleTier(season, position)   // pre-adjustment
normalizedShare = min( rawShare / BASELINE[position], 1 )     // = snapShareForRoleTier(...)
```

The result is "share of a full-time starter's workload at this position," clamped to 1. It replaces the raw share everywhere role classification (§3) and the continuous 0–100 season score (`getSeasonScore`, §7) consume it — both funnel through `snapShareForRoleTier`, the single choke point that applies the division.

**Derivation reads `rawSnapShareForRoleTier`, never `snapShareForRoleTier`.** The latter divides by the very baselines the script writes, so deriving through it is self-referential: each position's p90 is measured against itself and lands on 1.0, which silently turns position adjustment into a no-op on the next `pnpm update-data`. This collapse happens in a **single** run, not gradually, and the resulting all-1.0 file looks plausible. `src/lib/deriveBaselines.test.ts` pins the invariant.

**Exemptions (baseline = 1, i.e. no rescaling):**

- **Kickers, punters, long snappers.** Snap share is measured against a scrimmage-shaped denominator and does not describe specialist workload at all, so normalizing it would be meaningless. They keep raw shares and their existing Significant Contributor carve-out (§3, SCmin = 0.32).
- **Unknown positions** and any position with fewer than 25 qualifying seasons in the dataset. These fall back to a baseline of 1.0, reproducing the pre-adjustment behaviour.

**Effect on interior OL and QB:** their baselines are ~0.99–1.0, so their scores are essentially unchanged. The correction lifts under-credited rotational positions (DT, DL, RB, DE, TE) without moving the positions the old absolute bars already fit.

**Derivation parameters** live in `src/lib/positionBaseline.ts` (`BASELINE_PERCENTILE`, `QUALIFYING_GAMES_SHARE`, `MIN_QUALIFYING_SEASONS`, `BASELINE_FLOOR`) and are shared by the derivation script. See `docs/superpowers/specs/2026-07-17-position-adjusted-snap-scoring-research.md` for the full analysis, the measured per-team ranking shifts, and the open questions this design settled.

---

## 3. Role Classification (per season)

**Function:** `classifyRole(effectiveShare, gamesPlayedShare, gamesPlayed, position?)` in `src/lib/classifyRole.ts`. The first argument is **`snapShareForRoleTier(season, position)`** (stored season load when appropriate, else average share for legacy JSON; kickers/punters/long snappers use `snapShare`), **position-adjusted** by dividing by the per-position baseline (§2.5) for non-exempt positions. Optional **`position`** selects the Significant Contributor floor: **0.35** by default, **0.32** for K/P/LS. The **`gamesPlayed`** argument is retained for call-site compatibility and is not used in classification.

Classification uses a **first-match-wins** order. All thresholds use `>=` (inclusive).

### 3.1 Classification Table

First-match evaluation in `classifyRole` (see `src/lib/classifyRole.ts`). Let **SCmin** = **0.32** for kickers, punters, long snappers and **0.35** for all other positions.

| Order | Condition                                                   | Role                    |
| ----- | ----------------------------------------------------------- | ----------------------- |
| 1     | `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare >= 0.5` | Core Starter            |
| 2     | `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare < 0.5`  | Starter When Healthy    |
| 3     | `cumulativeSnapShare >= SCmin`                              | Significant Contributor |
| 4     | `cumulativeSnapShare >= 0.2`                                | Contributor             |
| 5     | `cumulativeSnapShare >= 0.1`                                | Depth                   |
| 6     | (else)                                                      | Non-Contributor         |

Steps 4–6 apply after any earlier branch fails (e.g. `cumulativeSnapShare` below **SCmin** but still `>= 0.2`).

### 3.2 Threshold Summary

| Role                    | cumulativeSnapShare                      | gamesPlayedShare | gamesPlayed |
| ----------------------- | ---------------------------------------- | ---------------- | ----------- |
| Core Starter            | ≥ 0.65                                   | ≥ 0.5            | —           |
| Starter When Healthy    | ≥ 0.65                                   | < 0.5            | —           |
| Significant Contributor | ≥ **0.35** (most) or **≥ 0.32** (K/P/LS) | —                | —           |
| Contributor             | [0.20, SCmin)                            | —                | —           |
| Depth                   | [0.10, 0.20)                             | —                | —           |
| Non-Contributor         | < 0.10                                   | —                | —           |

### 3.3 Edge Cases

- **cumulativeSnapShare = 0, teamGames = 0:** `gamesPlayedShare` is 0; role = `non_contributor`
- **cumulativeSnapShare = 0.65, gamesPlayedShare = 0.5:** Exactly on boundary → `core_starter`
- **cumulativeSnapShare = 0.649:** Fails first two checks → `significant_contributor`

---

## 4. Player Overall Role (across seasons)

**Functions:** `getPlayerAverageScoreWeight`, `getPlayerRole` in `src/lib/getPlayerRole.ts`

**Definition:** Each season gets a **score weight** (0–4) from its classified role. The pick’s **draft value** is the **mean** of those weights across in-scope seasons. **Overall role** (UI badge, filters, draft-class counts) maps that mean to a representative `Role`, with thresholds at 0.5 / 1.5 / 2.5 / 3.5 on the 0–4 scale. If the mean is in the top band (≥ 3.5), Core Starter vs Starter when healthy is taken from the **peak** single-season role so both weight-4 roles stay distinguishable.

### 4.1 Role Hierarchy (low to high)

Used for peak comparison and mapping; score weights collapse the two starter roles to 4.

1. Non-Contributor
2. Depth
3. Contributor
4. Significant Contributor
5. Starter When Healthy
6. Core Starter

### 4.2 Algorithm

1. **Season filter:** If `draftingTeamOnly` is true, only consider seasons where `retained === true`.
2. **Per season:** `classifyRole` → map to score weight via `ROLE_SCORE_WEIGHTS`.
3. **Mean:** Average weight across those seasons (`getPlayerAverageScoreWeight`).
4. **Representative role:** Map mean to Non-Contributor / Depth / Contributor / Significant Contributor, or (if mean ≥ 3.5) use peak season among `{core_starter, starter_when_healthy}` (`getPlayerRole`).

### 4.3 Option: draftingTeamOnly

When true, only seasons where the player was retained (on drafting team) count toward the mean and peak. Useful to measure contribution _to the drafting team_ rather than career totals elsewhere.

---

## 5. Role Weights (for scoring)

| Role                    | Weight |
| ----------------------- | ------ |
| Core Starter            | 4      |
| Starter When Healthy    | 4      |
| Significant Contributor | 3      |
| Contributor             | 2      |
| Depth                   | 1      |
| Non-Contributor         | 0      |

---

## 6. Draft Class Metrics

**Function:** `getDraftClassMetrics(draft, teamId, options)` in `src/lib/getDraftClassMetrics.ts`

**Scope:** All picks by the given `teamId` in the given `draft` (single year).

### 6.1 Counts

| Metric                      | Definition                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------- |
| totalPicks                  | Number of picks by the team in that draft                                           |
| coreStarterCount            | Picks with overall role = Core Starter                                              |
| starterWhenHealthyCount     | Picks with overall role = Starter When Healthy                                      |
| significantContributorCount | Picks with overall role = Significant Contributor                                   |
| contributorRoleCount        | Picks with overall role = Contributor                                               |
| depthCount                  | Picks with overall role = Depth                                                     |
| nonContributorCount         | Picks with overall role = Non-Contributor                                           |
| contributorCount            | core_starter + starter_when_healthy + significant_contributor + contributor + depth |
| retentionCount              | Picks where `retained === true` in most recent season                               |

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

## 7. Rolling draft score

**Function:** `getRollingDraftScore(draftClasses, teamId, options)` in `src/lib/getRollingDraftScore.ts`

**Scope:** All picks by the team across the provided draft classes (the app’s selected season span).

### 7.1 Score Formula

```
score = sum(player role weight) / totalPicks
```

Where:

- **Player role weight:** The mean of that pick’s per-season weights (see §4), not the representative overall role alone.
- **totalPicks:** Total number of picks by the team across all draft classes.

**Range:** 0.0–4.0 (all Core Starter seasons → 4.0 per season mean; all Non-Contributors → 0.0)

### 7.2 Auxiliary Metrics

| Metric          | Formula                         |
| --------------- | ------------------------------- |
| coreStarterRate | `coreStarterCount / totalPicks` |
| retentionRate   | `retentionCount / totalPicks`   |

Same retention logic as draft class metrics (most recent season per pick).

### 7.3 Example

Team drafts 10 players across 5 years:

- 2 Core Starters (4 each) → 8
- 3 Significant Contributors (3 each) → 9
- 2 Depth (1 each) → 2
- 3 Non-Contributors (0 each) → 0

Score = (8 + 9 + 2 + 0) / 10 = **1.9**

### 7.4 Over slot (draft value above draft-slot expectation)

**Functions:** `getPlayerDraftSkill` / `expectedScoreForPick` in `src/lib/draftSlotBaseline.ts`; team aggregate is `skillScore` on `getRollingDraftScore`.

The raw score rewards picks for playing, but playing time is largely handed out by **draft capital** (early picks are expected to play). "Over slot" removes the capital by scoring each pick against what its draft position alone predicted:

```
expected(pick)  = knotTable(overallPick)      (log-space interpolation, 0–100)
overSlot(pick)  = score(pick) − expected(pick)
overSlot(team)  = mean(overSlot(pick) for scored picks)
```

- **Positive** = the pick outplayed its slot (a steal); **negative** = it fell short (a reach).
- The curve is **empirical**: a local-linear (LOESS-style) smoother of pick score over `ln(overallPick)` with bandwidth `DRAFT_SLOT_BANDWIDTH` (0.25), evaluated at `DRAFT_SLOT_KNOT_PICKS` — dense early, sparse late — then forced non-increasing (pool-adjacent-violators) so no slot is ever expected to beat one ahead of it. Fit from **mature** draft classes only — those at least `DRAFT_SLOT_MATURITY_LAG` (3) years old, so "expected" reflects a settled career rather than one rookie season. Derived by `scripts/derive-draft-slot-baseline.ts` (runs in `pnpm update-data`) into `src/data/draft-slot-baseline.json`.
- **Why not a formula?** It was `a + b·ln(pick)` clamped to 0–100 until the shape proved wrong at both ends. The real curve is flat across the top of round 1 (pick 1 ≈ 91, picks 2–12 ≈ 83); no monotone log or logistic line fit across all 262 slots can sit that low up top and still fit the tail. The clamped fit therefore expected a perfect 100 from picks 1–5, so no top-5 pick could post a positive over slot however well it hit, while round 2 ran +10 too generous. Refitting the line in logit space or as a saturating logistic left the top-5 bias at ~15 points; the smoother cut the worst per-bucket bias from 16.9 to 4.5 and slightly improved RMSE (24.20 → 23.47).
- Fit on the same season basis as the shipped score (`draftingTeamOnly: true`), so a team's over-slot is directly comparable to its raw score.
- Surfaced additively: the raw 0–100 score is unchanged; over slot appears as a signed value in the team roster (`PlayerList`) and as an "Over slot" column in the rankings table.

**Caveats:** over slot removes capital, not luck — it is still built on the snap-based score, so it rewards a pick that _plays_ relative to its slot, not one graded on play quality. And the head of an empirical curve rests on a thin sample (~30 picks per top-10 bucket against ~390 in the late rounds), so the top-of-draft expectations move more than the tail as new classes mature.

### 7.5 "Show the math" panel (player page)

**Functions:** `explainDraftScore` in `src/lib/explainDraftScore.ts`; rendered by `src/components/views/player/ScoreBreakdown.tsx`.

The player page carries a collapsed panel under the career table that walks a single pick's score through §7.1 with that pick's own numbers: each season split into its Load and availability terms, then the sum, the denominator, and the §7.4 subtraction. It exists because the inputs are individually visible in the career table but the arithmetic joining them is not — most often for an injured pick, whose Load is forgiven while availability is not, and who therefore scores far below what the Load column alone suggests.

Two properties are deliberate and pinned by tests:

- **Nothing is re-derived.** Every figure comes from `getSeasonScore`, `getPlayerDraftScore`, `scoredSeasonCount` and `expectedScoreForPick`, and the weights are imported from `getSeasonScore.ts` rather than written out. An explanation that computed the formula a second time would keep printing the old one after a retune, and a wrong explanation is worse than none. `explainDraftScore.test.ts` asserts the reported terms sum to the real season score and that the division reproduces the real pick score.
- **Displayed figures are rounded before being added, not after.** Rounding each term off the exact float prints `34.3 + 7.1` beside a season score of `41.3`. The panel's only value is being checkable, so the shown terms are the source of truth for every total built from them. The one figure that absorbs the residue is the slot expectation in the over-slot line, chosen because it appears nowhere else on the page — over slot itself must match the hero badge to the decimal.

Rows are limited to the years the denominator spans (§7.1): seasons played elsewhere **after** the window closed contribute to neither half of the division, and listing them leaves seven rows above a divisor of four. Uncounted seasons **inside** the window stay, since they are why the denominator exceeds the number of seasons that scored.

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
classifyRole(effectiveShare, gamesPlayedShare, gamesPlayed, position?) → per-season role
    ↓
getPlayerAverageScoreWeight(pick) → mean seasonal weight; getPlayerRole(pick) → representative role from mean (+ peak for starter label)
    ↓
getDraftClassMetrics() → counts, rates per draft class
getRollingDraftScore() → score, coreStarterRate, retentionRate across classes
```

---

## 10. Code References

| Calculation         | Source File                       |
| ------------------- | --------------------------------- |
| Role classification | `src/lib/classifyRole.ts`         |
| Player overall role | `src/lib/getPlayerRole.ts`        |
| Draft class metrics | `src/lib/getDraftClassMetrics.ts` |
| Rolling draft score | `src/lib/getRollingDraftScore.ts` |
| Raw data derivation | `scripts/update-data.ts`          |
