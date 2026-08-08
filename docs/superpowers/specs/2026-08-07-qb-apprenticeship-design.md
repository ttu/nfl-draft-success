# QB Apprenticeship — Design

**Date:** 2026-08-07
**Status:** Approved, ready for implementation planning

## Problem

A quarterback drafted to sit behind an established veteran is scored as though
those bench years were failures. Jordan Love is the clean case:

```
2020 R1 Jordan Love  GB  /6  20:0  21:18 22:9  23:100 24:91 25:93  → 52
```

Green Bay spent a first-rounder, waited three years, and got a franchise
quarterback. The score reads 52 — the same band as Zach Wilson (45) and Mac
Jones (55), two picks nobody would defend. Roughly 43 points of the gap is the
apprenticeship itself: three near-zero seasons diluting the numerator, and a
retained-season count that pushed the divisor to 6.

The role badge is wrong for the same reason. `getPlayerAverageScoreWeight`
averages Love's discrete role weights to 2.17, which maps to **Contributor**.

Quarterback is the position where this matters, because it is the position
where exactly one player takes the snaps. At most other positions a rookie who
barely plays is a rookie the team misjudged. At quarterback, sitting is a normal
development path.

## The rule

A pick's **apprentice seasons** are the unbroken run of seasons, starting at the
draft year, satisfying all of:

- the pick's position is in `APPRENTICESHIP_POSITIONS` (currently `['QB']`)
- the season was played (not an upcoming-season row)
- the player was `retained` — on the drafting team's bench, not somebody else's
- `classifyRole` returns `non_contributor` or `depth`
- the years are consecutive from `draftYear` with no gap

The run counts **only if** a later played, retained season classifies as
`core_starter` or `starter_when_healthy`. Otherwise the count is zero and
nothing about the pick changes.

### Why each clause is there

**Retroactive vindication.** Love's first three seasons and Kyle Trask's first
three seasons are indistinguishable in the data — both are retained
quarterbacks taking no meaningful snaps. Only what came afterward separates
them. Sitting is therefore treated as neither good nor bad in itself: it is an
investment, and the score reflects whether it paid.

```
2021 R2 Kyle Trask  TB  /5  21:0  22:2  23:3  24:8  25:0  → 3, unchanged
```

**Leading run only.** A starter benched in year three for playing badly and
restored in year four must keep his punishment years. Forgiveness applies only
before the player has ever held the job.

**Retained only.** A quarterback who sat on someone else's bench was not the
drafting team's apprentice.

**Payoff must be with the drafting team.** This app scores what the drafting
team got, and correlates that with winning. Malik Willis breaking out in Green
Bay does nothing for Tennessee's 2022 third-rounder — Tennessee traded him and
took the loss.

**QB only.** Run position-agnostic against the 2018–2025 classes, the rule fires
on 115 picks and produces results like `Daniel Faalele BAL 70 → 100` and
`Luke Wattenberg DEN 58 → 91` — ordinary starters whose single quiet rookie year
gets erased. QB-gated it fires on three picks in eight classes.

### Known limitation

The rule cannot distinguish sitting-to-learn from sitting-injured. J.J. McCarthy
missed his rookie year with a knee injury and qualifies. This is accepted:
outcome is what the rule keys on, by design, and a lost rookie season followed
by winning the job is not obviously a different result from a planned redshirt.
It is recorded here so it is not mistaken for an oversight.

## Mechanics

### Module

New `src/lib/apprenticeship.ts`, one export:

```ts
/** Leading seasons a QB spent on the drafting team's bench before winning the job. */
export function apprenticeSeasonCount(pick: DraftPick): number;
```

Returns 0 for every pick that is not a vindicated quarterback. The position gate
is a module constant so widening it later is one line plus a data review.

### Season filtering

`getFilteredSeasons(pick, draftingTeamOnly)` in `getPlayerRole.ts` drops the
leading `n` apprentice seasons. It is the single choke point feeding
`getPlayerDraftScore`, `getPlayerAverageScoreWeight`, `getPlayerPeakRole`,
`getPlayerRole`, and `explainDraftScore`, so one edit corrects score, badge,
filters, draft-class bucket counts, and Core Starter % — in both the
drafting-team and career-mode toggle states.

