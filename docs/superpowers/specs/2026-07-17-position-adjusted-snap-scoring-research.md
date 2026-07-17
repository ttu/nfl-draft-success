# Position-Adjusted Snap Scoring — Research

**Date:** 2026-07-17
**Status:** Implemented (Option A). Decisions taken: exempt K/P/LS, accept the consistent (all-band) version, baselines in `src/data/position-baselines.json`. See `docs/calculations.md` §2.5 for the shipped behaviour.
**Scope:** `classifyRole`, `getSeasonScore`, `snapShareForTier`, and the thresholds documented in `SPEC_CLARIFICATIONS.md` §Role Classification

---

## 1. Summary

The scoring model treats snap share as position-neutral. It is not. An offensive lineman who holds a starting job plays ~100% of offensive snaps; a lead running back plays ~50–65%; a rotational defensive tackle who is unambiguously a starter plays ~45–60%. The model applies one absolute bar (65% for Core Starter, 35% for Significant Contributor) to all of them.

The measured consequence: **the 65% Core Starter bar sits at the 15th percentile for quarterbacks and the 90th percentile for running backs.** The same threshold is roughly six times harder to clear depending on where a player lines up.

The sharpest way to state the problem: when position baselines are introduced, **OL, C, G, OT and QB scores do not move at all (+0.00)**. The current model is not neutral-but-imperfect — it is implicitly calibrated _for offensive linemen_, and it asks every other position to play like a left tackle.

This document establishes the problem with data from the project's own dataset, evaluates three fixes, and recommends one. It also flags two decisions that need a human call before any implementation.

---

## 2. How the current model works

From `src/lib/classifyRole.ts` and `src/lib/getSeasonScore.ts`:

```
tier   = snapShareForRoleTier(season, position)   // load, capped at avg snap share
role   = tier >= 0.65 -> core_starter / starter_when_healthy
         tier >= 0.35 -> significant_contributor    (0.32 for K/P/LS)
         tier >= 0.20 -> contributor
         tier >= 0.10 -> depth
         else         -> non_contributor

score  = clamp(0.7 * tier + 0.3 * availability) * 100
```

Position enters this pipeline in exactly one place: a carve-out that lowers the Significant Contributor bar from 0.35 to 0.32 for kickers, punters and long snappers. Every scrimmage position — QB, OL, WR, TE, RB, DL, LB, DB — is measured against identical absolute thresholds.

---

## 3. Evidence

All numbers below are computed from `public/data/draft-*.json` (2018–2026 draft classes, 2,049 picks with season rows). To measure _role size_ rather than injury noise, the population is restricted to **qualifying seasons**: those where the player appeared in at least 50% of his team's games.

### 3.1 Snap share by position

| Pos | n   | p50  | p90   | p95   | max   | Core Starter % |
| --- | --- | ---- | ----- | ----- | ----- | -------------- |
| C   | 117 | 93.3 | 100.0 | 100.0 | 100.0 | 66.7           |
| G   | 169 | 86.6 | 99.7  | 100.0 | 100.0 | 62.1           |
| OL  | 329 | 83.2 | 99.7  | 100.0 | 100.0 | 60.5           |
| OT  | 295 | 70.7 | 99.7  | 100.0 | 100.0 | 53.9           |
| QB  | 130 | 93.2 | 98.9  | 99.5  | 99.7  | 85.4           |
| S   | 386 | 70.4 | 96.7  | 98.3  | 100.0 | 54.7           |
| CB  | 463 | 53.6 | 92.9  | 96.1  | 100.0 | 40.6           |
| LB  | 550 | 34.3 | 88.7  | 94.4  | 100.0 | 29.5           |
| WR  | 626 | 55.3 | 86.3  | 89.7  | 96.6  | 39.9           |
| TE  | 349 | 45.2 | 78.1  | 84.1  | 96.3  | 20.9           |
| DE  | 397 | 43.5 | 74.1  | 80.0  | 96.4  | 19.1           |
| DT  | 345 | 42.8 | 68.5  | 74.0  | 84.2  | 15.1           |
| RB  | 385 | 31.4 | 65.3  | 71.7  | 87.2  | 10.1           |

The user's intuition is confirmed precisely, and the ordering is the football-expected one: interior OL → QB → secondary → WR → TE → edge → interior DL → RB.

### 3.2 Where the 65% bar actually falls

The same threshold, expressed as a percentile of each position's own distribution:

| Pos     | 65% bar sits at percentile | Meaning                            |
| ------- | -------------------------- | ---------------------------------- |
| QB      | 15th                       | 85% of qualifying seasons clear it |
| C       | 33rd                       | routine                            |
| OL / G  | 38th–40th                  | routine                            |
| OT      | 46th                       | coin flip                          |
| WR      | 60th                       | above average required             |
| TE      | 79th                       | near-elite required                |
| DE      | 81st                       | near-elite required                |
| DT / DL | 85th                       | elite required                     |
| RB      | 90th                       | **top decile required**            |
| K / P   | 100th                      | **mathematically impossible**      |

