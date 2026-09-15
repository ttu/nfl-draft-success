# TODO

Known work we have chosen not to do yet. Each item says what is wrong, why it was
deferred, and what to watch out for when picking it up — enough that whoever takes it
does not have to rediscover the reasoning.

Items are grouped by the risk of getting them wrong, not by size.

---

## Changes that move shipped numbers

These alter values the site already displays, so each needs its own branch and its own
before/after evidence. None of them can ride along with unrelated work.

### Trailing out-of-league season rows are intentional (settled)

**What.** When a player leaves the NFL, `scripts/update-data.ts` keeps emitting a season
row for every remaining year through the newest played season — `gamesPlayed: 0`,
`retained: false`, and no `currentTeam`. Because those rows carry a real `teamGames`
value, `isPlayedSeason` counts them as football that happened, and career-mode scoring
(`getPlayerDraftScore` with no `draftingTeamOnly`) divides by all of them.

Measured on Johnny Adams (`AdamJo02`, `public/data/fa-2013.json`), whose career ended
after an injury in his debut year:

|                                     | season rows | career score | drafting-team score |
| ----------------------------------- | ----------- | ------------ | ------------------- |
| As shipped                          | 13          | **0.58**     | 2.50                |
| Trailing rows trimmed to the newest | 2           | **3.75**     | 2.50                |

The drafting-team number is unaffected — that path filters to retained seasons and
divides by the contract window — so only career mode is distorted.

**Decision (2026-09-15): keep them. Career mode divides across every season since the
player entered the league, and this is shipped behavior already.** The expectation window
does not close when a career does: an acquisition is expected to return value through the
newest played season, so the years he spent out of the league count as zeros against him.
A player who washed out after one season _is_ a worse outcome than one who produced for
five, and the mean has to say so. No scoring change is wanted; the table above records
what the alternative would have cost, not a defect.

The mechanism is correct as written: a trailing row scores exactly 0 in `getSeasonScore`
(`snapShare` 0, `gamesPlayed / teamGames` 0) and adds 1 to the `seasons.length`
denominator in `getPlayerAverageScoreWeight` / `getPlayerDraftScore`. `buildCareerSeasons`
emits the rows `startSeason → maxSeason` unconditionally, so picks and free agents are
treated identically.

Two notes for anyone who reopens this:

- `teamGames` on an out-of-league row is arbitrary — `resolveTeamGamesDenominator` finds
  no primary or injury team and falls back to the drafting team's game count, or to the
  league's deepest playoff run for a free agent with no drafting team (hence `19` in
  `fa-2013.json`). It is **score-neutral**, because `gamesPlayed` is 0 either way; it
  matters only as the `isPlayedSeason` gate. Do not "fix" it expecting numbers to move.
- Zero games does not imply out of the league. Alex Lewis' 2017 and 2021 are real NFL
  seasons spent on injured reserve (`reserveWeeks` 16 and 17) and must keep counting. Any
  future trim has to key on league absence, not on `gamesPlayed === 0`.

**The trap the trim had to clear.** `isDeparted` (`src/lib/playerJourney.ts`) reads only
the latest row of any kind, and Adams' last _played_ season is 2013 with `retained: true`
— so a trim that simply dropped his trailing rows would have made the site claim he is
still on Buffalo. Rebuilding them at parse time sidesteps it entirely: `isDeparted` sees
the same last row it always did. Anything that later moves the rebuild _later_ than the
parse boundary reopens this.

**Payload: done (2026-09-15).** The rows are no longer _stored_, only counted. 15,482 of
41,321 season rows were pure function of franchise and year, so `update-data.ts` stops
writing them and `src/lib/trailingSeasons.ts` rebuilds them in `stampDraftYear` /
`stampFreeAgentYear` from `src/data/team-games.json` (8 KB). `public/data` went 11.65 MB →
8.71 MB, with the round trip verified exact over every shipped player and the derived
baselines and rankings regenerating byte-identical. No displayed number moved.

### The free-agent expectation is a survivors' average; a pick's is not

`src/data/fa-baseline.json` is fit over undrafted players who took at least one snap,
while the draft-slot curve includes drafted players who never played (they carry season
rows scoring ~0). The two residuals therefore share units without being a like-for-like
bar, and the UI says so in the Info modal and the player glossary rather than pretending
otherwise.

