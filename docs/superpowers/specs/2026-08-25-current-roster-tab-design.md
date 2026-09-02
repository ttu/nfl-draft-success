# Current Roster Tab — Design

**Date:** 2026-08-25
**Status:** Approved, ready for implementation plan

## Problem

The site answers "how well did this team draft?" but never "who is on this
team right now, and how good have they been?" A team page shows draft classes
grouped by draft year, including players who have long since left, and says
nothing about draftees the team acquired from elsewhere.

## Scope

A new per-team **Current Roster** view listing every _tracked draftee_
(drafted 2013–2026) on the team's current roster, grouped by position group,
each with his career average draft score.

**Explicitly out of scope:** undrafted players and players drafted before 2013. They are not in the shipped data and reaching them would mean a new
snap-count aggregation for non-draftees. The page states this limitation
openly rather than presenting a partial list as a full 53-man roster.

Today's data yields 1,466 tracked players league-wide, 44–69 per team.

## Deriving the roster

New pure module `src/lib/currentRoster.ts`. No data-pipeline change — every
field needed is already in `public/data/draft-{year}.json`.

### `getCurrentTeamForPick(pick): string | undefined`

1. If the pick has a season row for the upcoming season (`latestDraftYear`,
   currently 2026): return `row.retained ? pick.teamId : row.currentTeam`.
2. Else if the pick has no season rows at all and belongs to the latest draft
   class: return `pick.teamId` — a rookie awaiting data, assumed on his
   drafting team.
3. Else: `undefined` — not on any current roster.

**Why only the upcoming-season row counts.** `scripts/update-data.ts` emits
the synthetic upcoming-season row (`teamGames: 0`) for every player who is on
some roster, so its presence _is_ the roster signal. 169 picks have a 2025 row
as their newest — they played last season but are on nobody's 2026 roster
(DeAndre Hopkins, Zach Ertz, Darius Slay). A naive "latest season row" rule
would wrongly park them on a team. 84 more carry a 2026 row with no team,
which explicitly marks a player as out of the league.

### `getCurrentRoster(draftClasses, teamId): RosterEntry[]`

Every pick across all loaded classes whose current team is `teamId`, as:

```ts
interface RosterEntry {
  pick: DraftPick;
  draftYear: number;
  /** Career average score across every played season, any team. Undefined when nothing played yet. */
  score: number | undefined;
  role: Role | undefined;
  seasonsPlayed: number;
  /** True when the player was drafted by a different team. */
  acquired: boolean;
}
```

`score` is `getPlayerDraftScore(pick)` with no `draftingTeamOnly` option — the
whole career, regardless of team. The question the page answers is "how good
has this player been", not "what has he given us".

## Route and navigation

- New route `/roster/:teamId`, `ActiveView.Roster`, `MastheadTab 'roster'`.
- The Roster tab appears only in a team context, like the existing Team tab.
  When a team context exists, **both** tabs render so the user can toggle
  between the draft view and the roster view. This generalises the current
  Masthead rule (`Team` renders only when it is itself active) to "a team is
  open", i.e. the active tab is `team` or `roster`.
- First entry point: a "Current roster" link in the team detail header.
- The view **ignores the `from`/`to` year range**. A current roster is a fact,
  not a window, so the route loads all classes 2013–2026 and the Subbar year
  controls are hidden. Cost: the full ~2.8 MB load even when the user's range
  was narrower.

## Page layout

**Header**, in the existing team visual language (crest, team colors, name):
tracked-roster count, mean roster score across scored players, and an explicit
line that the page covers drafted players 2013–2026 only — not the full 53.

**Groups**, ordered offense → defense → special teams:

| Group | Position codes          |
| ----- | ----------------------- |
| QB    | QB                      |
| RB    | RB, FB                  |
| WR    | WR                      |
| TE    | TE                      |
| OL    | OT, G, OG, C, OL, IOL   |
| DL    | DE, DT, NT, DL          |
| LB    | LB, ILB, MLB, OLB, EDGE |
| DB    | CB, S, FS, SS, DB, NB   |
| ST    | K, P, LS                |

This needs a new `src/lib/positionGroup.ts`; the existing `positionUnit.ts`
only resolves the three sides of the ball. Codes normalize through
`normalizeDraftPosition` first. An unknown code lands in an `OTHER` group
labelled "Other", ordered last — `OL` and `DL` are real generic codes in the
feed, so folding unknowns into them would misreport them as linemen.

Each group heading carries its player count and group mean score. Rows sort by
average score descending, with unscored rookies last.

**Row:** headshot, player name linking to `/player/:playerId`, position,
draft origin (year and round/pick, plus an "acquired" marker when
`pick.teamId !== teamId`), seasons played, role badge, average score.

## Edge cases

- **Rookie, no played seasons** — shows "Awaiting data"; excluded from every
  mean.
- **Empty position group** — omitted entirely.
- **Unknown `teamId`** — redirect to `/`, matching the existing routes.
- **Practice squad** — nflverse roster data does not separate it from the
  active 53, so the page draws no distinction.
- **Relocated franchises** — handled by the existing `nflverseFranchise` and
  `teams` normalization.
- **SEO** — the new route needs a prerendered page per team in `scripts/seo`,
  the same as `/position/:position` and `/:teamId`.

## Testing

TDD throughout.

- **Unit** — `currentRoster.ts`: retained player, departed player with
  `currentTeam`, out-of-league (2026 row with no team), stale latest-row-2025
  player excluded, rookie with no seasons included on his drafting team,
  career average spanning two teams. `positionGroup.ts`: every code in the
  table above, alias normalization, unknown code to the `OTHER` group.
- **Component** — `RosterView`: groups render in order, rows sort by score
  with unscored last, empty groups omitted, player links resolve, awaiting-
  data state, header means exclude unscored players.
- **E2E** — deep link to `/roster/:teamId`, toggle between Team and Roster
  tabs.
- **Visual** — the mandatory `/visual-verify` loop before the work is done.
