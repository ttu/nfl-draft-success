# Injured Reserve as a Load Signal

**Date:** 2026-08-24
**Status:** Design, approved for implementation

> **Superseded in part.** This design's combination rule — `max(injuryReportWeeks, seasonEndingAbsenceGames, reserveWeeks)` — was replaced after implementation by a week-set intersection: `excusedGames = |missedWeeks ∩ (injuryWeeks ∪ reserveWeeks)|`. The reasoning below was sound for what it knew at the time, but two things it didn't account for: a player placed on injured reserve is _removed_ from the weekly injury report, so `injuryReportWeeks` and `reserveWeeks` describe consecutive halves of one absence rather than the same absence, and separately `injuryReportWeeks` counts weeks a player was listed _while playing_, so `max()` also over-forgave on that count. `seasonEndingAbsenceGames` (the 2013–2015 fallback) is unaffected — it is still combined with `max()` on top of the intersection. Measured on regenerated data, the retired `max()` rule over-forgave roughly 2,500 player-seasons (~13,400 games) and under-forgave 662 (1,133 games) relative to the current rule. See `docs/calculations.md` for the rule as implemented. The blast-radius table further down in this document predates that change and no longer reflects the shipped behavior.

**Scope:** `scripts/update-data.ts`, `src/lib/reserveWeeks.ts` (new), `src/lib/injuredSeason.ts` (new), `src/lib/teamSeasonDenominator.ts`, `src/lib/seasonEndingAbsence.ts`, `src/lib/explainDraftScore.ts`, `src/lib/careerShapeHighlights.ts`, `src/types.ts`, `src/components/views/player/PlayerDetailView.tsx`, `src/components/views/player/ScoreBreakdown.tsx`, `src/App.css`, `docs/calculations.md`

The pipeline cannot see a player who spent a season on injured reserve. The weekly injury report — the only injury source it reads — covers the active roster, so the worst injuries are precisely the ones that leave no trace. `seasonEndingAbsence.ts` exists to cover that gap, but it only detects absences that run to the _end_ of a season, so an injury at the front of a year, with a return, is invisible to both signals.

This design replaces that heuristic with nflverse weekly roster data from 2016 on, where a player's reserve status is recorded directly.

Every figure below was measured against `public/data/draft-*.json` as committed and against the nflverse CSVs themselves, not estimated.

---

## The case

Derwin James (`JameDe00`, LAC, 2018 R1P17) missed most of 2019 and all of 2020. Neither season appears in `injuries_{season}.csv` — **zero rows in both**, because IR removes a player from the weekly report.

`roster_weekly_2019.csv` records what actually happened: weeks 1–11 `RES`, weeks 13–17 `ACT`. He returned and played the last five games at a **0.992 per-game snap share** — the best rate of his career.

The pipeline scores that season 31.3.

| season                   | signal state          | load      | avail | score    | role                   |
| ------------------------ | --------------------- | --------- | ----- | -------- | ---------------------- |
| 2021 (8 report weeks)    | excused today         | 0.937     | 0.882 | 93.1     | `core_starter`         |
| 2021                     | _if not_ excused      | 0.829     | 0.882 | 85.4     | `core_starter`         |
| **2019** (IR, invisible) | **not excused today** | **0.308** | 0.313 | **31.3** | `contributor`          |
| 2019                     | _if_ excused          | 0.992     | 0.313 | **79.4** | `starter_when_healthy` |

The 2019 row is the same class of season as 2021 — hurt, returned, played at his own level — scored 48 points worse purely because of which feed recorded the injury. It is filed as `contributor` when the data says `starter_when_healthy`.

### Why the existing fallback misses it

`seasonEndingAbsenceGames` looks backwards from the end of the season: "the player appears every week, then never again." Its own doc states it returns 0 "when the player came back." James came back. Both signals read zero, so `injuryAdjustedFullSeasonDenominator` applies no adjustment and measures him against all 16 games.

### 2020 is a different problem, and is out of scope for the math

Walk `injuryAdjustedFullSeasonDenominator` for a wholly-missed season with all 16 weeks excused:

```
adjusted = fullSeasonTeamDen − 16 × avgPerGame = 0
return max(0, cumDenGamesPlayed = 0) = 0
→ useFullSeason false → share = cumNum / cumDenGamesPlayed = 0 / 0 → 0
```

Denominator excusal cannot rescue a season with no numerator. A wholly-missed year scores 0.0 no matter what reserve data says.

That is also the correct outcome under a decision this codebase states deliberately (`seasonPlayed.ts:10`):

