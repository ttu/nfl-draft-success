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

**Threshold inputs:** For **most positions**, classification uses **cumulative snap share** (Load in the UI): your season snaps ÷ **full-season** team snap capacity for your primary franchise when you only played for one team, with an **injury adjustment** that shrinks the denominator for missed games covered by `injuryReportWeeks` **or** by a season-ending absence detected from snap data (capped by games actually missed); see `docs/calculations.md`. Load is then **capped at `snapShare`** (Avg) so it never exceeds typical per-game role share. For **kickers, punters, and long snappers**, cumulative load vs the entire team’s snap pool is tiny even for full-time starters, so effective tier input is **`snapShare`** (same as the Avg snap column). The career table’s **Load** column still shows stored cumulative share for transparency.

**Position adjustment:** The tier input is then **divided by a per-position baseline** (the snap share of a full-time starter at that position; see `docs/calculations.md` §2.5) and clamped to 1, so the thresholds below mean the same thing at every position. Without this, a 65% snap share is routine for an offensive lineman but top-decile for a running back. Baselines are derived from the dataset (`scripts/derive-position-baselines.ts`, stored in `src/data/position-baselines.json`). **Kickers, punters, long snappers, and unknown positions are exempt** (baseline 1.0, no rescaling).

Effective tier input is `snapShareForRoleTier(season, position)` (`src/lib/snapShareForTier.ts`); if `cumulativeSnapShare` is absent (legacy JSON), non-specialists fall back to `snapShare`.

Classification order (first match wins). Let **cumulative snap share** mean `snapShareForRoleTier(season, position)` (stored load capped at Avg when needed for non-specialists; K/P/LS use `snapShare`; legacy JSON falls back to `snapShare`).

1. `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare >= 0.5` → `core_starter`
2. `cumulativeSnapShare >= 0.65` AND `gamesPlayedShare < 0.5` → `starter_when_healthy`
3. `cumulativeSnapShare >=` **SC threshold** → `significant_contributor`. **SC threshold** is **0.35** for most positions and **0.32** for kickers, punters, and long snappers (their avg in-game share rarely reaches the scrimmage-oriented 35% bar).
4. Else if `cumulativeSnapShare >= 0.2` → `contributor` (covers 20% up to the SC threshold)
5. Else if `cumulativeSnapShare >= 0.1` → `depth` (10–20% load)
6. Else → `non_contributor`

Together, **Depth** (10–20%) and **Contributor** (up to the SC threshold) cover usage below Significant Contributor.

**Overall classification (badges, filters, draft-class buckets):** Derived from the **mean** of each season’s role weight (0–4), then mapped to a representative role. A mixed career (e.g. starter years plus an injured or inactive year) scores below a steady peak. For the top band (mean ≥ 3.5), Core Starter vs Starter when healthy follows the player’s **peak** single-season role among in-scope seasons.

**Rolling draft score:** Uses the same **mean seasonal weight** per pick (not the peak-only weight).

**Core Starter %:** Share of picks whose **representative** overall role (from mean seasonal weights) is Core Starter — same rule as draft-class “Core starters” counts.

## Apprenticeship (quarterbacks)

A quarterback's **apprentice seasons** are the unbroken run from his draft year in which he was `retained` and classified `non_contributor` or `depth` — **counted only if** a later retained season reaches `core_starter` or `starter_when_healthy`. Otherwise the count is zero and nothing changes. See `src/lib/apprenticeship.ts`.

Apprentice seasons are dropped from the seasons a pick is judged on (`getFilteredSeasons`), in **both** the drafting-team and career views, so they affect score, role badge, filters, draft-class bucket counts, and Core Starter % alike. The rookie window's start moves to the first non-apprentice season and its **length shortens by the same amount** (`rookieWindow(round) − n`), because the window models contractual entitlement and sitting does not extend it.

**Why outcome-gated:** Jordan Love's first three seasons and Kyle Trask's first three are identical in the data — retained quarterbacks taking no meaningful snaps. Only what came after separates them, so sitting is scored as an investment, judged by whether it paid. Love moves 52 → 95; Trask stays at 3.

**Why QB only:** quarterback is the one position where exactly one player takes the snaps. Run position-agnostic across 2018–2025 the rule fires on 115 picks and erases the quiet rookie year of ordinary starters.

**Known limitation:** the rule cannot distinguish sitting-to-learn from sitting-injured, so a lost rookie season followed by winning the job also qualifies (J.J. McCarthy).

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

## Rolling draft score

- Score per player = **mean** of that player’s per-season role weights (0–4)
- Team Score = (sum of player scores) / (total picks)
- Display: Rolling draft score (with selected season span), Core Starter %, Retention %

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