A **median** center (83–93% snaps) clears the Core Starter bar comfortably. A **90th-percentile** running back sits exactly on it at 65.3%. Kickers and punters cannot reach it at any performance level.

### 3.3 The score ceiling

Because `getSeasonScore` weights snap share at 0.7, the absolute scale also caps the achievable score:

| Pos                         | Best season score actually achieved (0–100) |
| --------------------------- | ------------------------------------------- |
| CB, G, OT, S, C, LB, OL, DB | 100.0                                       |
| WR, TE                      | 97.4                                        |
| DE                          | 96.7                                        |
| RB                          | 89.4                                        |
| DT                          | 88.9                                        |
| DL                          | 83.7                                        |
| P                           | 68.8                                        |
| K                           | 61.5                                        |
| LS                          | 53.2                                        |

The best running back season in nine draft classes scores 89.4. A merely average tackle who holds a starting job scores 100. This is a structural ceiling, not a talent gap.

---

## 4. What "fair" should mean here

An important nuance, and a trap worth naming explicitly.

The tempting acceptance criterion is _"Core Starter % should be equal across positions."_ **This is wrong**, and adopting it would introduce a new distortion.

Positions genuinely differ in how binary their starting role is. Quarterback is nearly binary — you start or you hold a clipboard — so a high Core Starter rate among QBs who play is _correct_, not evidence of unfairness. Running back and defensive tackle are committee roles with real gradations, and a spread of outcomes there is also correct.

The defensible criterion is about the **scale**, not the distribution:

> A player who holds down a full-time starting job at his position should classify as a Core Starter, regardless of position.

That is a statement about where the yardstick's "1.0" sits. The resulting distribution should then be allowed to fall wherever the football reality puts it.

---

## 5. Options

### Option A — Per-position baseline, normalize the snap term (recommended)

Define one number per position, `BASELINE[pos]` = the snap share of a clearly full-time starter at that position. Divide before classifying:

```ts
normalized = min(tier / BASELINE[pos], 1);
```

Then apply the existing bands (0.65 / 0.35 / 0.20 / 0.10) and the existing `getSeasonScore` formula to `normalized`.

Derived empirically as the **p90 of qualifying seasons**:

| Pos     | Baseline | Pos | Baseline | Pos   | Baseline |
| ------- | -------- | --- | -------- | ----- | -------- |
| C       | 100.0%   | CB  | 92.9%    | DE    | 74.1%    |
| OL/G/OT | 99.7%    | OLB | 89.5%    | DL/DT | 68.5%    |
| QB      | 98.9%    | LB  | 88.7%    | RB    | 65.3%    |
| S       | 96.7%    | WR  | 86.3%    |       |          |
| ILB     | 93.7%    | TE  | 78.1%    |       |          |

**Why p90:** `max` is a single-outlier artifact; p95 is within a point or two of p90 for most positions; p50 is dragged down by rookies and backups. p90 reads as "clearly a full-time starter" without being the single best season ever recorded.

**Measured effect:** 699/2,049 picks (34%) change mean role weight. Average change in mean role weight (0–4 scale):

| DT +0.42 · DL +0.40 · RB +0.36 · DE +0.27 · TE +0.26 · WR +0.12 · LB +0.09 · CB +0.04 · S +0.01 · **QB, C, G, OT, OL +0.00** |
| ---------------------------------------------------------------------------------------------------------------------------- |