Deferred because fixing it means choosing a different cohort rule — which is a product
decision, not a code change. If it is ever revisited, note that including undrafted
players who never took a snap would multiply the cohort roughly fourfold (~411 per season
on rosters versus ~104 who play) and change every free-agent over-slot on the site.

---

## Correctness gaps

The first is live and user-visible; the rest are latent.

### The player page spins forever instead of saying "not found"

**What.** `renderPlayerView` (`src/App.tsx`) shows `LoadingSpinner` whenever
`playerInfo` is null, and `usePlayerLookup` returns null for two different
situations: still searching, and searched everywhere without finding him. A
mistyped or stale `/player/:id` therefore renders "Loading player…" for as long
as the tab stays open.

**Why it matters more than it looks.** This is what made the `AutrDe00` bug
opaque. The real fault there was a data-loading one, but the symptom was an
eternal spinner, which reads as "slow" rather than "broken" — so it hid its own
cause. Any future lookup failure will hide the same way.

**Design, already worked out.** `usePlayerLookup` returns a third value,
`playerSearchState: 'searching' | 'exhausted' | 'failed'`, tracking both
all-years fetches to _settlement_ rather than to success — today each
`.catch(() => {})` swallows the failure and leaves the result identical to one
still in flight.

Three states, because two would lie:

- `searching` → the spinner, as now.
- `exhausted` (both settled, still not found) → "We don't have a player with
  that id", plus the fact that resolves most of these: the site covers players
  drafted from 2013 on, and undrafted players from their first NFL snap.
- `failed` (either fetch rejected) → "We couldn't load the player data", with a
  retry, because the id may be perfectly good.

Conflating the last two would tell someone their link is broken when the network
hiccupped — which is exactly the mistake that made the original bug report hard
to read.

**The trap.** The state must reset when `playerId` changes, or a good link
visited after a bad one inherits "not found".

**Scope.** `src/App.tsx` (the hook and `renderPlayerView`), a small
`PlayerNotFound` component beside the player view, its CSS block, unit tests for
the three states, and an e2e that loads a garbage id and asserts the page
settles rather than spinning.

### The current roster counts players the team released

**What.** `loadOffseasonRoster` (`scripts/update-data.ts`) indexes every row of
nflverse's `roster_{season}.csv` with no filter on `status`, so a player is
placed on a team's current roster whatever that row says about him. Measured
against the shipped 2026 snapshot — 2,211 players carrying a roster row:

| status    | count | meaning          |
| --------- | ----- | ---------------- |
| ACT       | 1,119 | active           |
| DEV       | 232   | practice squad   |
| RES       | 158   | reserve / IR     |
| CUT       | 112   | **released**     |
| RET       | 13    | **retired**      |
| INA / EXE | 12    | inactive, exempt |

Practice squad and reserve are defensible and are now stated on both roster
pages. `CUT` and `RET` are not: a player the team released is being counted on
its roster, and in the 32-team roster ranking's average.

**Fix.** Skip `CUT` and `RET` rows when building the index, and regenerate. Note
the roster file also carries `status_description_abbr` (`W03` = waived, `P01` =
practice squad, and so on), which is finer-grained than `status` if the cut
categories turn out to need splitting.

**Scope.** ~125 players leave the rosters, so every team's roster score moves
and the ranking can reorder — the same board that already changed when
undrafted players joined it. The draft rankings are unaffected; they never read
this snapshot.

**Why it was not fixed at the time:** it predates the free-agent work — picks
have always been counted this way — and the fix needs a data regeneration, so
it was filed rather than bundled into a UI change.

### Nothing prevents a player landing in both populations

`isUndraftedAndTracked` reads `players.csv` only and never cross-checks the pick ids built
in the same run. A player whose draft columns are blank but who appears in
`draft_picks.csv` would be written to both a `draft-{year}.json` and an `fa-{year}.json` —
listed twice on a team page, while `findPlayerInfo` silently resolves his detail page to
the pick. The shipped data has zero overlap, so this is latent, not live. A `Set` of pick
ids in `main()` closes it.

### Two position vocabularies feed one baseline table

