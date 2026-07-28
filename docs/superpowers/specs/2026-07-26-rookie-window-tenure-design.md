# Rookie-window tenure in the draft score

Date: 2026-07-26

## Problem

`getPlayerDraftScore` averages a pick's season scores over the seasons the pick
spent with the drafting team. That makes the score a **rate, not a volume**:
three starting years followed by a trade average identically to six starting
years followed by a second contract. Duration is invisible.

Sam Darnold (NYJ, R1 #3, 2018) is the clean case. He played 2018–2020 at ~99%
snap share, was traded to Carolina for a sixth-round pick, and scores **93.8**.

| Year | games | snapShare | season score |
| ---- | ----- | --------- | ------------ |
| 2018 | 13/16 | .995      | 94.1         |
| 2019 | 13/16 | .995      | 94.1         |
| 2020 | 12/16 | .995      | 92.1         |

Post-trade seasons are already excluded — the app hard-codes
`draftingTeamOnly = true` (`src/App.tsx:209`), so Carolina, San Francisco and
Minnesota never enter. The leak is not the numerator. It is the denominator.

Snap share is a fair value proxy at most positions, because teams play good
players. It breaks precisely where a team is _stuck_: Darnold played every snap
because the Jets had no alternative, which is the opposite of the signal the
score reads it as.

## Decision

Divide by the rookie contract window instead of by seasons played, scoring
absent years as zero.

```
window(pick)  = 5 if pick.round === 1 else 4
elapsed       = latestSeason − draftYear + 1
departed      = no retained season row in latestSeason
tracked       = window if departed else min(elapsed, window)
score(pick)   = sum( seasonScore(s) for retained s ) / max( retained, tracked )
```

The window is round-dependent because the CBA rookie deal is: rounds 2–7 sign
four years, only round 1 carries the fifth-year option. A flat five-year window
would score a third-rounder who plays all four years and leaves in free agency
at 4/5 = 0.8 — penalising him for an entirely successful outcome, and
compounding a bias against late rounds that over slot exists to correct.

Note the algebraic identity that motivates this shape:
`mean(retained) × (retained / window)` **is** `sum(retained) / window`. A
"tenure multiplier" and a denominator swap are the same operation. The
denominator form is preferred: one concept instead of two, and no arbitrary
constant to defend.

### The guards

- `min(elapsed, window)` — a 2025 pick still on the roster is measured against
  one season, not five. Without it every recent class reads as a catastrophe.
- `max(retained, …)` — a pick who stays seven years is scored on his seven-year
  mean, not handed a 140. Seasons beyond the window neither help nor hurt.

### Departed picks are charged the full window

Once a pick has left, the rest of his window is known to be zero, so it is
charged immediately rather than waiting for the calendar.

Clamping to elapsed seasons for a departed pick has two faults. It is unfair
across classes: a 2023 one-and-done divides by 3 while a 2018 one-and-done with
an identical career divides by 5, flattering the more recent bust for no reason
but draft year. Worse, it never settles — that 2023 pick's score slides from ÷3
to ÷4 to ÷5 over the following two years, long after anything about the outcome
can change. A settled historical result should have a settled score.

Departure is read as _no retained season row in the latest season_, which covers
both leaving for another roster (a non-retained row) and leaving the league
entirely (no row). Roster seasons spent injured still carry a retained row, so
time on IR does not read as departure.

### Scope boundaries

- **`getPlayerAverageScoreWeight` is unchanged.** The 0–4 role weights behind the
  badges keep `/ seasons.length`. "Core Starter" for Darnold's Jets years is
  factually true, and `coreStarterRate` stays a rate. Two metrics, two meanings.
- **`draftingTeamOnly: false` is unchanged.** With it false the numerator is
  career-wide, so dividing by the _drafting team's_ window is incoherent. That
  path keeps `/ seasons.length`. The existing two-slot WeakMap memo
  (`getPlayerRole.ts:48`) already keeps the two settings in separate entries.
- **`retentionRate` survives as its own number.** It is not folded in.

## Evidence

Measured over all 2,059 scored picks, 2018–2025.

| Metric                  | Old  | New       |
| ----------------------- | ---- | --------- |
| Darnold (NYJ)           | 93.8 | **56.3**  |
| League mean pick score  | 44.5 | 40.8      |
| Picks whose score moves | —    | 556 (27%) |

The young-class guard behaves as designed — mean delta by draft class:

```
2018 −6.05   2019 −5.52   2020 −5.67   2021 −4.79
2022 −4.41   2023 −3.41   2024 −1.18   2025  0.00
```

The residual gradient is only about picks still on a roster; departed picks are
already charged their full window regardless of class. 2025 is untouched because
a pick with no retained season scores 0 under either rule.

Largest drops are the picks the metric should have been moving all along:

```
Alex Leatherwood    LV  R1#17  '21   98.1 → 19.6   (1 season, cut)
Deandre Baker       NYG R1#30  '19   95.9 → 19.2
Josh Rosen          ARI R1#10  '18   88.8 → 17.8
Jarvis Brownlee     TEN R5#146 '24   92.6 → 23.2
C.J. Henderson      JAX R1#9   '20   76.0 → 15.2
Minkah Fitzpatrick  MIA R1#11  '18   92.9 → 37.1
Kenny Pickett       PIT R1#20  '22   82.6 → 33.0
```

Team rankings shift by **3.9 places on average, 11 at most**. The top five goes
`TB NYG NYJ ATL CHI` → `TB NYG LAC KC ATL`. The Jets leaving the top five is the
Darnold effect, and is the intended outcome.

## Plumbing

Every consumer reaches the score through `getPlayerDraftScore`, so the formula
lands in one place. That function receives only a `DraftPick` and needs two
facts it cannot currently reach.

### `draftYear` on `DraftPick`

`DraftPick` (`src/types.ts:37`) has no draft year; only the enclosing
`DraftClass` knows it.

`pick.seasons[0].year` empirically always equals the draft year — verified
across all 2,059 scored picks: zero late starts, zero gaps, and 2,444
zero-game rows confirming `update-data.ts` emits a row per elapsed season. It is
still rejected as a source. It holds by coincidence of the current emit
behaviour; if a future refresh drops empty rows, a pick who missed his rookie
year would get a _shorter_ window and score _higher_ for it — silently,
backwards, and undetectable from outside the function.

Instead `DraftPick` gains `draftYear: number`, stamped in `loadData`
(`src/lib/loadData.ts:69`) where the year is authoritative from the filename.
No JSON regeneration, no schema migration, no threading through call sites.
Stamping happens during load, before anything caches, so the memo's "immutable
once loaded" contract holds.

### `latestSeason`

Must be global and range-independent. Deriving it from loaded classes breaks the
moment a user narrows the range: load 2018–2020 and `latestSeason` becomes 2020,
silently making every old class look fully-windowed.

It also cannot come from `public/data/data-meta.json`, which is an async
`fetchJson` (`loadData.ts:118`) racing against scoring; a lost race scores every
pick against a window of `NaN`.

New `src/data/season-window.json` (`{"latestSeason": 2025}`), statically
imported, written by `update-data.ts` — following the existing pattern of
`draft-slot-baseline.json` and `bust-exclusions.json`. Build-time import, no
race, no fetch.

### Mandatory regeneration

`src/data/draft-slot-baseline.json` is a precomputed curve fitted to these
scores. Unrefitted, every over-slot number is wrong by roughly the 3.7-point
mean shift, in the same direction, for every pick. Same for
`default-rankings.json` and the lagged rankings.

```
pnpm run derive-baselines && pnpm run generate-rankings && pnpm run generate-lagged-rankings
```

All offline; no nflverse fetch required. The denominator change and the
regeneration must land in one commit, or over-slot is wrong in between.

## UI

### `PlayerDetailView` — showing what counts

> **Corrected during visual verification.** The design below assumed the
> credibility problem was _missing_ years. It is not. `update-data.ts` emits a
> season row for every elapsed year, so true gaps affect only **76 of 2059
> picks (3.7%)**, while **1127 (55%)** display rows that are shown but not
> counted — seasons played for another team. Darnold's 2021 Carolina row reads
> "75" and looks like part of a total it has no part in.
>
> Both are handled. Gap rows render as below, and — the load-bearing fix —
> uncounted rows are muted and marked `✕`, with the header note stating both
> halves of the division: `3 of 8 seasons counted · divided by a 5-season
rookie window`.

`PlayerDetailView` renders the season table (`:66`) beside the headline score
(`:54`). On Darnold that is three rows reading 94, 94, 92 above a headline of 56. Any user who does the arithmetic concludes the site is broken, reasoning
correctly from what is on screen.

The rookie window renders in full, unplayed years present as zero rows:

```
2018  13/16   99%   94
2019  13/16   99%   94
2020  12/16   99%   92
2021    —     not with team    0
2022    —     not with team    0
────────────────────────────────
Rookie window (R1): 5 seasons · 56
```

The arithmetic becomes self-evident, and the ghost rows are the argument the
metric is making. Mandatory, not cosmetic.

### `InfoView`

The current prose (`:109–112`) promises retention is "reported alongside it as
its own number… rather than being folded in." That sentence becomes false and is
rewritten, along with the formula block (`:205–211`):

```
window(pick)  = 5 if round 1 else 4        (rookie deal + option year)
tracked       = min( seasons elapsed since draft, window )
score(pick)   = sum( score(season) for retained seasons ) / max( retained, tracked )
retention     = retained_players / picks_in_range   (reported separately)
```

Retention does stay a separate number; what changes is that the score is no
longer duration-blind.

### Limitations, surfaced in the product

`InfoView` carries a "What this doesn't capture" block:

1. **Trade compensation is invisible.** Miami turned Minkah Fitzpatrick into a
   first-round pick; this scores it as a failed draft. Modelling it needs
   transaction data the project does not carry.
2. **Recent classes are scored leniently by construction.** The
   `min(elapsed, window)` guard means a 2024 pick has not had time to fail. This
   is honest — we do not know yet — but it tilts cross-class comparison.

`TeamRankingsView` carries a one-line footnote near the table linking into that
Info section. The ranking table is where the claim is made, so the caveat must
be reachable from it. A footnote, not a banner.

## Verification

The per-class leniency gradient is exactly the kind of age-correlated artifact
that can move a lagged correlation, so both figures the app reports were
measured before and after, over the fixed lagged windows (2018–2021 classes vs
2022–2025 win rate, 32 teams), using the real `buildCorrelation`:

|                       | score↔win  | overSlot↔win |
| --------------------- | ---------- | ------------ |
| before (mean played)  | +0.019     | +0.297       |
| after (rookie window) | **+0.217** | **+0.471**   |

**Both correlations strengthened, and that is a finding to be suspicious of,
not a validation.**

The age gradient is _not_ the cause: every class in the lagged window
(2018–2021) has a fully elapsed five-year window, so the leniency clamp never
binds there and all four classes are measured identically.

The real concern is circularity. The new denominator rewards _keeping_ a pick,
and keeping picks is partly an effect of winning rather than a cause of it —
winning teams re-sign their good players, losing teams churn rosters and fire
the staff who drafted them. Some of this +0.20 is therefore likely to be the
score absorbing an outcome it is supposed to predict.

This does not invalidate the change: the tenure signal was added because
duration is genuinely part of whether a draft worked, and that argument stands
on its own. But the correlation must not be presented as evidence the metric got
more predictive, and the project's existing commitment to reporting this figure
honestly applies with more force now that it points the flattering way.

## Testing

Tests first, per `AGENTS.local.md`.

| Case                             | Expectation                                  |
| -------------------------------- | -------------------------------------------- |
| R1, 3 retained, departed         | `sum / 5` — the Darnold case                 |
| R3, 4 retained, departed         | `sum / 4` — regression guard for late rounds |
| 2025 pick, still retained        | `sum / 1` — no penalty on young classes      |
| R1, 7 retained seasons           | `sum / 7`, not `sum / 5`                     |
| 0 retained seasons               | `0`, unchanged                               |
| `draftingTeamOnly: false`        | `sum / seasons.length`, unchanged            |
| departed mid-window              | full window, not elapsed                     |
| departed, viewed 2 vs 5 years on | same denominator — score does not drift      |
| still on roster, mid-window      | clamped to elapsed                           |

Plus `loadData.test.ts` for the `draftYear` stamp, `PlayerDetailView.test.tsx`
for ghost rows and the window label, `InfoView.test.tsx` for the formula block
and limitations copy.

## Sequence

1. `draftYear` on `DraftPick`, stamped in `loadData` — no behaviour change
2. `src/data/season-window.json` + `update-data.ts` writes it — no behaviour change
3. **Denominator change + tests + regeneration** — the only commit that moves numbers
4. `PlayerDetailView` ghost rows and window label
5. `InfoView` rewrite + "What this doesn't capture"
6. `TeamRankingsView` footnote
7. Correlation before/after, recorded above
8. `/visual-verify` — mandatory per `AGENTS.md`
