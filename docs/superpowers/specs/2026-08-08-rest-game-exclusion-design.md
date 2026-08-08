# Rest-Game Exclusion Design

**Date:** 2026-08-08
**Status:** Approved, ready for implementation planning

## Problem

Teams that have locked their playoff seed rest starters in the final regular-season
game. The player was available; the coach chose to sit him. Today that decision
costs the player twice:

- **Availability** (`gamesPlayed / teamGames`, 30% of the season score) drops.
- **Load** still counts that game's full team snap capacity in its denominator.

Nothing in the current pipeline forgives it. `MIN_SEASON_ENDING_ABSENCE_GAMES = 2`
in `src/lib/seasonEndingAbsence.ts` deliberately refuses to read a one-game tail as
an injury — correctly, since a one-game gap is usually a rest day or a healthy
scratch. A rest game therefore falls through every excuse we have.

The same applies to a starter who takes one series and comes out: his average
per-game snap share is dragged down by a cameo that reflects the coach's decision,
not his role.

## Decisions

Three choices were settled during design, each with alternatives that were
considered and rejected.

### Detection: team-wide usage drop, gated on a playoff appearance

Inferred from snap data the pipeline already fetches, rather than from computed
clinch status.

Rejected: **playoff-appearance alone** (over-excuses — a playoff team that had to
win its finale rested nobody, and its benched or injured players would get a free
pass); **real clinch from `games.csv`** (most accurate, but requires reconstructing
standings, seeding, and NFL tiebreakers — disproportionate machinery for the gain).

The playoff gate is a guard on the usage signal, not a substitute for it. Without
it the rule also fires on a 3–13 team looking at young players in week 18, and on a
team that has simply lost half its roster to injury by then. The gate costs us
nothing for a team that clinched a bye and then lost in the wildcard round — it
still played a postseason game.

### Effect: erase the game entirely

A detected rest game is removed from `teamGames`, from the load denominator, from
the avg-snap average, and — for the player's own numerators — from his snaps and
games played. The season reads as a 16-game season for everyone on that roster.

Rejected: **excuse the absence but keep snaps played.** It breaks the invariant
that numerator and denominator describe the same set of games, pushing
`gamesPlayedShare` and `cumulativeSnapShare` above 1.0 and requiring clamps to
paper over a self-inflicted mismatch. It also scores a token one-series appearance
differently from a full rest, when both are the same coaching decision.

Rejected: **shrink the load denominator only** (mirroring the existing injury
adjustment). Smallest change, but a rested starter still loses availability points
— and unlike an injury, he was available.

### Placement: pipeline labels, engine drops

The pipeline stays lossless. Every stored field keeps its true full-season value;
the pipeline additionally records the rest game's slice. The engine subtracts it.

This matches how the app already works — `snapShareForRoleTier` re-applies the load
cap client-side rather than trusting the stored value — and it keeps the raw season
available for the score explanation.

### Accepted trade-off

Erasing the game is **team-wide**, so a backup who played 60 snaps _because_ the
starters sat loses that showcase game from his record. A per-player variant
(erase only for players whose usage dropped) was considered and set aside as
unnecessary complexity for the size of the effect.

## Data model

`Season` (`src/types.ts`) gains two optional fields, present only when they apply:

```ts
/**
 * The franchise's final regular-season game, when a clinched playoff team
 * rested through it. Present only for such seasons. Stored raw so the engine
 * can back it out; every other field on this Season still counts it.
 */
restGame?: {
  playerGames: number;      // 0 or 1 — did he log a snap
  playerShareSum: number;   // his per-game role share in it (0 if absent)
  playerSnaps: number;      // his snaps, for the load numerator
  teamSnaps: number;        // that game's team capacity, for the load denominator
};
/** Full-season team snap capacity behind `cumulativeSnapShare`. */
loadDenominator?: number;
```

`loadDenominator` is required because `cumulativeSnapShare` is a ratio whose
denominator is not otherwise stored — without it the fraction cannot be reopened.
It must be **the same denominator that produced the stored ratio**, i.e. already
injury-adjusted. Emitting a different denominator would reopen a different
fraction than the one being edited. It is independently useful to
`ScoreBreakdown`, which currently explains a load share it cannot decompose.

`snapShare` is an average and needs no companion field: its sum is recoverable as
`snapShare × gamesPlayed`.

## Detection rule

Per franchise, per season, over parsed `snap_counts_{season}.csv` rows:

```
regularWeeks = 18 for season >= 2021, else 17
madePlayoffs = franchise has any snap row in week > regularWeeks
finalWeek    = max week <= regularWeeks the franchise played

if !madePlayoffs -> no rest game
```

Then measure the drop, using the per-game share convention the pipeline already
uses (`max(offense_pct, defense_pct)`):

- **Regulars** = players on that franchise whose _median_ share across the team's
  other regular-season games clears a starter-ish bar (~0.5), with enough games to
  be meaningful.
- For each regular, `ratio = finalWeekShare / medianOtherShare`. An absent player
  scores 0.
- If the franchise has at least a minimum number of regulars and the **median**
  ratio across them falls below a threshold, `finalWeek` is a rest game for that
  franchise.

Median on both axes, so two stars on IR cannot fake a rest week and one stubborn
ironman cannot mask a real one.

Exclusion is keyed **`(game_id, team)`, never `game_id`** — the opponent played
that game for real, and its denominators and players are untouched.

### Constants

`REST_RATIO_THRESHOLD`, the starter bar, and the minimum regular count are
calibrated against real seasons during implementation rather than guessed here.
The spec fixes the shape; calibration is pinned by the named fixtures below.

