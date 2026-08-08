# Richer team narratives

Date: 2026-08-08
Status: accepted

## Problem

The team page generates two pieces of prose, each banding a single scalar:

- `coreStarterRateSummary` (`TeamDetailContent.tsx`) — three bands on the rolling
  core-starter rate, rendered in the side-rail Summary card.
- `teamStory` (`draftSuccessCorrelation.ts`) — three bands on the gap between a
  team's over-slot percentile and its win-rate percentile, rendered in the
  "Draft, then winning" card.

Both waste the data around them. `RollingDraftScore` also carries retention,
over slot and pick counts; the component already computes a per-year score
series; `CorrelationRow` carries playoff and Super Bowl counts.

Worse, the Summary bands are calibrated against a scale the data never reaches.
Measured across all 32 teams over the loaded 2018–2025 span:

| Signal                                     |   min |  p25 | median |   p75 |   max |
| ------------------------------------------ | ----: | ---: | -----: | ----: | ----: |
| core-starter rate                          |  0.14 | 0.18 |   0.22 |  0.25 |  0.35 |
| retention rate                             |  0.23 | 0.33 |   0.37 |  0.42 |  0.48 |
| over slot                                  | -1.64 | 0.93 |   2.74 |  5.54 | 11.98 |
| trend delta (last two classes vs. earlier) | -14.3 | -5.3 |   +2.8 | +10.0 | +28.1 |
| scored picks                               |    50 |   59 |     63 |    69 |    80 |

The top branch tests `coreStarterRate > 0.40`. No team reaches 0.35, so that
branch is unreachable. The middle branch tests `> 0.25`, which p75 only just
meets. Roughly three quarters of the league therefore reads "A lean stretch."

## Goal

Both cards get a multi-sentence, multi-signal read that cites real counts,
with thresholds cut from the league's actual distribution.

## Design

### Beat arc, not a decision tree

Each narrative is a fixed sequence of named beats. A beat is a pure function
returning one clause or `null`; the builder concatenates the non-null ones in
order. Null beats are omitted rather than replaced with filler, so a thin-data
team gets a shorter read instead of a padded one.

This keeps the clause count linear in the number of signals. A decision tree
over four signals would need 27–81 hand-written leaves.

### `src/lib/teamNarrative.ts` (new)

```ts
export interface TeamNarrativeInput {
  coreStarterCount: number;
  retainedCount: number;
  scoredPickCount: number;
  overSlot: number;
  scoreByYear: YearScore[];
}

export function buildTeamNarrative(input: TeamNarrativeInput): string[];
```

**Beat 1 · production** — core rate × retention rate. Names both counts against
`scoredPickCount`, then the relationship between them.

|                       | core >= 0.27                      | 0.20–0.27                           | < 0.20                                         |
| --------------------- | --------------------------------- | ----------------------------------- | ---------------------------------------------- |
| **retention >= 0.42** | hitting and holding               | modest hit rate, keeps who it finds | keeps its picks without many earning big roles |
| **0.33–0.42**         | starters at an above-average clip | steady, unspectacular               | few picks settle into starter snaps            |
| **retention < 0.33**  | finds starters, then lets them go | middling returns and heavy turnover | little sticks, on the field or the roster      |

**Beat 2 · capital** — over slot. Nearly every team is positive (p25 = +0.93),
so "beat their slot" on its own carries no information. Bands: `>= +5.5`
clearly outplaying draft position; `< +0.9` getting less than the slots
predicted, with negative values called out plainly; otherwise `null`.

**Beat 3 · trajectory** — mean of the two most recent scored classes minus the
mean of the earlier ones: `>= +5` rising, `<= -5` falling, otherwise `null`.
Requires at least three years with data; every team currently has eight, but the
guard keeps the function total for narrower spans.

### `teamStory` (changed)

Returns `string[]`.

- Beat 1: the existing +/-15 percentile-gap read, unchanged in wording.
- Beat 2 (new): `playoffApps / seasons`, with a Super Bowl clause appended when
  `sbApps > 0`. `null` when `seasons === 0`. The "less often than not" qualifier
  applies strictly below half, so an even split (2 of 4) never carries it.

The postseason beat states what happened. It never explains the record by the
draft: the league-wide draft-score-to-win-rate correlation in this dataset runs
negative, and the Methodology view says so.

### `RollingDraftScore` (changed)

Add `coreStarterCount` and `retainedCount`. Both are already tallied inside
`getRollingDraftScore` and discarded at the return. The narrative needs counts
("17 of 63"), and recomputing them in a second module would fork the definition
of a core starter.

### Rendering

Each card maps its `string[]` to one `<p>` per beat. `SummaryCard` renders no
prose when the array is empty, keeping its external depth-chart link. The inline
style object on the Summary paragraph moves to a CSS class next to
`.validation-card__take`, since it now applies to a repeated element.

### Ranks

No ordinal is printed in either card. The thresholds are cut from the league
distribution, so the adjectives carry the comparison implicitly. This is
deliberate: "one in four picks became a core starter" gives a reader no anchor
on its own.

## Testing

Test-first, per AGENTS.local.md.

- `teamNarrative.test.ts` — every band boundary from both sides; null cases;
  count formatting; composition order with beats omitted.
- A reachability guard asserting no band is stranded outside the observed
  league range. This is the exact defect the redesign fixes.
- `draftSuccessCorrelation.test.ts` — existing `teamStory` assertions carry over
  against the array; new postseason bands.
- `getRollingDraftScore.test.ts` — the two new count fields.
- `TeamDetailContent.test.tsx` — multi-paragraph rendering; empty-narrative
  Summary card keeps its link.

Visual verification via `/visual-verify` is mandatory: the paragraphs land in a
narrow side rail and beat 1 can run to roughly 25 words. The 2026-08-08 session
caught three copy defects the unit tests could not see — a repeated verb, an
awkward zero-playoff phrasing, and an even split described as "less often than
not". Prose bands need to be read on the page, not only asserted against.

## Out of scope

The rankings view, the draft-class view, and the Methodology narrative.
