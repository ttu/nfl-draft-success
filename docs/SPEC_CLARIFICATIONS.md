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

**Overall classification (badges, filters, draft-class buckets):** Each season's role weight (0–4) summed and divided by the **rookie-contract window** in drafting-team mode (seasons played in career mode) — the same denominator the 0–100 score uses — then mapped to a representative role. A mixed career (starter years plus an injured or inactive one) scores below a steady peak, and a pick who left mid-window is charged for the years his team did not get. For the top band (≥ 3.2), Core Starter vs Starter when healthy follows the player’s **peak** single-season role among in-scope seasons.

**Rolling draft score:** Not the role weight. The team score is the mean of the **continuous 0–100 pick score** (`getPlayerDraftScore`) across picks with at least one played season; see `docs/calculations.md` §7.1. Role weights drive badges and Core Starter %, not the headline number.

**Core Starter %:** Share of **scored** picks whose representative overall role is Core Starter — same rule, and same window denominator, as draft-class “Core starters” counts.

## Apprenticeship (quarterbacks)

A quarterback's **apprentice seasons** are the unbroken run from his draft year in which he was `retained` and classified `non_contributor` or `depth` — **counted only if** a later retained season reaches `core_starter` or `starter_when_healthy`. Otherwise the count is zero and nothing changes. See `src/lib/apprenticeship.ts`.

Apprentice seasons are dropped from the seasons a pick is judged on (`getFilteredSeasons`), in **both** the drafting-team and career views, so they affect score, role badge, filters, draft-class bucket counts, and Core Starter % alike. The rookie window's start moves to the first non-apprentice season and its **length shortens by the same amount** (`rookieWindow(round) − n`), because the window models contractual entitlement and sitting does not extend it.

**Why outcome-gated:** Jordan Love's first three seasons and Kyle Trask's first three are identical in the data — retained quarterbacks taking no meaningful snaps. Only what came after separates them, so sitting is scored as an investment, judged by whether it paid. Love moves 52 → 95; Trask stays at 3.

**Why QB only:** quarterback is the one position where exactly one player takes the snaps. Run position-agnostic across 2018–2025 the rule fires on 115 picks and erases the quiet rookie year of ordinary starters.

**Known limitation:** the rule cannot distinguish sitting-to-learn from sitting-injured, so a lost rookie season followed by winning the job also qualifies (J.J. McCarthy). Nor can it be taught to — McCarthy's 2024 row carries no injury fields whatsoever, so branching on them would still call it learning. The UI's `learning` label means **"before he won the job"**; the Info modal states that caveat, and `docs/calculations.md` §7.3b explains why detection is not possible.

## Retention

**Definition:** Still on the drafting team (same franchise).

**Franchise moves to handle:** STL→LAR, SD→LAC, OAK→LV.

## Undrafted Free Agents

**Cohort membership:** a player qualifies if, in `players.csv`, he has no `draft_year` and no `draft_pick`, has a recorded `rookie_season` of 2013 or later, and has at least one snap in `snap_counts`. All three conditions must hold — a player with only one of the two draft columns populated is treated as a drafted player with a gap in his record, not an undrafted one, and a player who was never on a snap-count row generates no season data to score.

**Class year:** the season he **debuted** — his first logged snap — not his `rookie_season` and not the year he signed. This is a deliberate departure from an earlier version of this spec, which used `rookie_season` directly; see the note in the design doc for why that broke the owning-team rule below. `rookie_season` still gates cohort membership (it is what marks him a first-timer rather than a veteran whose earliest tracked snap happens to fall after 2013), but it does not decide which class he lands in.

**Owning team:** the franchise he took his first snap for. Where his debut season is split across two rosters, he is credited to whichever franchise he took the most snaps for that season — the same primary-team resolution used elsewhere for a split season.

**Scoring window:** 3 seasons (`FA_WINDOW`), matching the length of an undrafted rookie contract. Free agents are scored with the same per-season formula, position baselines, and role tiers as draft picks; only the window length and the expectation they are compared against differ.

**Expectation baseline:** `src/data/fa-baseline.json` stores a single scalar — the mean score actually earned by undrafted free agents, computed over classes old enough to have played out their window (the same maturity lag, measured back from the same newest-draft-class reference, as the draft-slot curve — so the two are fit over the identical mature span), scored in drafting-team mode, and restricted to free agents who took at least one snap (the population the cohort rule already requires: a player who never took a snap, including one who spent the year on a practice squad, is not in the cohort). Because the baseline is the cohort's own mean, free-agent "over slot" is centered on zero by construction: it ranks teams' undrafted signings against each other, and can never say the league as a whole develops undrafted players well or badly. It is also **not** a like-for-like baseline with a pick's slot expectation — the free-agent scalar is a survivors' average (undrafted players who never made a roster leave no season row to average in), while a pick's slot expectation is fit over every drafted player with a season row, including picks who never played and score near zero. Both residuals share units and a 0–100 scale, but a free agent's +5 and a pick's +5 are not answering the same question.

**Picks-only surfaces unaffected:** the rolling draft score, its Core Starter/Retention rates, and every team ranking remain computed over draft picks only. Free-agent figures are reported beside them — a team detail section, a draft-year block, a player detail page — and are never summed, averaged, or folded into a pick-based number.

**Known limitation:** the free-agent score, like the pick score, measures what a team's undrafted signings became, not how efficiently it got there. A team that signs thirty undrafted rookies and develops one into a core starter scores the same as a team that signed one and developed him. Postseason snaps are not distinguished from regular-season ones when a debut season is decided.

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

- Score per player = sum of that player’s per-season scores (`0.7·load + 0.3·availability`, ×100) ÷ the **rookie-contract window**, on a 0–100 scale
- Team Score = (sum of player scores) / (**scored** picks — those with at least one played season)
- Over slot = pick score − what its draft slot alone predicted, averaged per team; reported alongside the score, not folded into it
- Display: Rolling draft score (with selected season span), Over slot, Core Starter %, Retention %

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
