# Undrafted Free Agent Tracking — Design

Date: 2026-09-07
Status: approved, not yet implemented

## Problem

The site scores a team's draft picks and nothing else. Teams also add players
who were never drafted, and some of those players become starters. A team that
turned undrafted rookies into contributors is doing something the site cannot
currently see.

The draft score answers "how much did your picks play, relative to where they
were taken". There is no draft slot for an undrafted player, so the same
question needs a different expectation anchor — but the rest of the machinery
(per-season load, role tiering, injury forgiveness, retention) applies
unchanged.

## Scope

**In:** undrafted players, grouped into the draft class of the year they first
appeared, scored on the existing 0–100 scale against an empirical
undrafted-cohort expectation, surfaced beside the draft numbers on the team
detail and draft-year views.

**Out (deliberately):** veteran free-agent signings, trades, and any other
acquisition channel. Also out: folding free agents into the rolling draft
score, team rankings, roster rankings, highlights, the draft-score↔win-rate
correlation, or the precomputed default/lagged rankings. Those stay picks-only.

> **Implementation note (post-ship):** condition (2) below shipped differently
> than this spec proposed. `rookie_season` still gates cohort membership — it
> is what marks a player a first-timer rather than a veteran whose earliest
> tracked snap happens to fall inside the data window — but it does **not**
> decide which class year a player lands in. That turned out to contradict the
> owning-team rule (below): a player whose `rookie_season` was 2023 but whose
> first logged snap came in 2025 would, under this spec, be classed 2023 and
> credited to his 2025 team, opening his three-season scoring window on two
> seasons that team never had him for. The shipped rule instead classes a free
> agent by the season he **debuted** — his first logged snap — so the window
> always opens on a season somebody actually played him, exactly as a draft
> year and drafting team do for a pick. See `src/lib/freeAgentCohort.ts` and
> `src/lib/firstSnapTeam.ts`, and `docs/SPEC_CLARIFICATIONS.md`'s "Undrafted
> Free Agents" section for the documentation that matches what shipped. A spec
> that silently disagreed with the code would be worse than no spec, so this
> note stays rather than being edited away.

## Decisions

### Cohort membership

A player is **eligible** for the free-agent cohort when all three hold:

1. `players.csv` has no `draft_year`/`draft_pick` for him (undrafted), and
2. `players.csv` `rookie_season >= 2013`, and
3. he took at least one snap in `snap_counts` in some season.

`rookie_season` is authoritative for (2) rather than a first-snap heuristic, so
a veteran whose earliest snap happens to fall inside the data window is not
mislabeled a first-timer. As shipped, eligibility is deliberately separate from
which class year `Y` an eligible player is grouped into — see the
implementation note above.

The snap requirement in (3) mirrors the existing "scored picks = at least one
played season" rule. It cuts the cohort from ~411 to ~104 players per season
(2023 figures) and keeps the cohort mean a number about football rather than
about training-camp roster churn.

**Known limitation:** a team that signs thirty undrafted rookies and hits on
one scores the same as a team that signed one and hit. The metric measures the
quality of what a team developed, not the efficiency of how it got there.

### Owning team

`teamId` is the franchise of the player's **first snap**, normalized through
`normalizeNflverseTeam`. That team plays the role the drafting team plays
for a pick: it is who the score is credited to, and retention means still being
on it.

### Class floor

2013, matching `FIRST_DRAFT_YEAR`. Scoring a class needs snap counts from its
first season onward, and nflverse starts at 2012.

### Scoring window

Three seasons. An undrafted rookie contract is three years, not four. Scoring
free agents over four would charge them a season they were never owed — the
same reasoning that gave rounds 2–7 a four-year window instead of five.

### Expectation baseline

The mean score the undrafted cohort actually earns, derived from the data and
stored as a scalar. `faOverSlot = score − faBaseline`.

A single scalar, not a per-position curve: the position baselines already
normalize load before scoring, and there is no slot dimension here for a curve
to vary along.

**Consequence to state in the UI:** the baseline is centered on zero by
construction, so free-agent over-slot ranks teams against each other and can
never say the league as a whole is good or bad at signing undrafted players. It
is in the same units as draft over-slot, so the two read sensibly side by side.

### Relationship to the draft score

Separate, side by side. The rolling draft score, its over-slot, and every
ranking derived from them keep their current definitions and values exactly.
Free agents get their own score, over-slot, core-starter % and retention %,
displayed next to — never merged into — the draft figures.

## Data

New per-year file `public/data/fa-{year}.json`:

```ts
interface FreeAgentClass {
  year: number;
  freeAgents: FreeAgent[];
}
```

`FreeAgent` is `DraftPick` without `round` and `overallPick`. `Season[]` is
reused verbatim, so every season-level library — load, role tiering, injury
forgiveness, reserve weeks, rest games — applies with no change.

A separate file rather than a new array inside `draft-{year}.json`: today's
payload and its load path stay untouched, and free-agent data is fetched only
when a view that shows it is opened.

`scripts/update-data.ts` gains one pass. The snap, injury and roster fetches it
needs are already in memory per season, so the marginal cost is CPU, not new
downloads.

## Libraries

- `type Acquisition = DraftPick | FreeAgent`, discriminated structurally on the
  presence of `round`. No `kind` field, so no data migration.
- `getPlayerDraftScore`, `getPlayerRole` and the season-filter helpers widen
  from `DraftPick` to `Acquisition`. `DraftPick` already satisfies the wider
  type, so existing call sites are unchanged and the per-pick `WeakMap` memo
  keys widen harmlessly.
- New `acquisitionWindow(a: Acquisition): number` — `rookieWindow(a.round)` for
  picks, `FA_WINDOW = 3` for free agents. `rookieWindow` stays round-only
  rather than learning about a round that does not exist.
- The QB apprenticeship rule applies to free agents unchanged: an undrafted
  quarterback who sits two years and then wins the job is scored the way a
  drafted one is.
- New `scripts/derive-fa-baseline.ts` writes `src/data/fa-baseline.json`
  holding the cohort mean, the sample size, and the year span it was fit on
  (the latter two for the Info modal).
- Team-level free-agent aggregates reuse `getRollingDraftScore`'s shape through
  a generalized internal, so the draft and free-agent panels cannot drift apart
  in definition.

## UI

Three surfaces, no new route.

**Team detail** — an "Undrafted free agents" section below the draft-class
grid, with a two-stat header (FA score, FA over slot) and the same player-row
component the class grid uses, sorted by score. The rolling-draft-score header
above it does not change.

**Draft-year view** — a free-agent block after the "rounds 2–7" list, kicker
"undrafted", with the year's free-agent count and score added to the summary
strip as separately labeled stats.

**Player detail** — works once `Acquisition` widens. Round/slot copy and the
over-slot explanation branch to free-agent wording, and `ScoreBreakdown` gains
a free-agent case showing the three-season window and the cohort expectation.

**Info modal** — a short paragraph covering the definition, the snap
requirement, the three-season window, and why the baseline is centered on zero.

## Testing

Test-driven throughout.

- Unit: `acquisitionWindow`; the free-agent baseline derivation; the team-level
  free-agent aggregates; the pipeline's cohort selector against a fixture CSV
  covering an undrafted rookie who played, one who never took a snap, a drafted
  player, and a veteran whose `rookie_season` predates the window.
- Integration: the three views above, including the empty case (a team with no
  scored free agents in the selected span).
- Then `/visual-verify`.

## Documentation

`docs/SPEC_CLARIFICATIONS.md` gains a free-agent section; `docs/calculations.md`
documents the baseline derivation. Both commit with the implementation.