> a player who spent a real season injured also has no games and no snaps, and that _should_ count against his pick

**That decision stands.** James 2020 keeps its 0.0 and keeps counting in the career average. Reserve data is used there only to _label_ the season, never to rescore it.

---

## Data source

`https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{season}.csv`

### Join key: `gsis_id`, not `pfr_id`

`pfr_id` fill rate ranges 32%–74% by season and is **empty for all of 2013**. `gsis_id` is 99–100% populated in every season.

No `pfr_id → gsis_id` map needs building, and none exists — `loadNflversePlayers` produces only headshots and position meta. The draft_picks row carries its own `gsis_id`, read at `update-data.ts:902`, and that is what `buildDraftPick` already uses to look up injuries (`sources.injuryData.get(gsisId)`). Reserve weeks are keyed and looked up the same way, on the same line. The "39 picks with no mapping" figure below is the count of draft rows with no `gsis_id` at all.

The codebase reached this conclusion once already: `loadOffseasonRoster`'s doc states `gsis_id` "is the reliable key here — the roster release carries one for essentially every row, while `pfr_id` is missing from roughly 40% of them. Matching on `pfr_id` alone reads established players as unrostered."

Measuring this join on `pfr_id` silently reports zero reserve weeks for Luke Joeckel's genuine 2013 IR stint — an illustration only, since `FIRST_RESERVE_SEASON` gates 2013 out anyway, so do not go looking for a live Joeckel case. The failure mode is what matters: it is silent, and it looks like the absence of injuries rather than the absence of a join. Any implementation that appears to show players as never injured should be suspected of this bug first.

### Coverage floor: `FIRST_RESERVE_SEASON = 2016`

2013–2015 weekly roster data is structurally unusable:

| era       | players with any reserve week | mean week of reserve rows |
| --------- | ----------------------------- | ------------------------- |
| 2013–2015 | ~200–250                      | **6.8** (skewed early)    |
| 2016–2019 | ~500–540                      | 10.0                      |
| 2020+     | ~600–1,100                    | 10.3                      |

Roughly 500–700 players reach IR in a real NFL season, so 2013–2015 captures under half, and places them at the wrong weeks — injuries accumulate through a season, so a mean week _below_ the midpoint is backwards. Two confirmations:

- **Tyler Eifert 2014** — dislocated his elbow in Week 1 and missed the year. His roster data is a single row, week 1.
- **Luke Joeckel 2013** — went on IR after Week 5. His reserve weeks are recorded as 1–5, the weeks he _played_.

Applied to 2013–2015, the replacement removes excusal from 150 player-seasons (915 games) while adding it to only 40 (128 games) — a 4:1 ratio of removals. That is data loss, not correction. 2016+ is balanced and net-forgiving, which is what a better signal should look like.

`FIRST_RESERVE_SEASON` joins `FIRST_SNAP_SEASON` and `FIRST_INJURY_SEASON` as a per-source coverage floor, the pattern already in `update-data.ts`.

### Row filter

- `game_type ∈ {REG, POST}` — preseason roster churn is not a season absence.
- Reserve statuses: **`RES`, `RSR`, `PUP`, `NON`**.
  `RSR` matters and is easy to miss: Eifert 2014 and Alec Ogletree 2015 carry it rather than `RES`.
- Exclude `status_description_abbr ∈ {'R62', 'R59'}`.

### On `R62` and `R59`

Both codes are COVID-19 reserve, and both are confined to the two seasons the NFL ran a COVID-19 reserve list:

| code  | 2020 rows | 2021 rows | any other season |
| ----- | --------- | --------- | ---------------- |
| `R62` | 701       | 0         | 0                |
| `R59` | 305       | 725       | 0                |

For `R62` the year-confinement plus the existence of the COVID reserve list is the whole argument. For `R59` the stint lengths settle it: the median `R59` stint is **one week**, and 90% of 2020's and 98% of 2021's run two weeks or shorter. The injured-reserve minimum over those seasons was three games, so a one-week reserve stint cannot be injured reserve.

Both identifications are inference from the distribution — nflverse publishes no code dictionary (`dictionary_rosters.csv` describes the column only as "a code corresponding to a particular NFL status"). They are recorded as inference so a future reader can overturn either with better evidence.

Excluding them is only possible because 2020 and 2021 are coded seasons. COVID distorts two years, not one, and both are years we can see.

### Accumulation

Count **distinct week values** per (`gsis_id`, season) → `reserveWeeks`. Same shape as `injuryReportWeeks`, so a bye week spent on reserve is absorbed by the existing `missedGames` cap in `injuryAdjustedFullSeasonDenominator` rather than needing its own rule.

