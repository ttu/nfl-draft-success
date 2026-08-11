# Calculation Audit — Fixes

**Date:** 2026-08-10
**Status:** Design, approved for implementation
**Scope:** `src/lib/getPlayerRole.ts`, `positionBaseline.ts`, `draftSlotBaseline.ts`, `deriveDraftSlotBaseline.ts`, `draftSuccessCorrelation.ts`, `classifyRole.ts`, `docs/calculations.md`

A review of the whole calculation chain against the shipped dataset (2013–2026 classes, 23,244 played player-seasons) found one outright bug, three methodology weaknesses, and three documentation or hygiene defects. All are to be fixed. This doc records the evidence for each, the chosen fix, and the order the work has to happen in — several of the changes cascade through precomputed JSON artifacts.

Every figure below was measured against `public/data/draft-*.json` as committed, not estimated.

---

## ✅ Blocker cleared — and it turned up an eighth finding

`pnpm update-data` has now run (2026-08-11). Everything below that was marked blocked has been **re-measured on corrected data**, and the original conclusions all held. The refresh also exposed a defect none of the seven findings had caught, now fixed:

**Finding 8 — the load denominator was right by accident, and only for one side of the ball.**

Sizing this correctly matters, because an earlier draft of this section overstated it. `dd4ada1` fixed how team capacity is _read_ but was released without regenerating data, so no user ever saw its output. The figures that make the mixed-phase denominator look catastrophic — Nelson at 51%, a 46.9%–52.3% spread — come from that **unreleased intermediate state**, not from anything shipped.

What shipped was this. Capacity was inverted from a single player row per team-game, carrying only the phases that player played. nflverse lists an offensive player first in most team-games, so offensive players were divided by offensive capacity and were **already correct**. Defenders were not:

```
                        SHIPPED              PHASE-MATCHED
  offensive players     p5 0.998, 0.2pts     p5 0.999, 0.1pts
  defensive players     p5 0.919, 8.1pts     p5 0.998, 0.2pts
  worst case            Tyrann Mathieu       —
                        DB ARI 2018, 87.0%
```

(Full-season, every-game, essentially-every-snap players; `load ÷ avgSnap`, which should be 1.0.)

So the live defect was **a noise tail on defenders** — about 5% of full-time defensive seasons under-read by up to 13 points — not a league-wide halving.

**This change is therefore a general improvement, not an incident fix.** It does three things:

1. Closes that defensive tail (8.1 points → 0.2).
2. Makes `dd4ada1` releasable. Summing capacity across every row is correct, but on a combined offence+defence denominator it halves every player. Phase-matching is the prerequisite for shipping that fix at all.
3. Removes a dependency on CSV row order. The shipped numbers were right because nflverse happens to list offence first — a reordering upstream would have moved them silently. Correct by construction now, not by luck.

Nelson reads **100.0%**, Wirfs 100.0%, Mahomes 98.7%. Baselines sit on the scale the role thresholds were designed for — C 1.0, G 1.0, OT 0.999, QB 0.993, with rotational positions below (DT 0.691, RB 0.670) — and all **852 tests pass**, including the 16 that failed under the mixed-phase state.

### Re-measured on corrected data

| Finding                    | Original (stale)                 | Re-measured                                                                                    | Verdict              |
| -------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- |
| **2** over-slot year drift | 2015 −3.29 → 2025 +7.63          | 2015 **−3.26** → 2025 **+7.62**                                                                | Confirmed, unchanged |
| **3** correlation, n=32    | raw r=0.218, slot r=0.463        | raw **r=0.227** CI [−0.13, 0.53] spans zero; over slot **r=0.467** CI [0.14, 0.70] significant | Confirmed            |
| **4** FB baseline          | p90 0.196, only clamped position | p90 **0.196**, still the only clamped position (RB 0.670, DT 0.691 clear)                      | Confirmed            |
| **5** saturation           | 4.7% of played seasons           | **4.6%**                                                                                       | Confirmed            |

**Revision to finding 4's floor.** The original 0.65 proposal is viable again now the scale is restored, but it sits only 0.02 below RB's 0.670 — one refresh of drift from silently clamping running backs. **0.50 is the better choice**: it still leaves zero fullback seasons in the Core Starter band while keeping a 25% margin under the lowest real position. Choose 0.50.

---

