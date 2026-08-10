# Highlights: career shape and retention bands

**Date:** 2026-08-09
**Status:** Approved, ready for implementation planning

## Problem

The Highlights page ranks on exactly one axis. Steals and busts are both
`score − expectedScoreForPick(overallPick)` sorted in opposite directions, and
`mostCoreStarters` is a volume tally. Everything the page says is a variation on
_did this pick beat its draft slot_.

The data supports questions that axis cannot answer. Each `Season` carries
`gamesPlayed`, `teamGames`, `snapShare`, `cumulativeSnapShare`, `retained`,
`currentTeam`, `injuryReportWeeks` and `seasonEndingAbsenceGames`. From those,
two families of story are derivable today with no new fetching:

- **Career shape** — _when_ a pick arrived and how reliably he stayed. Over-slot
  flattens a day-one starter and a fourth-year breakout into the same number.
- **Retention** — `retained` and `currentTeam` are read by nothing on this page.
  They record which picks left and where they went, which is the one thing a
  draft tracker can say about a team's judgement after the pick was made.

There is also a fairness gap. `bustExclusions.json` is hand-maintained because
some players landed on the bust list when "bust" was the wrong word — the career
ended for a reason outside football. The nearer case, a genuinely good player who
kept getting hurt, has no home at all: he simply ranks as a bust.

## Decisions

### Two new bands, all lists shown

The page becomes three labelled bands — **Value** (steals, busts), **Career
shape** (day-one starters, late bloomers, iron men, snakebit), **Retention**
(the ones that got away, kept the band together) — above the existing
core-starters card.

Rejected: **a tight selection of three or four new lists** (scannable, but the
two themes each lose half their story and the leftovers become permanent
"future work"); **a single slot with a lens selector** (compact, but hides seven
of eight lists behind an interaction on a page whose entire purpose is browsing).

Each list stays collapsed at `HIGHLIGHT_LIST_SIZE` (3) with the existing
expand-to-`HIGHLIGHT_LIST_MAX` (20) control, so eight lists cost roughly twice
the current initial DOM, not eight times.

### Per-list eligibility floors, not one global gate

Each list sets the minimum career length its own metric needs.

Rejected: **the rookie-window maturity gate** (consistent with the rest of the
app, but it excludes recent classes wholesale — and a day-one starter is a
statement about the rookie year, which is exactly the data a recent class has);
**no gate with rate-normalised metrics** (more defensible statistically, but
"longest availability streak ÷ seasons" is not a headline anyone can read).

The floors are load-bearing, not decorative: without them, iron men is topped by
any rookie who dressed 17 times, and late bloomers by anyone with two seasons and
a good second one.

### Retention ignores `draftingTeamOnly`

`getLeagueHighlights` takes `GetPlayerRoleOptions` and threads it into scoring.
The retention band does not accept that option at all — its subject is precisely
the seasons the toggle removes.

Rejected: **passing the option through and letting it filter** (turns "what he
did after leaving" into the empty set whenever the toggle is on, i.e. the list
silently empties in one of two modes).

This is enforced by the signature rather than a comment:
`getRetentionHighlights(draftClasses, teams)` has nowhere to put an option.

### Accepted trade-off

Late bloomers reads raw `playedSeasons`, not `getFilteredSeasons`. That is a
deliberate divergence from every other consumer of season data, documented at
the call site and in the page footnote. See _Apprenticeship divergence_ below.

## Metric definitions

Shared conventions for both new bands:

- Seasons come from `playedSeasons(pick)`; unplayed rows (`teamGames === 0`)
  never contribute to a number.
- Rest games are already backed out at parse time by `draftClass.ts`, which maps
  `withoutRestGame` over every season, so a rested finale cannot read as a missed
  game or break an availability streak. (Note: `Season.restGame`'s doc comment in
  `src/types.ts` credits `loadData.ts` for this; the call actually lives in
  `draftClass.ts`. Worth correcting when this work lands.)
- A season the player missed entirely is a **played** season: `isPlayedSeason` is
  `teamGames > 0`, and a lost year has team games with zero player games. That is
  deliberate — see `seasonPlayed.ts` — and every metric below has to be read with
  it in mind.