Career mode is included deliberately. It has no window, so there the apprentice
seasons are simply absent from the plain mean. If sitting to learn was not a
failure, it was not a failure in either lens.

### Denominator

`scoredSeasonCount` in `rookieWindow.ts` changes in two places, with
`n = apprenticeSeasonCount(pick)`:

```
elapsed = LATEST_SEASON - (draftYear + n) + 1
window  = max(0, rookieWindow(round) - n)
```

The window start shifts to the first non-apprentice season, and its length
shortens by the same amount. The window models what the rookie contract
**entitled the team to**; sitting on the bench does not extend that entitlement.
Keeping the full five years would charge Love for 2026 and 2027, seasons his
rookie deal never covered.

`window` can reach 0 for a pick who sat out the whole deal, but such a pick is
never vindicated by definition, so `n` is 0. The existing
`max(retainedSeasonCount, tracked)` floor keeps the divisor safe regardless.

### Result

```
2020 R1 Jordan Love    GB  sat=3 win=2 denom=3  score 52→95  weight 2.17→4.00
2022 R5 Sam Howell    WAS  sat=1 win=3 denom=3  score 26→33  weight 2.00→4.00
2024 R1 J.J. McCarthy MIN  sat=1 win=4 denom=1  score 40→81  weight 2.00→4.00
```

Unchanged: Trask (3), Hendon Hooker (2), Jalen Hurts (87 — his rookie 49 is
above the bench bar, so the mean already absorbed it), and every non-QB.

Howell lands at Core Starter with a score of 33. That divergence is pre-existing
— the badge is a plain mean over counted seasons while the score divides by the
window — and apprenticeship only makes it more visible. Left alone: the two
numbers answer different questions ("what was he when he played" versus "what
did the team get"), and unifying them is a much larger change.

## Showing the math

Apprentice seasons must not silently vanish from the player page. They leave
both the season rows and the window years, so a 2020 first-rounder whose panel
begins at 2023 reads as a data bug.

`explainDraftScore.ts` gains a third row kind:

```ts
export type ScoreExplanationRow =
  | ({ kind: 'season' } & SeasonScoreExplanation)
  | ({ kind: 'gap' } & GapYearExplanation)
  | ({ kind: 'apprentice' } & SeasonScoreExplanation);
```

A separate kind rather than the existing `counted: false` flag, because the two
reasons differ: an uncounted season is one the drafting team did not get, an
apprentice season is one it got and chose not to use.

`DraftScoreExplanation` gains `apprenticeSeasons: number` so the panel can state
the shift where it states the denominator.

The career table renders apprentice rows muted, matching existing uncounted
rows, with a short note — "learning behind a veteran; not scored".

## Testing

Tests first, per `AGENTS.local.md`.

`apprenticeship.test.ts` — the rule in isolation:

- vindicated QB returns the run length
- QB who never reaches starter returns 0
- non-QB returns 0
- mid-career benching returns 0 (run must lead)
- QB traded during the bench years returns 0 (run must be retained)
- QB whose every season is an apprentice season returns 0
- a gap year inside the run ends the run

`getPlayerRole.test.ts` — regression pins on real shapes: Love → 95 / Core
Starter, Trask → 3 / Non-Contributor, Hurts → 87 unchanged, Faalele → 70
unchanged.

`rookieWindow.test.ts` — shortened window, including `n >= window`.

`explainDraftScore.test.ts` — apprentice rows appear, are excluded from `total`,
and the panel's arithmetic still reconciles with `getPlayerDraftScore`, the
invariant that file already pins.

## Documentation

- `docs/SPEC_CLARIFICATIONS.md` — new Apprenticeship section
- `docs/calculations.md` — the denominator change
- the in-app info modal

## Verification

`/visual-verify` is mandatory (`AGENTS.md`) — the career table gains a row type.