**Calibration outcome (measured, 2019–2024).** Median ratios were computed for
all 82 playoff teams in that span. The distribution separates cleanly at **0.7**,
which is what `REST_GAME_RATIO_THRESHOLD` was set to — not the 0.5 this document
first assumed.

That assumption was wrong in an instructive way. The Ravens fixture below was
written expecting a rest week to show as a near-total collapse; Baltimore 2023
actually lands at **0.59**, because Jackson and six other regulars took no snap
while most of the roster played on. A partial rest is the _common_ shape, and a
bar tight enough to demand a clean sweep of the starting lineup would have missed
Baltimore 2023, Green Bay 2021 (Love for Rodgers, 0.61), Minnesota 2022 (Mullens
for Cousins, 0.53), the Rams 2023 (Stafford sat, 0.61) and Pittsburgh 2020
(Rudolph for Roethlisberger, 0.67).

The nearest team above the line is New Orleans 2019 at **0.77**, who played Brees
in a game that decided their seed — so the gap between the last true positive and
the first true negative is roughly 0.09, and 0.7 sits inside it. Clean negatives
cluster far higher (Detroit 2023 at 0.98, Buffalo 2023 at 1.00). The rule flags
23 of 82 playoff teams, every one historically verifiable.

## Engine subtraction

`withoutRestGame(season): Season` returns a season with the rest game removed:

```
gamesPlayed  -= restGame.playerGames
teamGames    -= 1
snapShare     = (snapShare·gamesPlayed - playerShareSum) / (gamesPlayed - playerGames)
cumulative    = (cumulative·loadDenominator - playerSnaps) / (loadDenominator - teamSnaps)
```

**Ordering:** this must run _before_ the `min(load, snapShare)` cap in
`rawSnapShareForRoleTier`. Rest moves both terms; capping first would compare an
adjusted load against an unadjusted average.

**Application point:** once, on ingest, so every consumer — role classification,
`getSeasonScore`, rolling score, cohort baselines, the correlation feature, and
the two baseline-derivation scripts — sees the adjusted season without each
having to remember. Threading it through `snapShareForRoleTier` instead would fix
scoring but silently miss availability in `getSeasonScore`, and miss the
derivation scripts entirely.

The ingest point is **`stampDraftYear` in `src/lib/draftClass.ts`**, not
`loadData.ts` as first planned: `loadData` is only the app's path into the data,
while `stampDraftYear` is the one function every path parsing draft JSON must
call — including the `scripts/` generators that read the files directly. Its own
docblock already states that rule, which is exactly the property this needs.

The `restGame` object rides along on the adjusted season so `ScoreBreakdown` can
say _"week 18 rested — excluded, 16 team games"_ rather than leaving an
unexplained 19.

## Modules

New: `src/lib/restGame.ts` (+ test), following the shape of
`seasonEndingAbsence.ts` — pure, no I/O. It exposes both halves: detection over
CSV rows (script-side) and `withoutRestGame` (engine-side).

Changed:

- `src/types.ts` — the two new optional fields.
- `scripts/update-data.ts` — run detection, emit the slice and `loadDenominator`.
- `src/lib/teamSeasonDenominator.ts` — surface the denominator it already computes;
  compute `excusedWeeks` over non-rest games.
- `src/lib/draftClass.ts` — `stampDraftYear` applies `withoutRestGame` on ingest.
- `src/components/views/player/ScoreBreakdown.tsx` — explain the excluded game.

## Edge cases

- **No double-excusing.** Excused injury weeks and the rest game must not both
  discount the same game. The existing code already takes
  `max(injuryReportWeeks, seasonEndingAbsenceGames)` rather than the sum for this
  reason; `excusedWeeks` is computed over non-rest games so the rest game is never
  inside that window.
- **Season-ending absence shifts by one.** A player whose last snap was week 16,
  with weeks 17–18 remaining and 18 a rest game, currently reads as a 2-game
  season-ending absence. He missed one real game — below
  `MIN_SEASON_ENDING_ABSENCE_GAMES`. Absence detection measures against the team's
  non-rest schedule.
- **Multi-team seasons.** Traded players take the games-played-ratio path with no
  injury adjustment. Emitting `loadDenominator` as the sum of that season's
  per-game team denominators makes the identical subtraction arithmetic work on
  both paths, so the engine needs no branch.
- **Divide by zero.** A player whose only appearance all year was the rest game
  leaves `gamesPlayed - playerGames = 0`. `snapShare` resolves to 0 and the season
  reads 0-for-16 rather than `NaN`.
- **Fail closed.** Sparse data, too few identifiable regulars, a franchise with no
  postseason rows, or an unplayed-season row (`teamGames === 0`) all yield no rest
  game.
- **In-progress seasons.** The playoff gate makes the rule inert until the
  postseason appears in the data, so a current season cannot be misread mid-flight.

## Testing

Per the project's TDD convention, tests precede implementation.

- `restGame.test.ts` — detection firing and refusing; subtraction arithmetic
  including the zero-games and multi-team cases.
- Calibration fixtures, encoding the measured shapes hermetically rather than
  fetching: the **2023 Ravens** shape (a third of the regulars sit, the rest play
  on) must be detected; the **2023 Lions** shape (a few regulars down, everyone
  else at their normal load) must not.
- Update existing suites for the new field: `draftClass`, `teamSeasonDenominator`,
  `explainDraftScore`, `ScoreBreakdown`.
- Visual verification for the `ScoreBreakdown` change, per `AGENTS.md`.

## Fallout

`position-baselines.json` and `draft-slot-baseline.json` are derived from these
same seasons, so they shift too — correctly, but it means a full `pnpm update-data`
regeneration and small movement in existing rankings.