- **Every list except day-one starters reads `activeCareerSeasons(pick)`, not
  `playedSeasons(pick)`.** The pipeline writes a row for every season in the
  window whether or not the player was on a roster, so a pick who left the league
  after his rookie year still carries a full row per remaining year. Those rows
  are not evidence of a career. `activeCareerSeasons` truncates at the last
  season with a snap while keeping an empty season _between_ two played ones —
  the mid-career lost year that the availability lists exist to see.

  This was found by running the finished lists against real data, not fixtures.
  Unbounded, snakebit ranked by how long ago a player washed out (Michael Bowie,
  one 10-game rookie season in 2013, led it with 221 "missed games" — thirteen
  seasons × 17), `keptTheBand` decided retention from a row describing nobody,
  and the post-exit means behind "got away" were diluted by zero-score years.

- "Role share" means `snapShareForRoleTier(season, pick.position)` —
  position-adjusted, so a lead back and a left tackle are comparable.
- Season role means
  `classifyRole(snapShareForRoleTier(s, pos), s.gamesPlayed / s.teamGames, s.gamesPlayed, pos)`.

### Career shape

| List             | Metric                                                          | Gates                                                                                                                           | Tie-breaks                                                                 | Display                       |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| Day-one starters | Role share in the season where `year === pick.draftYear`        | that season was played, and his second season (if he has played one) is still `core_starter`                                    | higher whole-career score, then later `overallPick`                        | `88% · rookie year`           |
| Late bloomers    | Peak **full-time** season role share − rookie-season role share | ≥ `MIN_BLOOM_SEASONS` (3) played seasons, a played rookie season, and ≥ `MIN_SUSTAINED_PEAK_SEASONS` (2) `core_starter` seasons | higher peak share, then more seasons held at peak                          | `2 yrs full-time · 12% → 88%` |
| Iron men         | Longest run of consecutive qualifying seasons                   | streak ≥ `MIN_IRON_MAN_STREAK` (3)                                                                                              | higher mean role share over the streak                                     | `5 straight · '21–'25`        |
| Snakebit         | `Σ (teamGames − gamesPlayed)` over **active-career** seasons    | ≥ 2 seasons, ≥ `MIN_SNAKEBIT_GAMES` (8) career games, full-time when active                                                     | shorter active career (same misses from fewer seasons is the sharper loss) | `91% when active · 38 missed` |

**Day-one starters** requires the job to have **held**. Jonathan Mingo took 90%
of the snaps as a rookie and 42% the year after: he won a starting job and lost
it, which is a different story from the one this list tells. His second season
must still classify `core_starter`.

A pick who has not played a second season yet is admitted — nothing has
contradicted him, and a day-one start is a claim about the rookie year, which is
exactly the data the newest class has. That is the same reasoning that rejected a
maturity gate above, so gating on two starting seasons instead would have
excluded 65 picks whose rookie year is all anyone has seen yet.

Ties are then broken by **whole-career score**: every active-career season's
`getSeasonScore` **summed**. Dozens of picks share a 100% rookie share, so the
tie-break carries almost all of the ordering, and the question it should answer
is who had the better career — where eight years of starting beats two. A mean
inverts that, ranking a two-year starter over a decade-long one. Pick number
settles only what the career total leaves level, still favouring the later pick.
The real-data list opens DeAndre Hopkins, Joel Bitonio, Keenan Allen.

**Late bloomers** requires a played rookie season because the metric is a rise
_from_ somewhere. A pick whose first season is his third year on the roster has
no baseline, and treating a missing rookie year as 0% would manufacture a rise
out of an absence.

It also requires the bloom to **last**: at least `MIN_SUSTAINED_PEAK_SEASONS`
(2) seasons classifying `core_starter`, and the peak share is taken from those
seasons only. Rising is half the claim — the list says he _became_ a starter, so
he has to have stayed one, and the high he rose to has to be a job he held
rather than a week he had.

Darrick Forrest is the case that forced this: 2% as a rookie, one real starting
season, a five-game run at 99%, then 10% and out of the league. Unbounded he read
as a +97 bloom, with the cameo setting the peak. Both halves of the rule are
needed — the sustained-seasons floor rejects the career, and sourcing the peak
from full-time seasons stops a partial season inflating anyone else's rise.
`core_starter` is the right tier to ask for because it already requires the
player to have been there for half the games.