## Superseded: the stale-data blocker (kept for the record)

Commit `dd4ada1` ("read a team-game's capacity from every row, not the first one") fixed `buildTeamSeasonDenominatorTotals`, which had been reading each team-game's snap capacity from the **first player row** for that `(game_id, team)` and inverting that one player's percentages. Players are offense-only or defense-only, so no single row carries both phases: whenever the first row happened to be an offensive player, `defense_pct` was 0 and that game's entire defensive capacity dropped out of the season denominator.

**`pnpm update-data` has not been run since.** Every `public/data/draft-*.json` in the tree — and `position-baselines.json`, `draft-slot-baseline.json`, `default-rankings.json`, `lagged-draft-rankings.json` derived from them — still holds `cumulativeSnapShare` computed against a denominator that is wrong for an unknown subset of team-games.

The inflation is **bounded but biased**, because load is stored as `min(computedLoad, snapShare)`. So the failure mode is not a uniform 2x: it is loads that belong below average share being pushed up against that cap, which compresses the top of each position's distribution toward `snapShare` — precisely where a p90 baseline is read. Expect baselines biased **high**.

Which findings this touches:

| Finding                                       | Status under stale data                                               |
| --------------------------------------------- | --------------------------------------------------------------------- |
| **1** badge/score denominator mismatch        | **Unaffected** — a code-logic inconsistency, independent of values    |
| **5** docstring, **6** docs, **7** dead param | **Unaffected** — structural                                           |
| **4** FB floor                                | **Blocked** — the 0.65 choice rests on FB p90 = 0.196, measured stale |
| **2** over-slot drift                         | **Blocked** — the ±11-point spread is measured stale                  |
| **3** correlation                             | **Blocked** — both `r` values measured stale                          |

Findings 1, 5, 6 and 7 may proceed. Findings 2, 3 and 4 are **on hold until `update-data` runs**, and every number supporting them must be re-measured before any threshold is chosen. Do not pick a floor against today's distributions.

`update-data` is a network job against nflverse that rewrites every data file; it is the user's call to run, not something either agent should trigger unilaterally.

---

## Summary

| #     | Finding                                                    | Severity | Cascades to artifacts |
| ----- | ---------------------------------------------------------- | -------- | --------------------- |
| **1** | Role badge ignores the rookie-window denominator           | Bug      | Yes (rankings)        |
| **2** | Over slot drifts systematically with draft year            | Method   | Yes (slot curve)      |
| **3** | Correlation reported without uncertainty on n=32           | Method   | No                    |
| **4** | `BASELINE_FLOOR` too low — fullbacks read as full-time     | Method   | Yes (all of them)     |
| **5** | Score saturates, contrary to its own docstring             | Doc      | No                    |
| **6** | `docs/calculations.md` §7–§9 describe a superseded formula | Doc      | No                    |
| **7** | `classifyRole`'s `gamesPlayed` parameter is dead           | Hygiene  | No                    |

---

## 1. Role badge ignores the rookie-window denominator

### The defect

Two functions read the same seasons from `getFilteredSeasons` and then divide by different denominators:

- `getPlayerDraftScore` divides by `scoredSeasonCount(pick, seasons.length)` — the rookie-contract window (`getPlayerRole.ts:204`).
- `getPlayerAverageScoreWeight` divides by `seasons.length` — the seasons actually played (`getPlayerRole.ts:156`).

`getPlayerAverageScoreWeight` drives `getPlayerRole`, which drives the badge, the role filters, the draft-class bucket counts, and `coreStarterRate`. So a pick who started as a rookie and then washed out is averaged over only the seasons he survived, and collects the top badge:

```
Josh Rosen      2018 R1  badge=core_starter  score=17.7  seasonsJudged=1  denominator=5
DeShone Kizer   2017 R2  badge=core_starter  score=22.6  seasonsJudged=1  denominator=4
C.J. Henderson  2020 R1  badge=core_starter  score=15.1  seasonsJudged=1  denominator=5
Deandre Baker   2019 R1  badge=core_starter  score=19.1  seasonsJudged=1  denominator=5
Corey Coleman   2016 R1  badge=core_starter  score=27.3  seasonsJudged=2  denominator=5
Cameron Erving  2015 R1  badge=core_starter  score=28.0  seasonsJudged=2  denominator=5
```

