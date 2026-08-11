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

**Denominator (single-franchise seasons):** Sum team snap capacity **for every game that franchise played** in that season, **matched to the player's own phase**. Capacity is read across every row of a `(game_id, team)`, since a row only carries the phases its own player was on the field for.

- **Offensive players:** Sum of `team_offense_snaps` per game.
- **Defensive players:** Sum of `team_defense_snaps` per game.
- **Specialists (K, P, LS / SPEC):** Sum of scrimmage capacity **plus** team special-teams capacity, because their numerator spans every phase too.

Phase comes from the snaps the player actually took (`loadPhaseOf`), not his position label: labels are occasionally wrong, and a player who switched sides would otherwise be judged against the wrong phase for part of his career. Ties fall to offence, which only happens when a non-specialist took no scrimmage snaps at all and the numerator is zero either way.

**Why phase-matched.** A player accumulates snaps in one phase only, so the denominator has to be that phase. Two reasons, one historical and one structural.

Historically the denominator was inverted from a single player row per team-game, which carried only the phases _that_ player was on the field for. nflverse lists an offensive player first in most team-games, so offensive players were divided by offensive capacity — accidentally phase-matched, and correct. Defenders were the ones who suffered: measured across full-season, every-game, essentially-every-snap players, offensive load ran p5 **0.998** while defensive load ran p5 **0.919**, an 8.1-point tail with Tyrann Mathieu (DB, ARI 2018) reading **87%** of a season he never missed a snap of. Phase-matching closes that tail to 0.2 points.