Its rise **saturates**: a player who took no rookie snap and later started
full-time scores the maximum +100, and against real data the entire top 20 is
that shape. The list therefore ranks rise, then peak share, then the number of
seasons he _held_ the peak (share ≥ `CORE_TIER_THRESHOLD`), and prints that last
count in its detail line — otherwise every visible row reads identically and the
ordering looks arbitrary even though it is not. With the tie-breaks in place the
real-data list opens Travis Kelce (12 seasons full-time), then Patrick Mahomes
(8) — which is also the clearest possible vindication of the apprenticeship
divergence below.

**Iron men** — a season qualifies when it is both _available_ and _real_:

- available: `gamesPlayed / teamGames >= FULL_AVAILABILITY_GAMES_SHARE` (0.94,
  i.e. 16 of 17) **and** no `seasonEndingAbsenceGames >= MIN_SEASON_ENDING_ABSENCE_GAMES`;
- real: season role is `significant_contributor` or better.

Without the second condition the list is a ranking of core special-teamers, who
dress every week by job description. The streak must be over consecutive
_played_ seasons and consecutive _years_ — a gap year breaks it.

**Snakebit** — "full-time when active" reads the mean per-game `snapShare`
(position-normalised via `normalizeSnapShareForPosition`), **not**
`cumulativeSnapShare`. The distinction is the whole list: cumulative load already
divides by the full season, so a player who missed half of it can never clear the
bar no matter how completely he started the games he dressed for. The floor is
`CORE_TIER_THRESHOLD` (0.65).

That mean is taken over seasons **with snaps** (`gamesPlayed > 0`), while the
missed-games total is summed over **all** played seasons. Averaging the share
over all played seasons would defeat the list: a season lost entirely is a played
season carrying `snapShare === 0`, so the players with the most missed games —
the ones the list is for — would be the ones dragged below the full-time bar and
disqualified. The two halves of the metric legitimately read different season
sets: _how good was he when he played_ and _how much did he miss_.

The `MIN_SNAKEBIT_GAMES` floor keeps out a player whose career was two games and
an injury — a real tragedy, but not the "he was great when he played" claim this
list makes.

### Retention

Post-exit seasons are active-career seasons with `retained === false`. The
current-team label reads `currentTeam` from the newest season row that names one,
**including an unplayed row** — a roster snapshot is the most accurate answer to
_where is he now_ precisely because it is not a result. It is read for the label
only and never scored. When no row names a team the clause is dropped entirely
rather than printing a placeholder where a team should be.

**The ones that got away** — ranked by mean `getSeasonScore` over post-exit
seasons minus mean over retained seasons, credited to `pick.teamId`.

Gates:

- ≥1 played retained season — without one there is no baseline, and a player
  traded before he ever played did not get away, he was never there;
- ≥ `MIN_POST_EXIT_STARTER_SEASONS` (2) post-exit seasons classifying at
  `significant_contributor` or better.

The second gate does the work of two: it requires both that he played more than
once elsewhere (one good year is noise) and that those years were starter-grade
(a rise from awful to mediocre is not a loss). Stating it as one rule over
season roles avoids a separate season-count floor that it would subsume anyway,
and avoids inventing a score threshold with no basis in the role bands.

**What this list cannot see, and the page says so.** Every number in this app
counts snaps and games, never how well they were played. So "got away" finds
picks who could not get on the field for the drafting team and did somewhere
else — Jimmy Garoppolo (14 → 53) behind Brady, Zach Sieler (6 → 82) buried in
Baltimore. A player who started every week and started _badly_, then became a
star elsewhere, cannot appear: Sam Darnold reads 94 → 66, a decline, because he
was already playing. Marcus Mariota, Stefon Diggs and Amari Cooper fail the same
way.

Surfacing that archetype would need a performance signal the pipeline does not
fetch (grades or EPA), which is a second axis and a separate piece of work. The
honest interim is to state the limit in the page footnote rather than let the
list's name overclaim, which is what the footnote's closing paragraph does.

For scale: across 2013–2026, 3,091 picks have a career, 174 never played for the
drafting team, 2,375 lack two starter-grade seasons elsewhere, 255 show no rise,
and 287 qualify. In the default five-year window only 6 do — a recent pick has
too few post-exit seasons, not a gate that is too tight.

Ranking on the delta rather than raw post-exit score is the load-bearing choice.
Raw score fills the list with players who were already good when they were
traded, which is a transaction, not a mistake. The delta finds the failure the
list is named after: giving up on someone before he became what he became. The
post-exit floor stops a rise from awful to mediocre outranking a genuine loss.

Display: `ARI · 41 → 84 with MIN`.