### Known limitation

`status_description_abbr` coverage by era:

| seasons   | coded    | codes present                               |
| --------- | -------- | ------------------------------------------- |
| 2013–2015 | 100%     | only `A01`/`I01` — no injury discrimination |
| 2016–2019 | **3–5%** | effectively empty                           |
| 2020      | 82%      | `R01`, `R62`, `R59`, …                      |
| 2021–2025 | 100%     | `R01` dominant                              |

So for 2016–2019 there is no way to separate injured reserve from non-injury reserve (`R48`, `R05`, `R04`), and `reserveWeeks` forgives both alike there.

An earlier version of this section bounded that over-forgiveness at "roughly 15–25% of reserve weeks", derived from `R01`+`R59` being 76–85% of reserve weeks in the coded seasons. **That grouping was wrong**, and it is the origin of a defect that shipped: `R59` is COVID reserve, not injured reserve (see "On `R62` and `R59`" above), so counting it as injury both inflated 2020 and 2021 forgiveness directly and inflated the injury share the bound was read off.

What is known now: the injury-coded share of reserve weeks in the fully-coded seasons is `R01` alone, which is smaller than the 76–85% figure, so the true over-forgiveness bound for 2016–2019 is **larger than 15–25%** and is not restated here as a number — the old one was derived from a grouping since found wrong, and recomputing it honestly would need a fresh pass over the coded seasons. The qualitative claim survives: the exposure is bounded by the non-injury share of coded reserve weeks rather than unlimited, and forgiving 2016–2019 imperfectly is still strictly better than the status quo, which forgave them at 0%.

### Cost

~13MB per season × 10 seasons ≈ 130MB per full refresh, fetched sequentially. This becomes the heaviest step in `update-data.ts`.

---

## Components

### `src/lib/reserveWeeks.ts` (new)

Pure accumulation over parsed CSV rows, following `snapCountTotals.ts` / `restGame.ts` — the script fetches, the lib decides. Unit-testable without network.

```ts
export const RESERVE_STATUSES: readonly string[] = ['RES', 'RSR', 'PUP', 'NON'];
export const NON_INJURY_RESERVE_CODES: readonly string[] = ['R62', 'R59'];

/** Distinct reserve weeks per gsis_id for one season's roster rows. */
export function accumulateReserveWeeks(rows: CsvRow[]): Map<string, number>;
```

### `src/types.ts`

`Season` gains `reserveWeeks?: number`, written only when non-zero.

The era gate is expressed in the data rather than hidden in a branch: **2016+ writes `reserveWeeks`, 2013–2015 writes `seasonEndingAbsenceGames`, and no season carries both.** A reader inspecting any season row can tell which signal produced it. Older JSON without `reserveWeeks` keeps working unchanged.

### `src/lib/teamSeasonDenominator.ts`

`injuryAdjustedFullSeasonDenominator` and `resolveCumulativeLoadWithInjury` take `reserveWeeks` alongside the existing two signals and max all three:

```ts
const excusedWeeks = Math.min(
  Math.max(0, injuryReportWeeks, seasonEndingAbsenceGames, reserveWeeks),
  missedGames,
);
```

Still "strongest signal wins, never summed" — and because the two absence signals are mutually exclusive by era, the max is over at most two populated values. The existing doc comment explaining why these are maxed rather than summed extends to cover the third.

**The guard above it matters more than the max.** `resolveCumulativeLoadWithInjury:407-410` only calls the adjustment at all when:

```ts
options.useFullSeasonDenominator &&
  (options.injuryReportWeeks > 0 || seasonEndingAbsenceGames > 0) &&
  options.gameCount > 0;
```

`reserveWeeks > 0` must be added to that disjunction. A season carrying reserve weeks and nothing else — which is exactly the headline case, James 2019 — otherwise takes the unadjusted branch and the whole feature is a silent no-op. This is the single line that separates working from doing nothing.

### `src/lib/seasonEndingAbsence.ts`

Kept, unchanged in behavior. Its doc is rewritten to state it is now the **pre-2016 fallback**, with the coverage evidence and a pointer to `reserveWeeks.ts`.

**Where the gate lives:** in `update-data.ts`, not here. `seasonEndingAbsenceGames` is computed unconditionally in `loadSnapData` and carried through `loadMeta`; the gate suppresses it at the point `buildPickSeason` writes the season row, so that from 2016 on the field is simply not emitted. The lib stays era-agnostic and its tests stay untouched — the same division the codebase already uses for `FIRST_SNAP_SEASON` and `FIRST_INJURY_SEASON`.

