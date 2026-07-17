# League Context Strip & Highlights Tab — Design

**Date:** 2026-07-16
**Status:** Approved for planning

## Summary

Add two independent, purely-derived features to the rankings landing page and
navigation:

1. **League context strip** (rankings page) — frames every team score against a
   league-wide baseline: league average score, score spread, and a 3-bucket
   role-distribution bar showing where all drafted picks in the window ended up.
2. **Highlights tab** (new top-nav tab + `/highlights` route) — three
   human-interest cards: Steal of the window, Biggest bust, and Most core
   starters produced.

Both features are pure aggregations over the already-loaded `draftClasses` and
`TEAMS`, and both respect the currently-selected year window (`from`/`to` search
params), exactly like the rest of the rankings page. They ship as two separate
commits.

## Goals

- Give a naked team score (e.g. "72.4") an instant frame of reference.
- Answer "where do drafted picks actually end up?" in one glance.
- Add a shareable, name-driven entry point (Steal / Bust) that draws people in.
- Keep all league math in tested pure functions; keep views presentational.

## Non-goals

- No new data fields, data-script changes, or backend.
- No changes to the existing per-team ranking table columns.
- No median/6-role variants (explicitly deferred — see Decisions).

## Decisions (resolved during brainstorming)

| Decision                       | Choice                                             |
| ------------------------------ | -------------------------------------------------- |
| Highlights placement           | Own top-nav tab + `/highlights` route              |
| Central-tendency baseline      | Average only (no median)                           |
| Role-distribution bar segments | 3 buckets: Core / Contributor / Non-contributor    |
| Steal definition               | Highest player score among picks with `round >= 4` |
| Bust definition                | Lowest player score among picks with `round === 1` |
| Window scope                   | Both features respect the selected year window     |
| Architecture                   | Two focused pure lib functions; views render only  |

## Architecture

All logic lives in `src/lib/` as pure, unit-tested functions, matching the
existing pattern (`getTeamRankSummary`, `getDraftClassMetrics`,
`getRollingDraftScore`). Views consume the results and render.

Consistency guarantee: `getLeagueContext` computes average and spread from the
same `getRollingDraftScore` used to build the on-screen `rankings` list, so the
displayed baseline always matches the table by construction.

---

## Commit 1 — League context strip

### Lib: `src/lib/getLeagueContext.ts`

```ts
export interface LeagueRoleDistribution {
  /** core_starter + starter_when_healthy */
  coreCount: number;
  /** significant_contributor + contributor + depth */
  contributorCount: number;
  /** non_contributor */
  nonContributorCount: number;
  /** Total scored picks (sum of the three buckets). */
  total: number;
  /** Each bucket as a share of total (0-1); all zero when total === 0. */
  corePct: number;
  contributorPct: number;
  nonContributorPct: number;
}

export interface LeagueSpread {
  topId: string;
  topScore: number;
  bottomId: string;
  bottomScore: number;
  /** topScore - bottomScore (>= 0). */
  gap: number;
}

export interface LeagueContext {
  /** Mean rolling score across teams with at least one scored pick. */
  avgScore: number;
  /** Null when fewer than 2 teams have scored picks. */
  spread: LeagueSpread | null;
  roleDistribution: LeagueRoleDistribution;
}

export function getLeagueContext(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetRollingDraftScoreOptions,
): LeagueContext;
```

Computation:

- **avgScore** — for each team compute `getRollingDraftScore(...).score`; average
  over teams whose `scoredPickCount > 0`. `0` when no team has scored picks.
- **spread** — among the same scored teams, the max and min scoring teams and
  their gap. `null` when fewer than two scored teams exist.
- **roleDistribution** — for every team × every loaded draft year, call
  `getDraftClassMetrics(draft, teamId, options)` and sum the role buckets into
  the three groups. Percentages are each bucket / total; all zero when total is
  zero. (Picks awaiting data are excluded because they contribute no role
  counts, consistent with `getDraftClassMetrics`.)

### UI: league context band in `TeamRankingsView`

Rendered between the existing `page-hero` and the `divider-em`/table.

- Two `StatBlock`s (reuse existing component):
  - **League average** — value `avgScore.toFixed(1)`, sub `draft success score`.
  - **Score spread** — value `gap.toFixed(1)`, sub `{topId} → {bottomId}`; when
    `spread` is `null`, value `—`.