This is not cosmetic. `getRollingDraftScore.ts:75` counts `getPlayerRole(pick, opts) === 'core_starter'` into `coreStarterCount`, so these picks inflate their team's Core Starter %.

The rookie window exists precisely to stop a departed pick's unplayed years from vanishing from the average (`rookieWindow.ts:60-91`). The badge path simply never got the same treatment.

### Fix

Apply the same denominator in `getPlayerAverageScoreWeight` when `draftingTeamOnly` is set, mirroring `computePlayerDraftScore`:

```ts
const denominator = draftingTeamOnly
  ? scoredSeasonCount(pick, seasons.length)
  : seasons.length;
return sum / denominator;
```

Career mode keeps the plain mean, for the reason already documented at `getPlayerRole.ts:198-203`: its numerator spans every team the player suited up for, so the drafting team's window is not a legitimate divisor.

### Consequences to expect

- Rosen becomes `1 season × weight 4 ÷ 5 = 0.8` → **Depth**. Coleman `7 ÷ 5 = 1.4` → **Depth**.
- Picks retained through their whole window are **unaffected** — for them `scoredSeasonCount` already equals the played-season count. The change bites only on departed picks and on gap years inside the window, which is the intent.
- League-wide Core Starter % will fall. `default-rankings.json` carries `coreStarterRate` and must be regenerated.
- The band thresholds in `averageScoreWeightToRole` (0.5 / 1.5 / 2.5 / 3.5) were calibrated against a per-season mean. They stay as-is: a full-window pick's mean is unchanged, so the bands still mean what they meant. Do not retune them in the same change — if they need adjusting, that is a separate, separately-evidenced decision.

### Tests

- Pin the Rosen shape: a pick with one weight-4 season and a 5-year window classifies as `depth`, not `core_starter`.
- Pin that badge and score now agree in direction: no pick may hold a `core_starter` badge with a drafting-team score below the `significant_contributor` band floor.
- Pin that career mode (`draftingTeamOnly: false`) is unchanged.

### Measured effect — recorded here because it is not reproducible later

A concurrent session's pre-commit hook regenerated `default-rankings.json` while this change sat uncommitted in the tree, which produced a clean before/after on real data. The regenerated file was reverted (it is derived from pre-`dd4ada1` loads — see the blocker above), but the diff is worth keeping:

```
coreStarterRate   0.3514 -> 0.2703
                  0.3158 -> 0.2368
                  0.2432 -> 0.2162
                  0.2381 -> 0.2143

score, overSlot, rank:  unchanged, every team
```

Two things it establishes:

1. **The change is surgical.** Twenty lines moved, all of them `coreStarterRate`. No team's `score`, `overSlot` or `rank` shifted, confirming the fix reaches badge-derived metrics only and leaves `getPlayerDraftScore` untouched.
2. **Roughly a quarter of Core Starter badges were picks who left early and kept the badge.**

**This isolation cannot be reproduced after `update-data` runs.** `dd4ada1` changes the loads that feed the role tiers, so the next regeneration moves scores _and_ badges together and the badge-only attribution is lost. The figures above are measured on stale loads and every digit will change; what survives the correction is the direction and the isolation, which is why they are recorded now rather than re-derived later.

---

## 2. Over slot drifts systematically with draft year

### The evidence

Mean over-slot by draft class, drafting-team basis:

```
2013  -3.21     2018  +2.26     2023  +3.04
2014  -1.51     2019  -0.20     2024  +2.93
2015  -3.29     2020  +1.58     2025  +7.63
2016  +0.47     2021  +0.80
2017  -1.35     2022  +4.19
```

An ~11-point spread from 2015 to 2025. Raw score shows the same drift (34.45 → 44.98). Neither is drafting skill.

### Root cause

Two compounding effects:

1. The expectation curve is fit on **mature classes only** (`DRAFT_SLOT_MATURITY_LAG = 3`, so 2013–2023) but `expectedScoreForPick` is applied to **every** class including 2024 and 2025.
2. An immature pick's score is divided by `min(elapsed, window)` (`rookieWindow.ts:101`), so he is never charged the decline or departure years that mature picks are charged. A 2025 pick is judged on one rookie season against an expectation built from settled five-year careers.

### Impact, measured

Within a fixed span the bias largely cancels, because all teams share the same draft years:

```
span 2018-2021   top5 unchanged   largest rank shift: JAX, 1 place
span 2022-2025   top5 unchanged   largest rank shift: ARI, 3 places
span 2013-2025   top5 unchanged   largest rank shift: CAR, 2 places
```

So the **team rankings are sound**. The defect is in the **per-pick** figure: the signed over-slot in `PlayerList` and the "Over slot" column compare a 2025 rookie against a 2015 veteran on a scale that differs by ~11 points. Two picks with identical careers, ten years apart, do not read alike.

### Fix — maturity-conditioned expectation

Make the expectation a function of both slot and how far into its window the pick is:

```
expected(overallPick, age)     where age = LATEST_SEASON − draftYear + 1, clamped to the window
overSlot(pick) = score(pick) − expected(pick.overallPick, age(pick))
```

Derivation changes in `deriveDraftSlotBaseline.ts`: for each `age` in `1..5`, collect points from every class at least `age` years old, scoring each pick **with its seasons truncated to the first `age` years** and the denominator computed at that same age. Fit one curve per age with the existing `fitDraftSlotCurve`. Store as a keyed set of knot tables in `draft-slot-baseline.json`.

A mature pick (`age >= window`) lands on the current curve, so today's team rankings move only slightly. A 2025 pick is measured against what first-year picks at his slot historically did, which is the comparison that was missing.

Keep `DRAFT_SLOT_MATURITY_LAG` for the `age = window` curve; the younger-age curves can use every class old enough to supply that many seasons, which gives them a larger sample than the mature-only rule would.

**Acceptance:** mean over-slot per draft year must fall inside roughly ±1.5 for every class from 2013 to 2025. That is the number to re-measure after the change.

### Fallback, if the above proves too costly

Suppress the over-slot figure for classes younger than `DRAFT_SLOT_MATURITY_LAG` and label them provisional in the UI. This is strictly worse — it hides a number rather than fixing it, and 2024/2025 are the classes readers most want — so take it only if the age-conditioned fit does not converge on the thin early-slot samples.

### Note on sample thinness

Independent of this fix: the shipped curve has pick 1 at 88.89 and pick 2 at 72.77, a 16-point cliff resting on 11 mature classes, i.e. 11 players at pick 1. `enforceNonIncreasing` cannot smooth this because the cliff runs the correct direction. Worth stating as a caveat in the methodology copy; not worth special-casing in code.

---

## 3. Correlation reported without uncertainty

### The evidence

Recomputing the shipped lagged windows (draft 2018–2021 → wins 2022–2025), n = 32:

```
raw score   r=0.218   95% CI [-0.14, 0.53]   t=1.22   CI spans zero
over slot   r=0.463   95% CI [ 0.14, 0.70]   t=2.86   significant
```

`classifyCorrelation` (`draftSuccessCorrelation.ts:173`) bands `|r| >= 0.1` as "weak" and `>= 0.3` as "moderate". Those are large-sample rules of thumb. At n=32 the noise floor is roughly ±0.35, so calling r=0.218 a "weak positive" correlation describes nothing — the data cannot distinguish it from zero.

The over-slot result is real and is a genuine vindication of the metric. But a bare point estimate oversells its precision: the true value could be anywhere from 0.14 to 0.70.

### Fix

1. Add a Fisher z-transform confidence interval alongside `pearson`:

   ```ts
   export function pearsonInterval(
     r: number,
     n: number,
   ): { lo: number; hi: number } | null;
   ```

   Returns `null` for `n < 4` or `|r| >= 1`, where the transform is undefined.

2. Extend `CorrelationResult` with the interval and `n` for both coefficients.

3. Gate `classifyCorrelation` on the interval: when the CI spans zero, return strength `'no'` regardless of `|r|`, so the copy says the data does not establish a relationship rather than naming a weak one. Keep the magnitude bands for intervals that exclude zero.

4. Surface `n` and the interval in the Methodology view. A reader who sees "r = 0.46, 95% CI [0.14, 0.70], n = 32" can judge it; one who sees "moderate positive" cannot.

### Related: stale claim to check

Project notes assert the draft-score↔winning correlation runs negative. On the current dataset it is **+0.218 raw, +0.463 over slot**. The app's copy is generated from the live `r` (`classifyCorrelation` exists for exactly this reason) so the UI adapts on its own, but any prose, comment, or note asserting a negative relationship is now wrong and should be corrected. `draftSuccessCorrelation.ts:132-137` carries such a comment.