### `src/lib/injuredSeason.ts` (new)

```ts
/** A season the player spent on reserve without ever taking the field. Scored 0 and counted; labelled, not excused. */
export function isInjuredOutSeason(season: Season): boolean;
//  gamesPlayed === 0 && teamGames > 0 && (reserveWeeks ?? 0) > 0
```

The obvious predicate — `reserveWeeks >= teamGames` — is wrong, and the reason is worth keeping. `reserveWeeks` counts distinct calendar weeks, bye included, while `teamGames` counts games. For an 18-game playoff team the two never line up, so a player on reserve the entire year reads `false`. Requiring only `> 0` alongside `gamesPlayed === 0` avoids inventing a tolerance: a released player carries `CUT`/`DEV` status, not reserve, so he scores zero reserve weeks and is not labelled.

Known edge, accepted: a player who spent two weeks on IR and was then released reads as injured. He played no games either way, and the chip claims nothing about how the year ended.

### `src/components/views/player/PlayerDetailView.tsx`

Two changes, not one.

**The `injured` chip.** Where the Role cell would read `non_contributor` on such a season, render an `injured` role-chip — the same move the `learning` chip makes for apprentice seasons, and the same reason: an unqualified verdict sitting beside a score the reader cannot explain. Needs a `.role-chip.injured` rule beside `.role-chip.learning` (`App.css:2731`).

The `✕` uncounted mark is **not** shown. The season counts.

**`SeasonEndingInjuryMarker` must be generalised, or the era gate deletes it.** It keys purely on `seasonEndingAbsenceGames` (`PlayerDetailView.tsx:797`), so under the gate the `IR` marker vanishes from every 2016+ season — the best-covered decade, and precisely the seasons this feature is about. Its own doc says it exists so that a forgiven Load sitting beside "IR wks 0" does not read as a bug, which is the exact pairing `reserveWeeks` produces.

It takes `max(seasonEndingAbsenceGames, reserveWeeks)` and its tooltip loses the "final" framing, since a reserve stint need not end the season: `"N weeks on injured reserve"` when `reserveWeeks` wins — weeks, because that is what `reserveWeeks` counts — and the existing "missed the final N games" when the pre-2016 heuristic does, where the figure really is games. The unit follows the signal, and matches the wording `InjuryNote` uses for the same number.

### `src/components/views/player/ScoreBreakdown.tsx` and `src/lib/explainDraftScore.ts`

The note is rendered by `ScoreBreakdown` but produced by `explainInjury` (`explainDraftScore.ts:127-142`), and that function is the actual gate:

```ts
if (injuryReportWeeks === 0 && seasonEndingAbsenceGames === 0) return undefined;
```

For James 2019 — no injury-report rows, no season-ending absence — the note never renders however the string is worded. `explainInjury` must read `reserveWeeks`, in the guard and in its `excusedGames` max, or the UI ships a string that cannot appear.

`InjuryNote` then gains a third signal string, `"N weeks on injured reserve"`, selected when `reserveWeeks` wins. The existing rule holds: name only the winning signal, so the reader is never invited to add them.

Its `gamesPlayed === 0` early return stays exactly as is — that is what keeps a wholly-missed season from advertising an adjustment that did nothing, and it is why James 2020 gets the chip rather than a note.

### `src/lib/careerShapeHighlights.ts`

Two call sites read `seasonEndingAbsenceGames` and both change meaning under the gate:

- `isIronManSeason` (line 155) gates a durability streak on `< MIN_SEASON_ENDING_ABSENCE_GAMES`. Left alone, 2016+ seasons stop disqualifying themselves and iron-man streaks silently absorb injured years.
- `wasHurt` (lines 367-368) gates the "started when healthy" highlight so a benching is not ranked as an injury. Left alone, it loses exactly the IR-invisible cases this feature exists to surface.

Both take the same `max(seasonEndingAbsenceGames, reserveWeeks)`. Highlight movement is not quantified in the blast radius below and should be eyeballed after regeneration.

---

## Data flow

```
roster_weekly_{2016..max}.csv
  → filter game_type ∈ {REG, POST}, status ∈ RESERVE_STATUSES, code ∉ {R62, R59}
  → accumulateReserveWeeks: gsis_id → distinct week count
  → keyed by gsis_id; looked up from the draft_picks row's own gsis_id
  → Season.reserveWeeks
  → max(injuryReportWeeks, seasonEndingAbsenceGames, reserveWeeks), capped by missedGames
  → injuryAdjustedFullSeasonDenominator → cumulativeSnapShare
  → getSeasonScore (Load 0.7 only; Availability 0.3 stays raw)
```