**Kept the band together** — per team, the share of its _keepers_ whose last
season **with snaps** has `retained === true`, where a keeper is a pick for whom
at least half of his active-career seasons classify at `significant_contributor`
or better. Gate: ≥ `MIN_KEEPERS` (5). Top five teams shown, ranked by rate then
by keeper count.

Deliberately **not** `getPlayerRole`, which was the first implementation. That
averages role weight over every played season, so the dead rows after a career
ends drag a genuine two-year starter down to `contributor` and out of the keeper
pool entirely — the same defect as above, one level deeper. Correcting
`getPlayerRole` itself would change the score, the rankings and every other view;
it is app-wide behaviour and out of scope here. This list asks the question of
the seasons the player was actually around for instead.

Gating on keepers matters. A plain retention rate rewards a team for hanging onto
picks nobody else wanted and punishes one that cuts its own misses quickly, which
inverts the thing the list claims to measure.

A keeper who retired while still with the drafting team counts as kept, and that
is intended rather than tolerated: never letting him go is the purest form of
keeping him, and the data carries no "still in the league" flag that could
separate a retirement from an active tenure anyway.

Display: `PIT · 14 of 16 kept (88%)`.

### Apprenticeship divergence

`getFilteredSeasons` drops seasons before `firstScoredYear` so that a quarterback
who sat behind a veteran is not scored for the wait (`apprenticeship.ts`). Every
scoring path in the app routes through it.

Late bloomers deliberately does not. The wait is the metric: filtering those
seasons out erases the rookie-year baseline and with it every Jordan
Love-shaped career, which is the exact population the list exists to surface.
Rising after sitting is not a failure in either lens — it is the headline. This
must be stated in the page footnote, not only in code, so the page does not
appear to contradict the player view.

All other lists in both bands use `playedSeasons` directly as well (they measure
availability and usage, not score), except the two `getSeasonScore` means in "got
away", which are computed over explicitly selected season sets.

## Modules

- **`src/lib/careerShapeHighlights.ts`** — `getCareerShapeHighlights(draftClasses, teams, options)`
  returning `{ dayOneStarters, lateBloomers, ironMen, snakebit }`, plus
  `MIN_BLOOM_SEASONS`, `MIN_IRON_MAN_STREAK`, `MIN_SNAKEBIT_GAMES` and
  `FULL_AVAILABILITY_GAMES_SHARE` as named exports so tests assert against the
  constant rather than a literal.
- **`src/lib/retentionHighlights.ts`** — `getRetentionHighlights(draftClasses, teams)`
  returning `{ gotAway, keptTheBand }`, plus `MIN_POST_EXIT_STARTER_SEASONS` and
  `MIN_KEEPERS`. No options parameter, by design.
- **`src/lib/seasonTag.ts`** — the `'21`-style season label, lifted out of
  `HighlightsView.tsx` so the iron-man streak range can be formatted in the lib
  without a second copy (the repo runs `jscpd` in `pnpm validate`).
- **`src/lib/getLeagueHighlights.ts`** — keeps its three existing fields and its
  single pass, and composes the two new builders into `LeagueHighlights`. The
  extra passes over ~3k picks are negligible next to team rankings, which scores
  every pick once per team.
- **`src/lib/roleDisplay.ts`** — add `isAtLeastRole(candidate, floor)` beside the
  existing `isStrongerRole`, so the three "significant contributor or better"
  gates share one implementation.

`App.tsx:281` and its memo are untouched: the call signature and the
`LeagueHighlights` type name do not change.

## Types

```ts
/** A player row ranked by a list's own quantity. */
export interface RankedPlayer {
  pick: DraftPick;
  team: Team | undefined;
  draftYear: number;
  /** The quantity the list ranked on, so tests and ties read the number. */
  value: number;
  /** `value` rendered for the right-hand column, e.g. `+76`. */
  headline: string;
  /** Supporting context for the meta line, e.g. `12% → 88%`. */
  detail: string;
}

/** A team row in the retention ranking. */
export interface TeamRateHighlight {
  teamId: string;
  team: Team | undefined;
  kept: number;
  keepers: number;
  rate: number;
}
```

`PlayerHighlight` is unchanged. Steals and busts keep `score`/`overSlot` because
the footnote and the `formatOverSlot` treatment depend on the numbers, not on a
pre-formatted string. Collapsing all six lists onto one row type would force
`detail: string | number | undefined` and a per-list switch in the renderer;
formatting at the source keeps the view dumb.