Team rankings move by up to 6 places (LV #20→#26, DAL #17→#12, CLE #18→#13, LAR #27→#22, ATL #9→#5).

The +0.00 row is the argument for this option. It is not that the change is small — it is that the change is _zero exactly where the current model already worked_, and non-zero everywhere it didn't. That is what a correction should look like.

In absolute terms, the Core Starter bar becomes: OL/C/QB ~65%, WR 56%, TE 51%, DE 48%, DT 44.5%, RB 42.4%. A running back playing 42% of snaps — roughly a lead back in a committee — becomes a Core Starter. That is a defensible reading of football, but it _is_ a real loosening and should be a conscious choice (see §7).

**Pros:** smallest diff (one lookup table + one division); preserves all downstream logic, weights, and UI; explainable in one line ("share of a full-time starter's workload at this position"); degrades gracefully — unknown position falls back to baseline 1.0, i.e. today's behaviour.
**Cons:** 19 magic numbers that need periodic re-derivation; rescales _every_ band, not just the top one.

### Option B — Percentile within position cohort

Score each season by its percentile rank within its position's distribution. Self-calibrating; no thresholds to maintain.

**Rejected.** Three problems: (1) it destroys absolute meaning — an exceptional RB class would still have only 10% in the top decile, because percentiles are zero-sum; (2) it is unexplainable in the UI ("your snap share is at the 73rd percentile" is not a role); (3) it is unstable for thin samples (ILB n=49). Percentile is a _diagnostic_ here, not a scoring function.

### Option C — Hand-tuned threshold table per position

An explicit `{pos: {core, sc, contributor, depth}}` table.

**Rejected for now.** 19 positions × 4 bands = 76 numbers to justify and maintain, versus 19 for Option A. Option A's single baseline per position captures nearly all the signal because the bands are roughly proportional. Worth revisiting only if a specific position needs a band shape that pure scaling cannot express.

---

## 6. Recommendation

**Option A**, with two amendments discussed below: exclude specialists, and source the baselines from the full nflverse population rather than the drafted subset.

---

## 7. Open decisions — need a human call

### 7.1 Kickers, punters and long snappers

The derived baselines (K 41.2%, P 48.7%) would make **91.7% of kicker seasons and 70.6% of punter seasons Core Starters**, up from 0%. That is almost certainly wrong as a _product_ answer even if it is arithmetically consistent.

The root cause is that snap share does not measure specialist workload at all. A full-time kicker plays 100% of kicking snaps; the metric reports ~35–45% because it is `max(off%, def%, st%)` against a scrimmage-shaped denominator. The existing 0.32 carve-out is already a patch over this.

Three candidate answers, in rough order of my preference:

1. **Exclude K/P/LS from normalization**, keep today's carve-out, and document honestly that snap-based scoring does not evaluate specialists. Least wrong, least work.
2. Give specialists their own track with a hand-set baseline reflecting a judgment about whether a full-time kicker _is_ a "core starter."
3. Exclude specialists from team scores entirely.

This is a judgment call about what the product is claiming, not a math problem. **Recommend option 1 unless there's a reason to rate specialists at all.**

### 7.2 Does loosening the lower bands go too far?

Normalizing rescales _all_ the bands, not just Core Starter. A DT at 13.7% snaps becomes "Depth" where he was "Non-Contributor". The Core Starter change is well-motivated; the Depth/Contributor end is a side effect nobody explicitly asked for.

Options: accept it as consistent; or normalize only the upper bands and leave the 10%/20% floors absolute (defensible — "barely played" is arguably position-neutral) at the cost of a less clean rule. **Recommend accepting the consistent version** unless the Depth counts visibly inflate in the UI.

---

## 8. Risks and caveats

**Sample bias — the significant one.** Baselines are derived from _drafted players, 2018–2026, qualifying seasons only_. This is not the NFL population; it is the population the tool scores, which makes it the right _reference_ but not an unbiased estimate of positional norms. **Recommendation:** derive baselines in `scripts/update-data.ts` from the full nflverse `snap_counts` table and write them to a `position-baselines.json` (or embed in `data-meta.json`), rather than hardcoding this analysis's numbers. That removes the bias and makes them refreshable.

**Grouped position labels are muddied.** The dataset mixes granular labels (OT, G, C, DT, CB, S) with grouped ones (OL, DL, DB, LB) depending on source. These are not interchangeable: `LB` has p50 = 34.3% while `ILB` has p50 = 72.9%, because the `LB` bucket blends off-ball linebackers with edge rushers. Any baseline keyed on the raw draft label inherits that blending. Worth a separate normalization pass on position labels — arguably a prerequisite.

**Era drift.** Snap usage is not stationary; the RB-committee trend is exactly the sort of thing that moves a p90 baseline over a decade. Baselines should be recomputed on each data refresh, not frozen.

**Every published number changes.** 34% of picks and all team rankings shift. If any rankings are cached (`public/data/default-rankings.json`) they must be regenerated in the same change.

**Explainability.** The Info modal and `docs/calculations.md` both document the absolute thresholds. Users who learned "65% = core starter" will see it become 42% for a RB. This needs a UI explanation, not just a code change.

---

## 9. Suggested implementation sketch (not yet approved)

1. Normalize position labels (`OL`/`DL`/`DB`/`LB` → granular where derivable) — possibly a prerequisite.
2. Add baseline derivation to `scripts/update-data.ts` from full nflverse snap_counts; emit `position-baselines.json`.
3. Add `src/lib/positionBaseline.ts`: `getPositionBaseline(pos): number`, default 1.0, specialists excluded.
4. Thread normalization into `snapShareForRoleTier` (single choke point — `classifyRole` and `getSeasonScore` both consume it, so one change covers both).
5. Update `docs/calculations.md` §3.2 and `SPEC_CLARIFICATIONS.md` §Role Classification.
6. Regenerate `default-rankings.json`.
7. Update the Info modal copy.
8. Visual verification per `AGENTS.md`.

Tests first per `AGENTS.local.md`: baseline lookup, clamping at 1.0, unknown-position fallback to 1.0, specialist exclusion, and a regression asserting OL/QB classifications are byte-identical to today.

---

## Appendix: method

- Source: `public/data/draft-{2018..2026}.json`, 2,049 picks with ≥1 season row.
- Qualifying season: `teamGames > 0 && gamesPlayed / teamGames >= 0.5`.
- Tier input mirrors `snapShareForTier.ts` exactly, including the K/P/LS branch.
- Role classification mirrors `classifyRole.ts` including the 0.32 specialist bar.
- Positions with n < 25 qualifying seasons excluded (FB, LS in some cuts).
- Percentiles linearly interpolated.
- Analysis scripts are throwaway; they live in the session scratchpad and are reproducible from the formulas above.