Availability is deliberately untouched, as today. A partially-injured season remains 70% forgiven and 30% charged: the team is not charged for how he played while hurt, but is charged for not having him.

---

## Error handling

- Missing season file → `fetchSeasonCsv(..., { required: false })`, matching injuries. A 404 must behave identically to a season where nobody was on reserve, never as a build failure.
- Player absent from roster data → `reserveWeeks` 0, and the max falls through to the other signals.
- Pick with no `gsis_id` mapping (39 picks league-wide) → 0, as today for injuries.
- `reserveWeeks` exceeding games missed → capped by the existing `missedGames` clamp.

---

## Blast radius

> **These figures predate the switch from `max()` to set intersection** (see the superseded note at the top of this document) and no longer reflect the shipped combination rule.

Measured across all 23,244 played player-seasons, comparing `max(injuryReportWeeks, seasonEndingAbsenceGames)` against `max(injuryReportWeeks, reserveWeeks)` with the 2016 gate applied:

| era     | seasons | lose excusal          | gain excusal          |
| ------- | ------- | --------------------- | --------------------- |
| 2013–15 | 1,530   | _(gated — unchanged)_ | _(gated — unchanged)_ |
| 2016–19 | 5,601   | 405 (1,946g)          | 387 (4,266g)          |
| 2020+   | 16,113  | 995 (4,954g)          | 1,229 (9,586g)        |

Roughly 3,000 player-seasons move, net more forgiving.

**Losses are corrections, and were spot-checked as such.** EJ Manuel 2017 (healthy backup in Oakland — the heuristic was forgiving him 11 games), Datone Jones 2020 and Alec Ogletree 2020 (out of the league entirely). The old heuristic could not tell a player who was hurt from one who was cut or benched; it forgave both.

**Gains are real IR the heuristic could not see:** Johnathan Cyprien 2018 (16 weeks), Kyle Long 2021, Travis Frederick 2020, Kiko Alonso 2020.

Because scores move, the derived artifacts must be regenerated in order after `update-data`:

1. `pnpm update-data`
2. `derive-position-baselines`
3. `derive-draft-slot-baseline`
4. `generate-default-rankings`
5. `generate-lagged-rankings`
6. `generate-team-success`

---

## Testing

TDD throughout — tests first, per `AGENTS.local.md`.

| file                            | covers                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reserveWeeks.test.ts`          | status filter incl. `RSR`; `R62`/`R59` exclusion; preseason rows dropped; distinct-week counting; duplicate rows                                                                                                           |
| `injuredSeason.test.ts`         | reserve weeks with games played → false; reserve weeks with zero games played → true, including the partial-then-released case of line 184; `teamGames === 0` upcoming row false; legacy JSON without `reserveWeeks` false |
| `teamSeasonDenominator.test.ts` | `reserveWeeks` as third max term; still capped by `missedGames`; no double-count when two signals present                                                                                                                  |
| `seasonEndingAbsence.test.ts`   | unchanged — proves the pre-2016 fallback still behaves                                                                                                                                                                     |
| `PlayerDetailView.test.tsx`     | `injured` chip on a fully-missed season; no `✕`; score still rendered; `IR` marker still present on a 2016+ reserve season                                                                                                 |
| `ScoreBreakdown.test.tsx`       | reserve-weeks signal string wins when it is the max                                                                                                                                                                        |
| `explainDraftScore.test.ts`     | `explainInjury` returns a note when `reserveWeeks` is the only signal; still returns `undefined` when `gamesPlayed === 0`                                                                                                  |
| `careerShapeHighlights.test.ts` | reserve weeks disqualify an iron-man streak; `wasHurt` true on an IR-only season                                                                                                                                           |

Regression fixture: the James 2018 pick, asserting 2019 lands near 79 as `starter_when_healthy` and 2020 stays 0.0 with the chip.

Visual verification via `/visual-verify` is mandatory before the work is complete (`AGENTS.md`).

---

## Out of scope

- Changing whether a lost season counts in the career average (`seasonPlayed.ts` stance stands).
- Adjusting the Availability term for injury.
- Using roster data to improve the retention fallback in `resolveRetained`, though the same file would support it.
- Using roster data to separate sitting-to-learn from sitting-injured in `apprenticeship.ts`, a limitation that file documents by name (J.J. McCarthy). Now newly fixable, deliberately deferred.