Pick positions come from `draft_picks.csv`; free-agent positions come from `players.csv`,
normalized by `normalizeDraftPosition`, whose alias map was calibrated on the draft feed's
spellings. The free-agent files already contain one label the draft files never produce
(`MLB`, 1 player), and `getPositionBaseline` silently returns 1 for it — no rescaling,
harsher scoring, no warning. Immaterial today; a silent failure mode if nflverse's
`position` column drifts (`EDGE`, `HB`, `SS`). Cheap guard: assert in
`scripts/derive-fa-baseline.ts` that every non-exempt position has a baseline entry.

### A missing data file caches an empty class for the session

`loadFreeAgentClass` resolves a 404 to an empty class _inside_ `cached()`, which only
evicts on rejection. Once `fa-2026.json` is missing and resolved empty, that result is
cached like a real success for the rest of the session. Low blast radius — the cache is a
module singleton reset on page load, and a new deploy is a new page load — but it is
worth at least a comment at the call site.

### Postseason snaps are not distinguished from regular-season ones

No `game_type` filter exists in the snap accumulation, so a practice-squad player elevated
only for a playoff game is classed to that season. Inherited behavior shared with picks,
but it became load-bearing for free agents once class year was defined as the debut
season.

---

## UI and product

- **The free-agent section ignores "Show departed".** `RosterSection` can hide departed
  players; the free-agent list above it always shows them. Its sibling — the role filter —
  was fixed; this one was not.
- **The year and team views shape their free-agent stats differently.** The year view
  surfaces a count and a raw mean; the team view surfaces score and over slot. A user
  paging between them sees two different blocks for one feature.
- **The section sits above the roster** the team page is built around, so a secondary
  table precedes the primary one. Moving it below would match the "beside, never merged"
  framing — and would undo the `#team-roster` selector scoping four e2e specs now carry.
- **A free agent is absent from the cohort panel that ranks him.** The panel is honest
  about it ("N drafted · he isn't in it"), but including free-agent classmates would make
  it a real ranking.

---

## Code health

- **`getPlayerDraftSkill` is redundant** with `getAcquisitionOverSlot`, which covers picks
  too. Two independently-callable functions kept in sync by a single equivalence test.
  Have one delegate to the other once call sites migrate.
- **`rookieWindow` is dead in production.** No non-test caller remains; it survives for
  `rookieWindow.test.ts` via a `{ round } as DraftPick` cast. Delete it and move the
  round-window assertions onto `acquisitionWindow`.
- **`getTeamFreeAgents` linear-scans per call**, where `getTeamPicks` is `WeakMap`-indexed
  per class. Only matters if a league-wide free-agent view ever calls it per team.
- **`scoredCount` vs `totalFreeAgents` is a distinction that cannot occur** — the cohort
  rule guarantees a snap, so the filter removes nothing (0 of 2,258). It is carried
  through three files anyway. `coreStarterRate`, `coreStarterCount` and `retainedCount`
  are computed and returned but never read.
- **`FreeAgentSection` hand-rolls stat markup** instead of reusing `StatBlock`, which has
  no escape hatch for the sign-based colouring the over-slot value needs.
- **`buildFreeAgent` has no `'Unknown'` name fallback** where `buildDraftPick` does;
  players with no `pfr_id` are dropped uncounted; `NflversePlayerRow.headshot` is captured
  and never read.
- **Empty-state idioms diverge**: `YearDraftView` omits its undrafted section entirely
  when empty, `FreeAgentSection` renders a heading plus an empty-state sentence.

---

## Test coverage

- **No test pins the "picks-only values must not change" invariant.** It currently holds
  by evidence — regenerated artifacts came back byte-identical — which is strong but
  invisible in CI. Worth asserting that a `FreeAgent` can never reach
  `getRollingDraftScore`, `getLeagueHighlights`, or the rankings generators.
- **The data-pipeline wiring is untested where it is riskiest.** `firstSnapTeam` and
  `isUndraftedAndTracked` are covered as leaves, but the loop joining them in
  `update-data.ts` — year bucketing, the out-of-window skip, the zero-cohort guard, the
  `buildFreeAgent` field mapping — runs only when the script runs. Extracting the
  bucketing into a pure function over `(playerRows, snapIndex, years)` would make all of
  it unit-testable.
- **The baseline has no regression guard on real-shaped data.** `fa-baseline.json`'s
  scalar is subtracted from every free-agent over-slot on the site; the derivation is
  tested only against three-player fixtures.