---

## 4. `BASELINE_FLOOR` too low — fullbacks read as full-time starters

### The evidence

Un-floored p90 by position, ascending:

```
FS   n=    2   p90=0.087      <- below MIN_QUALIFYING_SEASONS, correctly skipped
FB   n=   40   p90=0.196      <- floored to 0.35 today
RB   n=  790   p90=0.670      <- lowest genuine position
NT   n=   60   p90=0.672
DT   n=  817   p90=0.681
...
C    n=  248   p90=1.000
```

FB's true p90 is 0.196; the highest FB season in the entire dataset is 0.312. The `BASELINE_FLOOR` of 0.35 already softens this, but not nearly enough:

```
Andy Janovich    2016  raw=0.312  ->  0.89 normalized  (Core Starter band, weight 4)
Aaron Ripkowski  2016  raw=0.280  ->  0.80 normalized  (Core Starter band, weight 4)
```

A fullback on the field for 28% of snaps scores identically to a franchise left tackle. Dividing by a within-position p90 corrects the genuine measurement artifact §2.5 was written for — an OL plays more snaps than a RB — but applied to a position that is part-time _by definition_ it also erases a real difference, and guarantees every position manufactures core starters at the same rate however marginal it is.

### Fix — raise `BASELINE_FLOOR` to 0.65

Chosen over exempting FB (the K/P/LS route) because the floor is the mechanism already built for this, and a threshold generalises to any future marginal position where an exemption list does not.

**0.65 binds on FB and nothing else.** Verified against the committed baselines: the only position below 0.65 is FB at 0.35, and the lowest non-FB baseline is 0.67 (RB). So this is surgical today while remaining a genuine guard.

Effect across all 143 played FB seasons:

```
floor 0.35 (today)   2 seasons in Core band,  23 in Significant band
floor 0.50           0 in Core,                9 in Significant
floor 0.60           0 in Core,                4 in Significant
floor 0.65 (chosen)  0 in Core,                2 in Significant
floor 0.70           0 in Core,                2 in Significant
```

At 0.65 no fullback is a Core Starter, and the two left in the Significant Contributor band are Janovich 2016 (0.48) and Ripkowski 2016 (0.43) — the two best fullback seasons in the data, which is where they belong.

### Trade-off to record

0.65 sits just under RB (0.670) and NT (0.672). If a future dataset produced a position with a true p90 of, say, 0.60, the floor would silently override it. That is what a floor is for, but it should be stated in `positionBaseline.ts` so the next person to see a floored baseline knows it was deliberate, and `deriveBaselines` should keep reporting which positions the floor bound on.

### Cascade

This one changes scores, so it propagates furthest — see the ordering section below.

---

## 5. Score saturates, contrary to its own docstring

`getPlayerRole.ts:165-167` states the continuous score "does not saturate — it separates a full-snap starter from a part-time one." The clamp in `normalizeSnapShareForPosition` (`positionBaseline.ts:73`) makes that false:

```
played player-seasons: 23,244
clamped at exactly 1.0:  1,085  (4.7%)
>= 0.95:                 2,184  (9.4%)

by position: C 7.5%, NT 6.5%, S 6.1%, DL 6.0%, G 5.9%, TE 5.3%, OT 5.2%
```

By construction, roughly the top decile of qualifying seasons at every position normalizes to 1.0 and becomes indistinguishable.

### Fix

Correct the comment rather than the behaviour. The clamp is deliberate — an unclamped ratio would let one position's outlier exceed 100 on a 0–100 scale and break the over-slot subtraction. Replace the claim with what is actually true: the score separates part-time from full-time usage across most of the range, and saturates in the top decile at each position, where it deliberately declines to rank full-time starters against each other on snap count alone.

Keeping a false claim in the file that defines the score is the whole problem; the honest sentence costs nothing.

---

## 6. `docs/calculations.md` §7–§9 describe a superseded formula

§7.1, §7.2 and the §9 flow diagram document:

```
score = sum(player role weight) / totalPicks        range 0.0-4.0
```

The code computes the mean of the continuous 0–100 `getPlayerDraftScore` over `scoredPicks` (`getRollingDraftScore.ts:85`). Wrong formula, wrong scale, wrong denominator. Anyone reading the doc to check the arithmetic — which §7.5 says is the whole point of the "show the math" panel — is checking against a formula the app abandoned.