- A full-width **3-segment stacked bar** below the stat blocks:
  - Segments Core / Contributor / Non-contributor, widths from the pct fields.
  - Colors drawn from the existing role palette (reuse role color tokens).
  - Inline legend: `Core 18% · Contributor 44% · Non-contributor 38%`.
  - Caption: "Where every drafted pick in this window ended up."
  - When `total === 0`, render an empty/neutral bar with a "no scored picks yet"
    caption.
- Recomputes automatically when the year window changes (already reactive via
  props; the parent passes fresh `draftClasses`).

Styling follows existing CSS-module / class conventions used by the rankings
view. The stacked bar is a small new presentational primitive (may live in
`design/Primitives` alongside `Sparkline`, or as a local component — decided at
implementation time based on reuse).

---

## Commit 2 — Highlights tab

### Navigation & routing

- `MastheadTab` gains `'highlights'`.
- Masthead tabs array gains `{ id: 'highlights', label: 'Highlights', onClick: goHighlights }`,
  always visible (unlike the conditional Team tab). `goHighlights` navigates to
  `{ pathname: '/highlights', search }`, preserving the effective `?from&to`.
- `ActiveView` gains a `Highlights` member.
- `determineActiveView` in `viewRouter.ts` gains a Highlights branch, driven by a
  new `isHighlightsView` signal (route match on `/highlights`). Precedence:
  place it alongside the other explicit routes (year/position) and above the
  team-detail/rankings fallback; exact ordering settled in the plan with a
  `viewRouter` test.
- App wires the `/highlights` route to render `HighlightsView`.

### Lib: `src/lib/getLeagueHighlights.ts`

```ts
export interface PlayerHighlight {
  pick: DraftPick;
  team: Team | undefined;
  /** 0-100 player draft score. */
  score: number;
}

export interface TeamHighlight {
  team: Team | undefined;
  teamId: string;
  count: number;
}

export interface LeagueHighlights {
  steal: PlayerHighlight | null;
  bust: PlayerHighlight | null;
  mostCoreStarters: TeamHighlight | null;
}

export function getLeagueHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
  options?: GetRollingDraftScoreOptions,
): LeagueHighlights;
```

Only picks with season data (`pickHasSeasonSnapData`) are eligible.

- **steal** — highest `getPlayerDraftScore` among eligible picks with
  `round >= 4`. Tie-break: later round, then higher `overallPick` (a later pick
  is the bigger steal). `null` when no eligible R4+ pick exists.
- **bust** — lowest `getPlayerDraftScore` among eligible picks with
  `round === 1`. Tie-break: lower `overallPick` (an earlier pick is the bigger
  bust). `null` when no eligible R1 pick exists.
- **mostCoreStarters** — for each team, count eligible picks whose
  `getPlayerRole(...) === 'core_starter'`; pick the max. Tie-break: higher core
  rate (count / scored picks). `null` when no team has any core starter.

### View: `HighlightsView`

Three cards in a responsive row/grid:

- **Steal** and **Bust** — player cards: headshot (`headshotUrl`, initials
  fallback on missing/failed image), player name, position, round + overall pick,
  team logo, the 0-100 score, draft year.
- **Most core starters** — team card: team logo, count, label "core starters
  produced".
- Each card renders a per-card empty state when its highlight is `null`.

Reuses existing primitives (`TeamLogo`, score styling) and view/hero layout
conventions.

### Edge cases

- Empty or awaiting-data-only window → all highlights `null` → per-card empty
  states; `roleDistribution.total === 0` → neutral bar.
- Single team loaded → `spread` is `null` → spread stat shows `—`.
- Missing `headshotUrl` or image load failure → initials avatar.

---

## Testing

TDD — tests first, per project convention.

**Unit (lib):**

- `getLeagueContext`: empty classes; single scored team (spread null); multiple
  teams (avg, spread, gap); awaiting-data picks excluded from role counts;
  window filtering; all-zero role distribution.
- `getLeagueHighlights`: empty classes; no eligible R4+/R1 picks (nulls); steal
  and bust tie-breaks; most-core-starters tie-break by rate; window filtering.

**Component (RTL):**

- League context band: renders average, spread (and `—` fallback), 3-segment bar
  widths/legend, empty state.
- `HighlightsView`: three populated cards; per-card empty states; headshot
  initials fallback.

**Visual:** run `/visual-verify` (mandatory project loop) after each commit's UI
lands; fix every issue found (zero tolerance).

## Rollout

- Commit 1: `feat: add league context strip to rankings page`
- Commit 2: `feat: add highlights tab (steal, bust, most core starters)`

Conventional commits; never `--no-verify`.