`RankedPlayer` carries both `value` and `detail` so a test can assert that the
iron-man streak is 5 rather than that the row reads `5 straight · '21–'25`.
Formatted-only rows would pin every metric assertion to its display copy, and a
wording change would then break the metric tests.

Rejected: **a declarative list engine** (`{ id, label, eligible, rank, detail }`
records the UI maps over). Every list here has a different eligibility rule and a
different tie-break, so the abstraction leaks on the first list added after it.

## UI

- **`HighlightBand`** — new local component in `HighlightsView.tsx`: a band
  heading above the existing `.highlights-lists` grid.
- **`PlayerList`** — unchanged responsibilities (expand/collapse, empty state),
  gains an optional detail renderer so a row can print `5 straight · '21–'25`
  where a steal prints its over-slot.
- **`keptTheBand`** — reuses the `TeamLeader` visual language as a five-row list.
- **CSS** — `.highlights-lists` already collapses to one column at 900px; the
  band heading needs spacing rules only. Bands reuse the existing grid.
- **Footnote** — extended to cover the new axes and to state the apprenticeship
  divergence in late bloomers.

Band order: Value → Career shape → Retention → the existing core-starters card.

## Edge cases

- A rested finale must not break an iron-man streak, count as a missed game in
  snakebit, or alter a rookie-year share.
- A full-time special-teamer with 17 games and depth-level usage must not rank as
  an iron man.
- An apprentice QB must appear among late bloomers.
- A pick traded before ever playing must not appear in "got away" (no retained
  baseline).
- A player whose post-exit seasons are all depth must not appear in "got away"
  however large the rise.
- A team with 4 keepers must not appear in "kept the band together".
- An unplayed roster row supplies the current-team label and contributes to no
  score, streak, or games total.
- A season missed in full (played season, zero games, zero snaps) must count
  toward snakebit's missed-games total while staying out of its snap-share mean,
  must break an iron-man streak, and — when it is the rookie year — is a real
  late-bloomer baseline of 0%, not a missing one. A rookie who never took a snap
  and later started is the archetype the list exists for, and the top of that
  list should be expected to fill with maximal rises for exactly that reason.
  The gate is that the rookie season _row_ exists and was played, not that it
  contained snaps.
- A player who leaves the drafting team and later returns has non-contiguous
  post-exit seasons; "got away" reads them as a set, not a suffix, so both
  spells count toward the post-exit mean.
- A window narrow enough to contain few picks may place the same player on more
  than one list. This is acceptable and already true of steals/busts.
- Empty lists render the existing empty state rather than being hidden, so a
  narrow window does not silently reshape the page.

## Testing

TDD per `AGENTS.local.md`: tests first, then implementation.

- `src/lib/careerShapeHighlights.test.ts` — one case per gate and per tie-break,
  plus the rest-game, special-teamer, and apprentice-QB cases above. Two cases
  cover the fully-missed season specifically: it counts toward snakebit's missed
  games without entering its snap-share mean, and it serves as a 0% rookie
  baseline for late bloomers. Assertions read `value`, not `detail`. Fixtures
  build `DraftPick` objects directly, as the existing highlight tests do.
- `src/lib/retentionHighlights.test.ts` — the four "got away" gates, the keeper
  definition, the `MIN_KEEPERS` floor, the current-team label from an unplayed
  row, and a case asserting the builder takes no options.
- `src/lib/getLeagueHighlights.test.ts` — extended to assert composition only
  (the new fields are present and populated); the metric assertions live in the
  band modules.
- `src/lib/roleDisplay.test.ts` — `isAtLeastRole` boundary cases.
- `src/components/views/highlights/HighlightsView.test.tsx` — band headings
  render in order, each list renders its detail string, empty states render.

Visual verification via `/visual-verify` is mandatory after implementation
(AGENTS.md), at both desktop and the ≤900px single-column layout.

## Out of scope

- **Revisiting `bustExclusions.json`.** Once snakebit exists, some entries
  arguably belong on that list instead of being hidden from the page. That is a
  separate judgement call on a hand-maintained file.
- The remaining brainstormed themes: position factories, hardest position to
  hit, best/worst single draft class, most improved drafter, and draft-score vs
  win-total divergence.
- The player detail view, team view, sitemap, and any change to the score,
  role classification, or slot baseline. This design adds readings of existing
  data and changes no existing number.