Also in scope:

- **§8 "Contributor Definition"** lists Core Starter, Starter When Healthy, Significant Contributor, Depth — and omits **Contributor**, contradicting both §6.1 and `SPEC_CLARIFICATIONS.md`.
- **§7.1's `totalPicks`** should read `scoredPickCount`. Checked for live distortion: only the 2026 class has unscored picks, uniformly across all teams, so nothing is skewed today — but the doc still names the wrong denominator.
- **§7.4** must be rewritten for the maturity-conditioned expectation from finding 2.
- **§4.2** must record the window denominator from finding 1.
- **§2.5** must record the new floor and its FB rationale from finding 4.

### Fix

Rewrite §7.1, §7.2, §9 against the shipped code; correct §8; update §2.5, §4.2, §7.4 as the corresponding code changes land. Per project convention the doc updates commit **with** their implementation, not as a separate pass.

---

## 7. `classifyRole`'s `gamesPlayed` parameter is dead

`classifyRole(share, gamesPlayedShare, _gamesPlayed, position?)` — the third argument is unused and underscore-prefixed, yet passed at all four call sites and documented in §3 and §9 as part of the signature. It has been retained "for call-site compatibility", but the call sites are all in this repo.

### Fix

Drop the parameter, update the four call sites, and update the signature in `calculations.md` §3 and §9. Straight deletion, no behaviour change.

---

## Implementation order

The changes interact through precomputed artifacts, and the data underneath them is currently wrong (see the blocker above). This order avoids both deriving a threshold from bad data and fitting a curve against scores that are about to change.

**Stage 1 — value-independent, no cascade. ✅ Done.** Findings **5** (docstring), **1** (badge denominator) and **7** (dead parameter). All three are code-logic changes whose correctness does not depend on the load values, so they were safe to take ahead of the data regen. Full suite green (844 tests).

Finding 7 was briefly held because one call site, `PlayerDetailView.tsx`, was owned by a concurrent session; taken once that session's commit (`ed52a48`) landed. Dropping the parameter is guarded by the type checker rather than by tests alone — a leftover numeric third argument cannot type against `position?: string` — plus one regression test that a position string in that slot is read as a position, never as a game count.

**Stage 2 — `pnpm update-data`. BLOCKING, user-run.** Rewrites every `public/data/draft-*.json` against the fixed denominator. Nothing below may be measured or chosen until this has run. Afterwards, regenerate the derived artifacts in dependency order:

```
pnpm derive-baselines                        # position-baselines.json
tsx scripts/derive-draft-slot-baseline.ts    # refits on corrected scores
pnpm generate-rankings
pnpm generate-lagged-rankings
```

Note `pnpm update-data` already runs all four in this order, so a full run covers it.

**Stage 3 — re-measure, then finding 4 (the FB floor).** Re-derive FB's true p90 and the whole baseline table against corrected data, _then_ choose the floor. The 0.65 in this doc is a pre-fix figure and must be re-justified, not re-applied. Regenerate the four artifacts again afterwards, since the floor changes `getSeasonScore` output.

**Stage 4 — finding 2, maturity-conditioned expectation.** Depends on stage 3's scores being final. Re-derive the slot baseline and both rankings. Re-measure mean over-slot per draft year and confirm it sits inside ±1.5. Fold in the `formatOverSlot` negative-zero fix (rankings row 30 renders `-0.0`) — same surface, outstanding CodeRabbit finding.

**Stage 5 — finding 3, correlation intervals.** Reads the stage-4 rankings, so it goes last. Recheck both coefficients and their CIs against the rebuilt artifacts before writing any methodology copy — **the `r` values quoted in this doc are pre-fix and will move.**

Then finish finding 6's §2.5 / §4.2 / §7.4 updates against the settled behaviour.

## Verification

- Unit tests per finding as described above; `deriveBaselines.test.ts` already pins the non-self-referential invariant and must keep passing through stage 2.
- Full suite plus `/verify` after each stage — the precomputed artifacts are covered by tests that will catch a stale regeneration.
- `/visual-verify` after stages 3 and 4: badges, the Over slot column and the Methodology view all change on screen.
- Re-run the audit measurements (per-year mean over-slot, saturation share, badge/score disagreement count) and record the after numbers in this doc.