Structurally, the point is that the old numbers were right _by accident of CSV row order_, not by construction — a reordering upstream would have silently moved them. Summing capacity across every row of a team-game removes that accident, but then a combined offence **+** defence denominator caps every player at roughly half of whatever he plays (Quenton Nelson, who took all 1136 of Indianapolis's offensive snaps in 2018, would report 51%) and folds his team's own snap split into his personal number. Phase-matching is what makes reading capacity correctly safe to do.

Franchise codes are normalized (`src/lib/nflverseFranchise.ts`). Let `teamSeasonDen` be that full-season, phase-matched total for the player’s **primary team** (most snaps).

```
cumulativeSnapShare = sum(playerNum) / teamSeasonDen
```

**Injury adjustment:** After the base load is computed, we optionally **shrink the denominator** for absences we treat as excused. Two signals feed it, and we take the **larger**, never the sum — both describe the same absence:

- `injuryReportWeeks`: weeks on the nflverse injury report.
- `seasonEndingAbsenceGames`: team games between a player's **last snap** and the end of their team's season, from `snap_counts` weeks (`src/lib/seasonEndingAbsence.ts`). The nflverse injury feed is the weekly practice/game-status report, and a player placed on IR leaves the 53-man roster and that report entirely — so the most severe injuries produce **zero** report weeks (Nick Bosa has no 2020 rows despite tearing his ACL in week 2). Snap data still shows the shape: present every week, then gone. Weeks are matched against the team's own schedule so byes and playoff runs count correctly, and a gap of one game is ignored (that reads as a rest day or healthy scratch, not an injury). This is a heuristic: a player cut mid-season who never signs elsewhere looks the same as one who went on IR.

Let `missedGames = max(0, teamGames - restTeamGames - (gamesPlayed - restPlayerGames))` and `excusedWeeks = min(max(injuryReportWeeks, seasonEndingAbsenceGames), missedGames)`. Missed games are counted over the schedule the **rest rule** (§1.6) leaves behind, so a rested finale is never excused here as well as erased there — the same reason the two injury signals are maxed rather than summed. We subtract `excusedWeeks × (teamSeasonDen / gameCount)` where `gameCount` is the number of distinct games that franchise played in `snap_counts`. That approximates “weeks missed hurt” without penalizing load for those absences as harshly as healthy scratches. Applied only for single-franchise seasons when merging draft output (`resolveCumulativeLoadShareWithInjury`) — for a traded player, absence from one team's remaining schedule is a transaction, not an injury.

Note the **availability** term of the season score (`gamesPlayed / teamGames`, 30% weight) is untouched by this, so a season-ending injury still costs a player most of that component; the adjustment only stops Load from reading the missed games as bench time.

**Cap vs Avg snap:** Full-season + injury math can still produce a load **above** average weekly role share. We set `cumulativeSnapShare = min(computedLoad, snapShare)` when storing JSON and in `snapShareForRoleTier`, so Load never exceeds **Avg snap** (typical usage when active). A season carrying a `restGame` is stored **uncapped** and capped by `withoutRestGame` instead: rest moves both terms, so capping first would clamp the load against an average that still counts the rested game.

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

**Logic (retention):**

1. If snap data exists: `retained = (normalize(primaryTeam) === teamId)`
2. If no snap data but injury report exists: use injury report team as primary
3. If neither: infer from previous/next season primary team (player on roster but inactive)

### 1.6 Rest Games (per season, per franchise)

A team that has locked its playoff seed sits its starters in the final regular-season game. The player was available and the coach chose to sit him, so nothing else in the pipeline forgives it: §1.2's absence rule deliberately ignores a one-game tail (that reads as a rest day or a healthy scratch), which leaves a rested finale costing both availability and Load.

**Detection (`detectRestGames` in `src/lib/restGame.ts`, run per season in the update script).** Inferred from the team's own snap data rather than from computed clinch status, which would mean reconstructing standings, seeding and NFL tiebreakers. Per franchise:

1. **Playoff gate.** The franchise must have a snap row past the last regular-season week (18 from 2021, else 17). This is a guard on the usage signal, not a substitute — without it the rule also fires on a 3–13 team looking at young players, and on one that has lost half its roster by then.
2. **Regulars.** Players whose _median_ share (`max(offense_pct, defense_pct)`) across the team's other regular-season games clears `REST_GAME_STARTER_SHARE` (0.5). An absent player counts as zero for a week, so a starter who missed a stretch is measured on the whole schedule.
3. **The drop.** For each regular, `ratio = finaleShare / medianOtherShare`. If the **median** ratio across them falls below `REST_GAME_RATIO_THRESHOLD` (0.7), the finale is a rest game. Median on both axes: two stars on IR cannot fake a rest week, and one stubborn ironman cannot mask a real one.
4. **Fails closed** on fewer than `MIN_REST_GAME_REGULARS` (10) regulars or `MIN_REST_GAME_NORM_WEEKS` (6) other games.

Judged per franchise, never per game — the opponent played that game for real, and its rows are untouched.

**Calibration.** The 0.7 threshold comes from the 82 playoff teams of 2019–2024, whose median ratios separate cleanly there. Below it sit only real rests, down to a partial one like Baltimore 2023 at 0.59 (Jackson and six others sat while the roster played on); the nearest team above is New Orleans 2019 at 0.77, who played Brees in a game that decided their seed. A clean sweep of the starting lineup is the rarer shape, so a tighter bar would miss most of what the rule is for. It flags 23 of those 82 teams.

**Effect — the game is erased, not excused.** `withoutRestGame` (same module) removes it from `teamGames`, from the Load denominator, from the avg-snap average, and from the player's own numerators. Excusing the absence while keeping the snaps would let a token one-series appearance score better than a full rest, though both are the same coaching decision, and would push the shares above 1.0 by measuring numerator and denominator over different sets of games.

**Where it is applied.** The pipeline stays lossless: every stored field keeps its true full-season value, and each affected season additionally carries a `restGame` slice (`playerGames`, `playerShareSum`, `playerSnaps`, `teamSnaps`) plus `loadDenominator` — the denominator that produced the stored ratio, already injury-adjusted, without which the ratio could not be reopened. The subtraction happens in `stampDraftYear` (`src/lib/draftClass.ts`), the single point every path parsing draft JSON goes through, so role classification, season scores, cohort baselines and the derivation scripts all see the shortened schedule without each having to remember.

**Accepted trade-off.** Erasure is team-wide, so a backup who played 60 snaps _because_ the starters sat loses that showcase game from his record.

**Edge cases.** A player whose only appearance was the rest game reads 0-for-16 rather than `NaN`. Traded seasons take the games-played denominator, and emitting `loadDenominator` as the sum of per-game denominators makes the identical arithmetic work on both paths. The playoff gate keeps the rule inert on an in-progress season until the postseason appears in the data.

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

**Floor (`BASELINE_FLOOR` = 0.50):** a position whose p90 falls below this is measured against 0.50 instead. The baseline is a divisor, so a very low one declares a marginal role full-time. Fullbacks p90 at ~0.20; under the previous 0.35 floor the heaviest fullback season in the dataset (Andy Janovich 2016, 31% of team snaps) normalized to 0.88 and scored as a **Core Starter**, level with a franchise left tackle. At 0.50 no fullback season reaches the Core band, and fullback is the only position the floor touches.

The 25% margin below the lowest genuinely rotational baseline (RB, 0.67) is deliberate rather than incidental. The floor is an absolute constant and does not move when the load scale does — during the phase-matching work (§1.2) a denominator change briefly halved every load, and a floor sitting just under RB would then have clamped RB, DT and NT silently, since a floored baseline is indistinguishable from a derived one in the JSON. `positionBaseline.test.ts` pins that the floor catches only FB and keeps that margin.

**Effect on interior OL and QB:** their baselines are ~0.99–1.0, so their scores are essentially unchanged. The correction lifts under-credited rotational positions (DT, DL, RB, DE, TE) without moving the positions the old absolute bars already fit.

**Derivation parameters** live in `src/lib/positionBaseline.ts` (`BASELINE_PERCENTILE`, `QUALIFYING_GAMES_SHARE`, `MIN_QUALIFYING_SEASONS`, `BASELINE_FLOOR`) and are shared by the derivation script. See `docs/superpowers/specs/2026-07-17-position-adjusted-snap-scoring-research.md` for the full analysis, the measured per-team ranking shifts, and the open questions this design settled.

---

## 3. Role Classification (per season)

**Function:** `classifyRole(effectiveShare, gamesPlayedShare, position?)` in `src/lib/classifyRole.ts`. The first argument is **`snapShareForRoleTier(season, position)`** (stored season load when appropriate, else average share for legacy JSON; kickers/punters/long snappers use `snapShare`), **position-adjusted** by dividing by the per-position baseline (§2.5) for non-exempt positions. Optional **`position`** selects the Significant Contributor floor: **0.35** by default, **0.32** for K/P/LS. Raw `gamesPlayed` is deliberately not a parameter: availability enters only as `gamesPlayedShare`, since a game count cannot be judged without the schedule length behind it.

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

**Definition:** Each season gets a **score weight** (0–4) from its classified role. The pick’s **badge value** is those weights summed and divided by the rookie window (§4.2 step 3) — the same denominator the 0–100 score uses. **Overall role** (UI badge, filters, draft-class counts) maps that value to a representative `Role`, with thresholds at 0.5 / 1.5 / 2.5 / **3.2** on the 0–4 scale. If the value is in the top band (≥ 3.2), Core Starter vs Starter when healthy is taken from the **peak** single-season role so both weight-4 roles stay distinguishable.

### 4.1 Role Hierarchy (low to high)

Used for peak comparison and mapping; score weights collapse the two starter roles to 4.

1. Non-Contributor
2. Depth
3. Contributor
4. Significant Contributor
5. Starter When Healthy
6. Core Starter

### 4.2 Algorithm

1. **Season filter:** `getFilteredSeasons` — played seasons only, minus any apprentice seasons (§7.3b); if `draftingTeamOnly` is true, only those where `retained === true`.
2. **Per season:** `classifyRole` → map to score weight via `ROLE_SCORE_WEIGHTS`.
3. **Mean:** Sum those weights and divide by **the same denominator the score uses** — `scoredSeasonCount` (the rookie window, §7.3a) in drafting-team mode, seasons played in career mode (`getPlayerAverageScoreWeight`).
4. **Representative role:** Map mean to Non-Contributor / Depth / Contributor / Significant Contributor, or (if the value ≥ 3.2, `CORE_STARTER_BAND`) use peak season among `{core_starter, starter_when_healthy}` (`getPlayerRole`).

**Why the window applies to the badge too.** Both readings must divide by the same thing or they contradict each other on screen. While this averaged over seasons _played_, a pick who started as a rookie and was then gone kept a Core Starter badge beside a score of 17 — his unplayed years vanished from the badge but not from the score. Josh Rosen (2018 R1, one season for Arizona) read Core Starter at a score of 17.7; he now reads Depth. Because the badge feeds `coreStarterCount`, the disagreement reached the team metrics as well: correcting it moved league Core Starter rates by roughly a quarter (e.g. 0.351 → 0.270) while leaving every score and rank untouched.

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
score(team) = mean( getPlayerDraftScore(pick) for scored picks )
```

Where:

- **`getPlayerDraftScore(pick)`** is the continuous 0–100 pick score of §7.1a — not the discrete 0–4 role weight, which drives badges only (§4).
- **scored picks** are those with at least one played season row (`pickHasSeasonSnapData`). Picks from a class that has not played yet are excluded from **both** halves rather than counted as zero, so a draft class still awaiting its rookie season does not read as a failure. In the shipped data only the 2026 class is excluded, and uniformly across all teams.

**Range:** 0–100.

#### 7.1a Per-pick score

```
score(pick) = sum( getSeasonScore(season) ) / denominator
```

- **`getSeasonScore`** (§7 preamble) is `clamp(0.7 · positionAdjustedLoad + 0.3 · availability) × 100`.
- **denominator** is the rookie-contract window (`scoredSeasonCount`, §7.3a) in drafting-team mode, and seasons played in career mode.

### 7.2 Auxiliary Metrics

| Metric          | Formula                              |
| --------------- | ------------------------------------ |
| coreStarterRate | `coreStarterCount / scoredPickCount` |
| retentionRate   | `retentionCount / scoredPickCount`   |

`coreStarterCount` counts picks whose **representative role** (§4) is Core Starter — which, like the score, divides by the rookie window in drafting-team mode, so a pick who started as a rookie and then left does not carry the badge. Retention uses the most recent season per pick, as in draft class metrics.

### 7.3 Example

A team's four scored picks in the window:

| Pick                               | Season scores  | Denominator | Pick score |
| ---------------------------------- | -------------- | ----------- | ---------- |
| Full-time starter, all four years  | 92, 95, 90, 91 | 4           | 92.0       |
| Starter for two years, then traded | 88, 84         | 4 (window)  | 43.0       |
| Rotational contributor, four years | 41, 45, 38, 44 | 4           | 42.0       |
| Never played beyond a rookie year  | 6              | 4 (window)  | 1.5        |

Team score = (92.0 + 43.0 + 42.0 + 1.5) / 4 = **44.6**

The second pick shows why the denominator is the window rather than seasons played: two strong years score 43, not 86, because the drafting team paid for four.

### 7.3b Apprenticeship (quarterbacks who sat behind a veteran)

**Function:** `apprenticeSeasonCount` in `src/lib/apprenticeship.ts`; applied at `getFilteredSeasons` (`getPlayerRole.ts`) and `scoredSeasonCount` (`rookieWindow.ts`).

A quarterback's **apprentice seasons** are the unbroken run from his draft year in which he was `retained` and classified `non_contributor` or `depth` — counted **only if** a later retained season reaches `core_starter` or `starter_when_healthy`. They leave the seasons the pick is judged on, in both the drafting-team and career views, and the rookie window's start moves to the first non-apprentice season while its length shortens by the same count (`rookieWindow(round) − n`).

|                                     | before | after |
| ----------------------------------- | ------ | ----- |
| Jordan Love (2020 R1, sat 3)        | 52     | 95    |
| J.J. McCarthy (2024 R1, sat 1)      | 40     | 81    |
| Sam Howell (2022 R5, sat 1)         | 26     | 33    |
| Kyle Trask (2021 R2, never started) | 3      | 3     |

**Why the payoff gates it.** Love's first three seasons and Trask's first three are the same rows: retained quarterbacks taking no meaningful snaps. Only what came afterwards separates them, so sitting is scored as an investment and judged by whether it paid.

**Why the window shortens rather than slides.** The window models what the rookie contract entitled the team to. Sliding it five years forward from 2023 would charge Love for 2026 and 2027, seasons his rookie deal never covered.

**Why quarterback only.** It is the position where exactly one player takes the snaps. Run position-agnostic across the 2018–2025 classes the rule fires on 115 picks and erases the quiet rookie year of ordinary starters (Daniel Faalele 70 → 100, Luke Wattenberg 58 → 91).

**Known limitation.** The rule keys on outcome, so it cannot separate sitting-to-learn from sitting-injured; McCarthy, who missed his rookie year with a knee injury, qualifies.

Detection is not merely unimplemented, it is unavailable: McCarthy's 2024 row carries **no injury signal at all** — no `injuryReportWeeks`, no `seasonEndingAbsenceGames`, just `gamesPlayed: 0` — because he went to IR in the preseason and never appeared in a weekly snap count. Branching the copy on those fields would therefore still label him "learning". The career table's `learning` chip should be read as **"before he won the job"**, which is the rule's literal criterion; the Info modal says so in as many words, since the player page states the usual cause rather than a verified one.

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

Apprentice seasons (§7.3b) are the one exception kept despite being in neither half, as `kind: 'apprentice'` rows. They sit _before_ the window rather than after it, so dropping them would open a 2020 first-rounder's panel at 2023 with nothing to explain the jump. They are not addends — unlike gap years, which are zeros the window genuinely charges.

---

## 8. Contributor Definition

**Contributor** = any non-zero role:

- Core Starter
- Starter When Healthy
- Significant Contributor
- Contributor
- Depth

**Non-Contributor** is the only excluded role, being the only one with weight 0.

Note the word does double duty: **Contributor** is both one tier (§3, load in [0.20, SCmin)) and the name of this aggregate over every non-zero tier. `contributorRoleCount` in §6.1 is the tier; `contributorCount` is the aggregate.

---

## 9. Summary: Calculation Flow

Two parallel readings share the same inputs and the same denominator: a **continuous 0–100 score** (the headline number) and a **discrete 0–4 role weight** (the badge). They diverge only in how a season is summarised — `getSeasonScore` keeps the shares, `ROLE_SCORE_WEIGHTS` collapses them onto five tiers.

```
Raw nflverse data
    ↓
[update-data.ts] → gamesPlayed, snapShare, cumulativeSnapShare, teamGames,
                   retained, restGame per season          (§1.1–1.6)
    ↓
stampDraftYear() → subtracts any rest game               (§1.6)
    ↓
snapShareForRoleTier(season, position)                   (§1.2, §2.5)
  = min(load, avgSnap) ÷ positionBaseline, clamped to 1
gamesPlayedShare = gamesPlayed / teamGames               (§2)
    ↓
    ├─ getSeasonScore  = 0.7·share + 0.3·availability, ×100      (§7.1a)
    │      ↓
    │  getPlayerDraftScore(pick) = Σ season scores ÷ window      (§7.1a)
    │      ↓                                    (scoredSeasonCount, §7.3a)
    │  − expectedScoreForPick(overallPick) → over slot            (§7.4)
    │
    └─ classifyRole(share, gamesPlayedShare, position?)           (§3)
           ↓
       getPlayerAverageScoreWeight(pick) = Σ weights ÷ same window (§4)
           ↓
       getPlayerRole(pick) → representative role (+ peak for the
                             Core Starter / Starter-when-healthy split)
    ↓
getDraftClassMetrics()  → counts and rates per draft class        (§6)
getRollingDraftScore()  → score, skillScore, coreStarterRate,
                          retentionRate across classes            (§7)
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
