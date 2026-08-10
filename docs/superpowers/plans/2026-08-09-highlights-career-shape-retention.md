# Highlights: Career Shape & Retention Bands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six new highlight lists to the Highlights page — four about career shape (day-one starters, late bloomers, iron men, snakebit) and two about retention (the ones that got away, kept the band together) — organised into labelled bands.

**Architecture:** Two new pure lib modules, `careerShapeHighlights.ts` and `retentionHighlights.ts`, each owning its metrics, constants and tests. `getLeagueHighlights.ts` composes them into the existing `LeagueHighlights` type, so `App.tsx` is untouched. The view generalises its existing row/list components over a single `HighlightRowData` shape and renders three bands.

**Tech Stack:** TypeScript, React 19, Vite, Vitest + React Testing Library, plain CSS in `src/App.css`.

**Spec:** `docs/superpowers/specs/2026-08-09-highlights-career-shape-retention-design.md`

---

## Orientation for the implementer

Read these before starting. They encode rules this plan depends on and that are easy to violate by accident.

| File                          | What you must know                                                                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`                | `Season.teamGames === 0` means **the season has not been played**. `Season.retained` is true when the player was with the drafting team that year; when false, `Season.currentTeam` holds where he was instead.                  |
| `src/lib/seasonPlayed.ts`     | `playedSeasons(pick)` drops unplayed rows. **A season missed entirely is still a played season** (`teamGames > 0`, `gamesPlayed === 0`). This trips up snakebit specifically — see Task 5.                                       |
| `src/lib/snapShareForTier.ts` | `snapShareForRoleTier(season, position)` is the position-adjusted usage reading everything classifies on. Never compare a raw `snapShare` against a tier threshold without normalising.                                          |
| `src/lib/classifyRole.ts`     | `classifyRole(tierShare, gamesPlayedShare, gamesPlayed, position)` → `Role`. `CORE_TIER_THRESHOLD = 0.65`.                                                                                                                       |
| `src/lib/getPlayerRole.ts`    | `getPlayerRole(pick, options?)` is the career-level role. `getFilteredSeasons` also strips apprentice seasons — **do not use it in this work**, the new lists read `playedSeasons` directly (spec: _Apprenticeship divergence_). |
| `src/lib/draftClass.ts:59`    | Rest games are already subtracted from every season at parse time. You do not handle `restGame` anywhere in this feature; you only write tests proving you inherited the behaviour.                                              |
| `src/test/factories.ts`       | `makePick`, `makeSeason`, `makeTeam`. Default position is `ZZ` (baseline 1.0) so shares are un-adjusted; default season is 16 of 17 games at 90% share, which classifies `core_starter`.                                         |

**Commands:**

- Single test file: `pnpm vitest run src/lib/<file>.test.ts`
- Single test by name: `pnpm vitest run src/lib/<file>.test.ts -t "name"`
- Everything: `pnpm test`
- Before the final commit: `pnpm validate` (format, types, lint, jscpd duplication, tests, build)

**Conventions:** TDD — write the failing test, watch it fail, then implement. Conventional commits (`feat:`, `test:`, `refactor:`). Never `--no-verify`. If a pre-commit hook hangs, check `lsof -i:4173` for a stale preview server before debugging anything else.

---

## File structure

**Create**

- `src/lib/seasonTag.ts` — `'21`-style season label (moved out of the view so lib and view share one copy; `jscpd` runs in `pnpm validate`).
- `src/lib/seasonTag.test.ts`
- `src/lib/careerShapeHighlights.ts` — `getCareerShapeHighlights` + its four metrics, gate constants, and the `RankedPlayer` type.
- `src/lib/careerShapeHighlights.test.ts`
- `src/lib/retentionHighlights.ts` — `getRetentionHighlights`, `TeamRateHighlight`, gate constants.
- `src/lib/retentionHighlights.test.ts`

**Modify**

- `src/lib/roleDisplay.ts` — add `isAtLeastRole`.
- `src/lib/roleDisplay.test.ts` — cover it.
- `src/lib/getLeagueHighlights.ts` — compose the two new builders into `LeagueHighlights`.
- `src/lib/getLeagueHighlights.test.ts` — assert composition only.
- `src/components/views/highlights/HighlightsView.tsx` — generalise the row/list, add bands, render six new lists, extend the footnote.
- `src/components/views/highlights/HighlightsView.test.tsx`
- `src/App.css` — band heading styles.

**Not touched:** `src/App.tsx`, the scoring engine, the slot baseline, `bustExclusions.json`.

---

### Task 1: `isAtLeastRole`

Three gates in this feature ask "is this role `significant_contributor` or better?". One implementation, beside the existing `isStrongerRole`.

**Files:**

- Modify: `src/lib/roleDisplay.ts:38`
- Test: `src/lib/roleDisplay.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/roleDisplay.test.ts` (add `isAtLeastRole` to the existing import from `./roleDisplay`):

```ts
describe('isAtLeastRole', () => {
  it('is true when the candidate outranks the floor', () => {
    expect(isAtLeastRole('core_starter', 'significant_contributor')).toBe(true);
  });

  it('is true at the floor itself', () => {
    expect(
      isAtLeastRole('significant_contributor', 'significant_contributor'),
    ).toBe(true);
  });

  it('is false below the floor', () => {
    expect(isAtLeastRole('contributor', 'significant_contributor')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/roleDisplay.test.ts`
Expected: FAIL — `isAtLeastRole is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/roleDisplay.ts`:

```ts
/**
 * Whether `candidate` is at least as strong as `floor`. The inclusive sibling of
 * {@link isStrongerRole}, for gates phrased as "significant contributor or
 * better".
 */
export function isAtLeastRole(candidate: Role, floor: Role): boolean {
  return ROLE_ORDER.indexOf(candidate) >= ROLE_ORDER.indexOf(floor);
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/roleDisplay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roleDisplay.ts src/lib/roleDisplay.test.ts
git commit -m "feat: add an inclusive role-floor comparison"
```

---

### Task 2: `seasonTag` moves to lib

The iron-man streak needs `'21–'25` inside the lib. `HighlightsView.tsx:22` already has this function; copying it would trip `jscpd` in `pnpm validate`.

**Files:**

- Create: `src/lib/seasonTag.ts`, `src/lib/seasonTag.test.ts`
- Modify: `src/components/views/highlights/HighlightsView.tsx:21-24`

- [ ] **Step 1: Write the failing test**

Create `src/lib/seasonTag.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { seasonTag } from './seasonTag';

describe('seasonTag', () => {
  it('renders a two-digit season suffix', () => {
    expect(seasonTag(2021)).toBe("'21");
  });

  it('pads a single-digit year', () => {
    expect(seasonTag(2005)).toBe("'05");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/seasonTag.test.ts`
Expected: FAIL — cannot resolve `./seasonTag`.

- [ ] **Step 3: Implement, and delete the copy in the view**

Create `src/lib/seasonTag.ts`:

```ts
/** Two-digit season suffix, e.g. 2021 → "'21". */
export function seasonTag(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}
```

In `HighlightsView.tsx`, delete the local `seasonTag` function (lines 21–24) and import it instead:

```ts
import { seasonTag } from '../../../lib/seasonTag';
```

- [ ] **Step 4: Run the affected tests**

Run: `pnpm vitest run src/lib/seasonTag.test.ts src/components/views/highlights/HighlightsView.test.tsx`
Expected: PASS — the view test still passes, proving the move changed no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seasonTag.ts src/lib/seasonTag.test.ts src/components/views/highlights/HighlightsView.tsx
git commit -m "refactor: share the season tag between lib and view"
```

---

### Task 3: Career-shape scaffolding — types, constants, season helpers

No metrics yet. This task lands the shared shape so the four metric tasks are pure additions.

**Files:**

- Create: `src/lib/careerShapeHighlights.ts`, `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/careerShapeHighlights.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getCareerShapeHighlights } from './careerShapeHighlights';
import { makeTeam } from '../test/factories';

const teams = [makeTeam({ id: 'A' })];

describe('getCareerShapeHighlights', () => {
  it('returns four empty lists for no draft classes', () => {
    const h = getCareerShapeHighlights([], teams);
    expect(h.dayOneStarters).toEqual([]);
    expect(h.lateBloomers).toEqual([]);
    expect(h.ironMen).toEqual([]);
    expect(h.snakebit).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: FAIL — cannot resolve `./careerShapeHighlights`.

- [ ] **Step 3: Implement the scaffolding**

Create `src/lib/careerShapeHighlights.ts`:

```ts
import type { DraftClass, DraftPick, Role, Season, Team } from '../types';
import { classifyRole } from './classifyRole';
import { playedSeasons } from './seasonPlayed';
import { snapShareForRoleTier } from './snapShareForTier';

/**
 * A player row ranked by a list's own quantity, rather than by the over-slot
 * residual that {@link PlayerHighlight} carries. Each list formats its own
 * numbers at the source so the view stays free of per-list branching.
 */
export interface RankedPlayer {
  pick: DraftPick;
  team: Team | undefined;
  draftYear: number;
  /** The quantity the list ranked on; tests and tie-breaks read this. */
  value: number;
  /** `value` rendered for the right-hand column, e.g. `+76`. */
  headline: string;
  /** Supporting context for the meta line, e.g. `12% → 88%`. */
  detail: string;
}

/** The four career-shape lists. */
export interface CareerShapeHighlights {
  dayOneStarters: RankedPlayer[];
  lateBloomers: RankedPlayer[];
  ironMen: RankedPlayer[];
  snakebit: RankedPlayer[];
}

/** Played seasons needed before a rise from rookie year to peak means anything. */
export const MIN_BLOOM_SEASONS = 3;

/** Shortest run of full, contributing seasons that counts as an iron-man streak. */
export const MIN_IRON_MAN_STREAK = 3;

/** Career games below which "great when he played" is too small a sample. */
export const MIN_SNAKEBIT_GAMES = 8;

/**
 * Share of team games a player must appear in for the season to read as fully
 * available: 16 of a 17-game season. Rest games are already subtracted upstream
 * (`draftClass.ts`), so a rested finale cannot push a season under this.
 */
export const FULL_AVAILABILITY_GAMES_SHARE = 0.94;

/** How many players each list holds. Matches the highlight lists' expanded size. */
export const CAREER_SHAPE_LIST_MAX = 20;

/**
 * The four career-shape highlights across the loaded window.
 *
 * Every list reads {@link playedSeasons} directly rather than
 * `getFilteredSeasons`: these measure usage and availability, not score, and
 * late bloomers depends on seeing the apprentice seasons the scoring path
 * deliberately drops. See the design spec's *Apprenticeship divergence*.
 */
export function getCareerShapeHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
): CareerShapeHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const dayOneStarters: RankedPlayer[] = [];
  const lateBloomers: RankedPlayer[] = [];
  const ironMen: RankedPlayer[] = [];
  const snakebit: RankedPlayer[] = [];

  void teamById;

  return { dayOneStarters, lateBloomers, ironMen, snakebit };
}
```

Note: the builder is deliberately bare. Every helper (`seasonRole`, `careerSeasons`, `rookieSeason`, `pct`) arrives with the task that first needs it — adding them here would leave unused symbols that eslint rejects, and the commit at Step 5 would fail its pre-commit hook. `void teamById;` is the one exception, and Task 4 deletes it.

Trim the imports to what this file actually uses right now (`DraftClass`, `DraftPick`, `Team`, `RankedPlayer`'s dependencies); each later task adds its own.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: scaffold the career-shape highlight module"
```

---

### Task 4: Day-one starters

Rookie-year usage. Ranked share-descending, then by **later** pick — a sixth-rounder starting week one is the finding; a first-rounder starting week one is the plan.

**Files:**

- Modify: `src/lib/careerShapeHighlights.ts`
- Test: `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/careerShapeHighlights.test.ts` (extend the imports with `makePick`, `makeSeason` and `DraftClass`):

```ts
/** One draft class of 2021 picks. */
function classOf(...picks: DraftPick[]): DraftClass[] {
  return [{ year: 2021, picks }];
}

describe('day-one starters', () => {
  it('ranks by rookie-year snap share', () => {
    const heavy = makePick({
      overallPick: 40,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.9 })],
    });
    const light = makePick({
      overallPick: 41,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.4 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(light, heavy),
      teams,
    );

    expect(dayOneStarters.map((r) => r.pick.overallPick)).toEqual([40, 41]);
    expect(dayOneStarters[0].headline).toBe('90%');
  });

  it('breaks a tie toward the later pick', () => {
    const early = makePick({
      overallPick: 5,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.8 })],
    });
    const late = makePick({
      overallPick: 200,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2021, snapShare: 0.8 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(early, late),
      teams,
    );

    expect(dayOneStarters[0].pick.overallPick).toBe(200);
  });

  it('skips a pick who did not play his rookie season', () => {
    const redshirt = makePick({
      overallPick: 60,
      teamId: 'A',
      draftYear: 2021,
      seasons: [makeSeason({ year: 2022, snapShare: 0.95 })],
    });

    const { dayOneStarters } = getCareerShapeHighlights(
      classOf(redshirt),
      teams,
    );

    expect(dayOneStarters).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts -t "day-one"`
Expected: FAIL — the list is empty.

- [ ] **Step 3: Implement**

Add the three helpers this task needs, above `getCareerShapeHighlights`:

```ts
/** Played seasons in ascending year order. */
function careerSeasons(pick: DraftPick): Season[] {
  return [...playedSeasons(pick)].sort((a, b) => a.year - b.year);
}

/** The pick's rookie season, if he played one. */
function rookieSeason(pick: DraftPick): Season | undefined {
  return careerSeasons(pick).find((s) => s.year === pick.draftYear);
}

/** Whole-percent rendering of a 0–1 share. */
function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}
```

Then delete `void teamById;` and open the loop:

```ts
for (const draft of draftClasses) {
  for (const pick of draft.picks) {
    const base = {
      pick,
      team: teamById.get(pick.teamId),
      draftYear: draft.year,
    };

    const rookie = rookieSeason(pick);
    if (rookie !== undefined) {
      const share = snapShareForRoleTier(rookie, pick.position);
      dayOneStarters.push({
        ...base,
        value: share,
        headline: pct(share),
        detail: 'rookie year',
      });
    }
  }
}
```

`seasonRole` is not needed yet — it arrives with Task 6.

And before the `return`, sort and trim:

```ts
dayOneStarters.sort(
  (a, b) => b.value - a.value || b.pick.overallPick - a.pick.overallPick,
);

return {
  dayOneStarters: dayOneStarters.slice(0, CAREER_SHAPE_LIST_MAX),
  lateBloomers,
  ironMen,
  snakebit,
};
```

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: rank rookies who started from day one"
```

---

### Task 5: Late bloomers

Peak-season share minus rookie-season share. The one list that deliberately sees apprentice seasons.

**Files:**

- Modify: `src/lib/careerShapeHighlights.ts`
- Test: `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('late bloomers', () => {
  /** Four seasons, share given per year starting at the draft year. */
  function career(overallPick: number, shares: number[]): DraftPick {
    return makePick({
      overallPick,
      teamId: 'A',
      draftYear: 2021,
      seasons: shares.map((snapShare, i) =>
        makeSeason({ year: 2021 + i, snapShare }),
      ),
    });
  }

  it('ranks by the rise from rookie year to peak', () => {
    const big = career(10, [0.1, 0.3, 0.9]);
    const small = career(11, [0.5, 0.6, 0.7]);

    const { lateBloomers } = getCareerShapeHighlights(
      classOf(small, big),
      teams,
    );

    expect(lateBloomers.map((r) => r.pick.overallPick)).toEqual([10, 11]);
    expect(lateBloomers[0].headline).toBe('+80');
    expect(lateBloomers[0].detail).toBe('10% → 90%');
  });

  it('requires MIN_BLOOM_SEASONS played seasons', () => {
    const short = career(12, [0.1, 0.9]);

    const { lateBloomers } = getCareerShapeHighlights(classOf(short), teams);

    expect(short.seasons.length).toBeLessThan(MIN_BLOOM_SEASONS);
    expect(lateBloomers).toEqual([]);
  });

  it('treats a snapless rookie year as a real 0% baseline', () => {
    const sat = makePick({
      overallPick: 13,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 0, snapShare: 0 }),
        makeSeason({ year: 2022, snapShare: 0.5 }),
        makeSeason({ year: 2023, snapShare: 0.95 }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(classOf(sat), teams);

    expect(lateBloomers[0].headline).toBe('+95');
  });

  it('skips a pick with no rookie season to rise from', () => {
    const noBaseline = makePick({
      overallPick: 14,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2022, snapShare: 0.2 }),
        makeSeason({ year: 2023, snapShare: 0.6 }),
        makeSeason({ year: 2024, snapShare: 0.95 }),
      ],
    });

    const { lateBloomers } = getCareerShapeHighlights(
      classOf(noBaseline),
      teams,
    );

    expect(lateBloomers).toEqual([]);
  });

  it('skips a career that never rose', () => {
    const flat = career(15, [0.9, 0.8, 0.7]);

    const { lateBloomers } = getCareerShapeHighlights(classOf(flat), teams);

    expect(lateBloomers).toEqual([]);
  });
});
```

Add `MIN_BLOOM_SEASONS` to the module import.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts -t "late bloomers"`
Expected: FAIL — the list is empty.

- [ ] **Step 3: Implement**

Inside the pick loop, after the day-one block:

```ts
const seasons = careerSeasons(pick);
if (rookie !== undefined && seasons.length >= MIN_BLOOM_SEASONS) {
  const rookieShare = snapShareForRoleTier(rookie, pick.position);
  const peakShare = Math.max(
    ...seasons.map((s) => snapShareForRoleTier(s, pick.position)),
  );
  const rise = peakShare - rookieShare;
  if (rise > 0) {
    lateBloomers.push({
      ...base,
      value: rise,
      headline: `+${Math.round(rise * 100)}`,
      detail: `${pct(rookieShare)} → ${pct(peakShare)}`,
    });
  }
}
```

And in the sort block:

```ts
lateBloomers.sort((a, b) => b.value - a.value);
```

Return `lateBloomers.slice(0, CAREER_SHAPE_LIST_MAX)`.

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: surface the picks who grew into their role"
```

---

### Task 6: Iron men

Longest run of consecutive seasons that are both **available** and **real**. The "real" half is what stops this being a ranking of core special-teamers.

**Files:**

- Modify: `src/lib/careerShapeHighlights.ts`
- Test: `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('iron men', () => {
  function fullSeason(year: number, overrides = {}) {
    return makeSeason({ year, gamesPlayed: 17, snapShare: 0.9, ...overrides });
  }

  it('ranks by the longest run of full contributing seasons', () => {
    const durable = makePick({
      overallPick: 20,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023, 2024].map((y) => fullSeason(y)),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(durable), teams);

    expect(ironMen[0].value).toBe(4);
    expect(ironMen[0].headline).toBe('4');
    expect(ironMen[0].detail).toBe("full seasons · '21–'24");
  });

  it('requires MIN_IRON_MAN_STREAK seasons', () => {
    const brief = makePick({
      overallPick: 21,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022].map((y) => fullSeason(y)),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(brief), teams);

    expect(MIN_IRON_MAN_STREAK).toBe(3);
    expect(ironMen).toEqual([]);
  });

  it('does not count a full-time special-teamer as an iron man', () => {
    const gunner = makePick({
      overallPick: 22,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023].map((y) =>
        fullSeason(y, { snapShare: 0.12 }),
      ),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(gunner), teams);

    expect(ironMen).toEqual([]);
  });

  it('breaks the streak on a season-ending injury', () => {
    const hurt = makePick({
      overallPick: 23,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        fullSeason(2021),
        fullSeason(2022),
        makeSeason({
          year: 2023,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.9,
          seasonEndingAbsenceGames: 9,
        }),
        fullSeason(2024),
      ],
    });

    const { ironMen } = getCareerShapeHighlights(classOf(hurt), teams);

    expect(ironMen).toEqual([]);
  });

  it('breaks the streak across a gap year', () => {
    const gap = makePick({
      overallPick: 24,
      teamId: 'A',
      draftYear: 2021,
      seasons: [fullSeason(2021), fullSeason(2022), fullSeason(2024)],
    });

    const { ironMen } = getCareerShapeHighlights(classOf(gap), teams);

    expect(ironMen).toEqual([]);
  });

  it('is not broken by a rested finale', () => {
    // draftClass.ts subtracts the rest game before app code sees the season, so
    // a 16-of-16 season is what a rested 17-game year looks like here.
    const rested = makePick({
      overallPick: 25,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022, 2023].map((y) =>
        makeSeason({ year: y, gamesPlayed: 16, teamGames: 16, snapShare: 0.9 }),
      ),
    });

    const { ironMen } = getCareerShapeHighlights(classOf(rested), teams);

    expect(ironMen[0].value).toBe(3);
  });
});
```

Add `MIN_IRON_MAN_STREAK` to the module import.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts -t "iron men"`
Expected: FAIL — the list is empty.

- [ ] **Step 3: Implement**

Add a module-level helper beside `seasonRole`:

```ts
/**
 * Whether a season counts toward an iron-man streak: the player was there for
 * effectively all of it, and was doing something when he was. Without the role
 * half, the list ranks core special-teamers, who dress every week by job
 * description.
 */
function isIronManSeason(season: Season, position: string): boolean {
  const available =
    season.teamGames > 0 &&
    season.gamesPlayed / season.teamGames >= FULL_AVAILABILITY_GAMES_SHARE &&
    (season.seasonEndingAbsenceGames ?? 0) < MIN_SEASON_ENDING_ABSENCE_GAMES;
  return (
    available &&
    isAtLeastRole(seasonRole(season, position), 'significant_contributor')
  );
}

/** The longest run of consecutive qualifying seasons, or null if none reaches the floor. */
function longestIronManStreak(
  seasons: Season[],
  position: string,
): { length: number; from: number; to: number } | null {
  let best: { length: number; from: number; to: number } | null = null;
  let runStart: Season | undefined;
  let runEnd: Season | undefined;
  let length = 0;

  for (const season of seasons) {
    const continues = runEnd !== undefined && season.year === runEnd.year + 1;
    if (isIronManSeason(season, position)) {
      if (continues) {
        length += 1;
      } else {
        runStart = season;
        length = 1;
      }
      runEnd = season;
      if (
        runStart !== undefined &&
        length >= MIN_IRON_MAN_STREAK &&
        (best === null || length > best.length)
      ) {
        best = { length, from: runStart.year, to: season.year };
      }
    } else {
      runStart = undefined;
      runEnd = undefined;
      length = 0;
    }
  }
  return best;
}
```

Imports to add at the top of the file:

```ts
import { isAtLeastRole } from './roleDisplay';
import { MIN_SEASON_ENDING_ABSENCE_GAMES } from './seasonEndingAbsence';
import { seasonTag } from './seasonTag';
```

In the pick loop:

```ts
const streak = longestIronManStreak(seasons, pick.position);
if (streak !== null) {
  ironMen.push({
    ...base,
    value: streak.length,
    headline: String(streak.length),
    detail: `full seasons · ${seasonTag(streak.from)}–${seasonTag(streak.to)}`,
  });
}
```

Sort (longer streak first, then the more used player):

```ts
ironMen.sort((a, b) => b.value - a.value || b.draftYear - a.draftYear);
```

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: rank the picks who never came off the field"
```

---

### Task 7: Snakebit

**Read this before implementing.** A season missed entirely is a _played_ season carrying `snapShare: 0`. If the "full-time when active" mean averages over all played seasons, the most-injured players — the exact population this list is for — get dragged below the bar and disqualified. The share mean reads seasons **with snaps**; the missed-games total reads **all** played seasons.

**Files:**

- Modify: `src/lib/careerShapeHighlights.ts`
- Test: `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('snakebit', () => {
  it('ranks by games missed among full-time players', () => {
    const hurt = makePick({
      overallPick: 30,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 6,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(hurt), teams);

    expect(snakebit[0].value).toBe(20);
    expect(snakebit[0].headline).toBe('20');
    expect(snakebit[0].detail).toBe('90% when active');
  });

  it('counts a fully missed season without letting it sink the share mean', () => {
    const lostYear = makePick({
      overallPick: 31,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 17,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({ year: 2022, gamesPlayed: 0, teamGames: 17, snapShare: 0 }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(lostYear), teams);

    expect(snakebit[0].value).toBe(17);
    expect(snakebit[0].detail).toBe('90% when active');
  });

  it('skips a part-time player who missed games', () => {
    const rotational = makePick({
      overallPick: 32,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.3,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 8,
          teamGames: 17,
          snapShare: 0.3,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(rotational), teams);

    expect(snakebit).toEqual([]);
  });

  it('requires MIN_SNAKEBIT_GAMES of career evidence', () => {
    const brief = makePick({
      overallPick: 33,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          gamesPlayed: 2,
          teamGames: 17,
          snapShare: 0.9,
        }),
        makeSeason({
          year: 2022,
          gamesPlayed: 3,
          teamGames: 17,
          snapShare: 0.9,
        }),
      ],
    });

    const { snakebit } = getCareerShapeHighlights(classOf(brief), teams);

    expect(MIN_SNAKEBIT_GAMES).toBe(8);
    expect(snakebit).toEqual([]);
  });

  it('skips a player who never missed a game', () => {
    const durable = makePick({
      overallPick: 34,
      teamId: 'A',
      draftYear: 2021,
      seasons: [2021, 2022].map((year) =>
        makeSeason({ year, gamesPlayed: 17, teamGames: 17, snapShare: 0.9 }),
      ),
    });

    const { snakebit } = getCareerShapeHighlights(classOf(durable), teams);

    expect(snakebit).toEqual([]);
  });
});
```

Add `MIN_SNAKEBIT_GAMES` to the module import.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts -t "snakebit"`
Expected: FAIL — the list is empty.

- [ ] **Step 3: Implement**

Add to the imports:

```ts
import { CORE_TIER_THRESHOLD } from './classifyRole';
import { normalizeSnapShareForPosition } from './positionBaseline';
```

In the pick loop:

```ts
// Per-game share, not cumulative load: the claim is "he started the games
// he dressed for", and cumulative load already divides by a season he did
// not get. Averaged over seasons with snaps only — a season missed in full
// is a played season carrying 0%, and including it would disqualify
// exactly the players this list exists to name.
const active = seasons.filter((s) => s.gamesPlayed > 0);
const missedGames = seasons.reduce(
  (sum, s) => sum + (s.teamGames - s.gamesPlayed),
  0,
);
const careerGames = seasons.reduce((sum, s) => sum + s.gamesPlayed, 0);
if (
  seasons.length >= 2 &&
  active.length > 0 &&
  missedGames > 0 &&
  careerGames >= MIN_SNAKEBIT_GAMES
) {
  const activeShare =
    active.reduce(
      (sum, s) =>
        sum + normalizeSnapShareForPosition(s.snapShare, pick.position),
      0,
    ) / active.length;
  if (activeShare >= CORE_TIER_THRESHOLD) {
    snakebit.push({
      ...base,
      value: missedGames,
      headline: String(missedGames),
      detail: `${pct(activeShare)} when active`,
    });
  }
}
```

Sort — more missed games first, then the shorter career (the same losses from fewer games is the sharper loss):

```ts
snakebit.sort(
  (a, b) =>
    b.value - a.value ||
    playedSeasons(a.pick).length - playedSeasons(b.pick).length,
);
```

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/careerShapeHighlights.test.ts`
Expected: PASS — all four lists.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: name the picks who were good and hurt, not bad"
```

---

### Task 8: The ones that got away

**Files:**

- Create: `src/lib/retentionHighlights.ts`, `src/lib/retentionHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/retentionHighlights.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getRetentionHighlights } from './retentionHighlights';
import { makePick, makeSeason, makeTeam } from '../test/factories';
import type { DraftClass, DraftPick } from '../types';

const teams = [makeTeam({ id: 'A' }), makeTeam({ id: 'B' })];

function classOf(...picks: DraftPick[]): DraftClass[] {
  return [{ year: 2021, picks }];
}

describe('the ones that got away', () => {
  /** Two quiet years with the drafting team, then two good ones elsewhere. */
  function bloomedElsewhere(overallPick: number): DraftPick {
    return makePick({
      overallPick,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 6, snapShare: 0.15 }),
        makeSeason({ year: 2022, gamesPlayed: 8, snapShare: 0.2 }),
        makeSeason({
          year: 2023,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2024,
          snapShare: 0.95,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });
  }

  it('ranks by the rise after leaving and names the new team', () => {
    const { gotAway } = getRetentionHighlights(
      classOf(bloomedElsewhere(50)),
      teams,
    );

    expect(gotAway).toHaveLength(1);
    expect(gotAway[0].team?.id).toBe('A');
    expect(gotAway[0].value).toBeGreaterThan(0);
    expect(gotAway[0].detail).toMatch(/→ \d+ with B$/);
  });

  it('skips a pick traded before he ever played', () => {
    const neverHere = makePick({
      overallPick: 51,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({
          year: 2021,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(neverHere), teams);

    expect(gotAway).toEqual([]);
  });

  it('skips a rise that never reaches starter grade', () => {
    const mediocre = makePick({
      overallPick: 52,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 1, snapShare: 0.01 }),
        makeSeason({
          year: 2022,
          gamesPlayed: 5,
          snapShare: 0.25,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 5,
          snapShare: 0.25,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(mediocre), teams);

    expect(gotAway).toEqual([]);
  });

  it('needs more than one starter-grade season elsewhere', () => {
    const oneGoodYear = makePick({
      overallPick: 53,
      teamId: 'A',
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, gamesPlayed: 4, snapShare: 0.1 }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: false,
          currentTeam: 'B',
        }),
        makeSeason({
          year: 2023,
          gamesPlayed: 2,
          snapShare: 0.05,
          retained: false,
          currentTeam: 'B',
        }),
      ],
    });

    const { gotAway } = getRetentionHighlights(classOf(oneGoodYear), teams);

    expect(gotAway).toEqual([]);
  });

  it('reads the current team from an unplayed roster row, not the last played one', () => {
    // He played elsewhere for B, then moved again over the offseason. The
    // roster row is the only thing that knows, and it must not be scored.
    const pick = bloomedElsewhere(54);
    pick.seasons.push(
      makeSeason({
        year: 2025,
        gamesPlayed: 0,
        teamGames: 0,
        snapShare: 0,
        retained: false,
        currentTeam: 'DEN',
      }),
    );

    const { gotAway } = getRetentionHighlights(classOf(pick), teams);

    expect(gotAway[0].detail).toMatch(/with DEN$/);
    // The unplayed row contributed nothing: the rise is the same as without it.
    const { gotAway: without } = getRetentionHighlights(
      classOf(bloomedElsewhere(54)),
      teams,
    );
    expect(gotAway[0].value).toBeCloseTo(without[0].value);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/retentionHighlights.test.ts`
Expected: FAIL — cannot resolve `./retentionHighlights`.

- [ ] **Step 3: Implement**

Create `src/lib/retentionHighlights.ts`:

```ts
import type { DraftClass, DraftPick, Season, Team } from '../types';
import { classifyRole } from './classifyRole';
import type { RankedPlayer } from './careerShapeHighlights';
import { getSeasonScore } from './getSeasonScore';
import { isAtLeastRole } from './roleDisplay';
import { playedSeasons } from './seasonPlayed';
import { snapShareForRoleTier } from './snapShareForTier';

/** A team row in the retention ranking. */
export interface TeamRateHighlight {
  teamId: string;
  team: Team | undefined;
  kept: number;
  keepers: number;
  rate: number;
}

/** The two retention lists. */
export interface RetentionHighlights {
  gotAway: RankedPlayer[];
  keptTheBand: TeamRateHighlight[];
}

/**
 * Starter-grade seasons a player needs elsewhere before leaving counts as a
 * loss. Doing it twice rules out both a one-year fluke and a rise that only
 * reaches rotation snaps.
 */
export const MIN_POST_EXIT_STARTER_SEASONS = 2;

/** How many entries each retention list holds. */
export const RETENTION_LIST_MAX = 20;

/**
 * Career highlights about who left and who stayed.
 *
 * **Takes no `GetPlayerRoleOptions` by design.** Elsewhere `draftingTeamOnly`
 * asks what a team got from a pick; here the seasons after he left are the
 * entire subject, so the option has nowhere to go and cannot be threaded in by
 * mistake.
 */
export function getRetentionHighlights(
  draftClasses: DraftClass[],
  teams: readonly Team[],
): RetentionHighlights {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const gotAway: RankedPlayer[] = [];

  for (const draft of draftClasses) {
    for (const pick of draft.picks) {
      const played = playedSeasons(pick);
      const retained = played.filter((s) => s.retained);
      const postExit = played.filter((s) => !s.retained);
      if (retained.length === 0) continue;

      const starterSeasons = postExit.filter((s) =>
        isAtLeastRole(
          classifyRole(
            snapShareForRoleTier(s, pick.position),
            s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0,
            s.gamesPlayed,
            pick.position,
          ),
          'significant_contributor',
        ),
      );
      if (starterSeasons.length < MIN_POST_EXIT_STARTER_SEASONS) continue;

      const before = meanScore(retained, pick.position);
      const after = meanScore(postExit, pick.position);
      const rise = after - before;
      if (rise <= 0) continue;

      gotAway.push({
        pick,
        team: teamById.get(pick.teamId),
        draftYear: draft.year,
        value: rise,
        headline: `+${Math.round(rise)}`,
        detail: `${Math.round(before)} → ${Math.round(after)} with ${currentTeamOf(pick)}`,
      });
    }
  }

  gotAway.sort((a, b) => b.value - a.value);

  return {
    gotAway: gotAway.slice(0, RETENTION_LIST_MAX),
    keptTheBand: [],
  };
}

function meanScore(seasons: Season[], position: string): number {
  if (seasons.length === 0) return 0;
  return (
    seasons.reduce((sum, s) => sum + getSeasonScore(s, position), 0) /
    seasons.length
  );
}

/**
 * Where the player is now, from the newest season row — **including an unplayed
 * one**. A roster snapshot is the most accurate answer precisely because it is
 * not a result; it is read for this label only and never scored.
 */
function currentTeamOf(pick: DraftPick): string {
  const newest = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
  return newest?.currentTeam ?? '—';
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/retentionHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retentionHighlights.ts src/lib/retentionHighlights.test.ts
git commit -m "feat: credit each team the picks it let get away"
```

---

### Task 9: Kept the band together

**Files:**

- Modify: `src/lib/retentionHighlights.ts`
- Test: `src/lib/retentionHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('kept the band together', () => {
  /** A starter-grade pick, retained or not in his latest season. */
  function keeper(
    teamId: string,
    overallPick: number,
    stayed: boolean,
  ): DraftPick {
    return makePick({
      overallPick,
      teamId,
      draftYear: 2021,
      seasons: [
        makeSeason({ year: 2021, snapShare: 0.9 }),
        makeSeason({
          year: 2022,
          snapShare: 0.9,
          retained: stayed,
          ...(stayed ? {} : { currentTeam: 'B' }),
        }),
      ],
    });
  }

  function keepers(teamId: string, kept: number, lost: number): DraftPick[] {
    const picks: DraftPick[] = [];
    for (let i = 0; i < kept; i += 1) picks.push(keeper(teamId, 100 + i, true));
    for (let i = 0; i < lost; i += 1)
      picks.push(keeper(teamId, 200 + i, false));
    return picks;
  }

  it('ranks teams by the share of keepers retained', () => {
    const { keptTheBand } = getRetentionHighlights(
      classOf(...keepers('A', 5, 1), ...keepers('B', 3, 3)),
      teams,
    );

    expect(keptTheBand[0].teamId).toBe('A');
    expect(keptTheBand[0].kept).toBe(5);
    expect(keptTheBand[0].keepers).toBe(6);
    expect(keptTheBand[0].rate).toBeCloseTo(5 / 6);
  });

  it('needs MIN_KEEPERS before a team can rank', () => {
    const { keptTheBand } = getRetentionHighlights(
      classOf(...keepers('A', 4, 0)),
      teams,
    );

    expect(MIN_KEEPERS).toBe(5);
    expect(keptTheBand).toEqual([]);
  });

  it('ignores picks who never reached starter grade', () => {
    const scrubs = Array.from({ length: 6 }, (_, i) =>
      makePick({
        overallPick: 300 + i,
        teamId: 'A',
        draftYear: 2021,
        seasons: [makeSeason({ year: 2021, gamesPlayed: 2, snapShare: 0.05 })],
      }),
    );

    const { keptTheBand } = getRetentionHighlights(classOf(...scrubs), teams);

    expect(keptTheBand).toEqual([]);
  });
});
```

Add `MIN_KEEPERS` to the module import.

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/lib/retentionHighlights.test.ts -t "kept the band"`
Expected: FAIL — the list is empty.

- [ ] **Step 3: Implement**

Add imports and the constant:

```ts
import { getPlayerRole, pickHasSeasonSnapData } from './getPlayerRole';
import { latestPlayedSeason } from './seasonPlayed';

/**
 * Keepers a team needs before its retention rate means anything. Below this a
 * thin sample tops the list on two players.
 */
export const MIN_KEEPERS = 5;
```

Tally inside the same pick loop, before the `gotAway` gates:

```ts
if (
  pickHasSeasonSnapData(pick) &&
  isAtLeastRole(getPlayerRole(pick), 'significant_contributor')
) {
  keeperCount.set(pick.teamId, (keeperCount.get(pick.teamId) ?? 0) + 1);
  if (latestPlayedSeason(pick)?.retained === true) {
    keptCount.set(pick.teamId, (keptCount.get(pick.teamId) ?? 0) + 1);
  }
}
```

Declare the maps beside `gotAway`:

```ts
// Keepers only. A plain retention rate rewards a team for hanging onto picks
// nobody else wanted and punishes one that cuts its misses quickly, which
// inverts the thing the list claims to measure. A keeper who retired with the
// drafting team counts as kept — never letting him go is the purest form of
// keeping him, and the data carries no "still in the league" flag anyway.
const keeperCount = new Map<string, number>();
const keptCount = new Map<string, number>();
```

And build the ranking before the return:

```ts
const keptTheBand: TeamRateHighlight[] = [];
for (const [teamId, count] of keeperCount) {
  if (count < MIN_KEEPERS) continue;
  const kept = keptCount.get(teamId) ?? 0;
  keptTheBand.push({
    teamId,
    team: teamById.get(teamId),
    kept,
    keepers: count,
    rate: kept / count,
  });
}
keptTheBand.sort((a, b) => b.rate - a.rate || b.kept - a.kept);
```

Return `keptTheBand: keptTheBand.slice(0, 5)`.

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/lib/retentionHighlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/retentionHighlights.ts src/lib/retentionHighlights.test.ts
git commit -m "feat: rank the teams that kept the players worth keeping"
```

---

### Task 10: Compose into `LeagueHighlights`

`App.tsx` must not change. The call signature and type name stay put; the shape grows.

**Files:**

- Modify: `src/lib/getLeagueHighlights.ts:37-44`, `:104-112`
- Test: `src/lib/getLeagueHighlights.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/getLeagueHighlights.test.ts`:

```ts
it('carries the career-shape and retention bands', () => {
  const classes: DraftClass[] = [
    {
      year: 2021,
      picks: [pick({ teamId: 'A', round: 1, overallPick: 1, snapShare: 0.9 })],
    },
  ];

  const h = getLeagueHighlights(classes, teams, opts);

  expect(h.dayOneStarters).toBeDefined();
  expect(h.lateBloomers).toBeDefined();
  expect(h.ironMen).toBeDefined();
  expect(h.snakebit).toBeDefined();
  expect(h.gotAway).toBeDefined();
  expect(h.keptTheBand).toBeDefined();
});
```

The existing empty-classes test should also assert the six new lists come back empty.

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/lib/getLeagueHighlights.test.ts`
Expected: FAIL — property does not exist on `LeagueHighlights`.

- [ ] **Step 3: Implement**

In `getLeagueHighlights.ts`, extend the interface:

```ts
export interface LeagueHighlights
  extends CareerShapeHighlights, RetentionHighlights {
  /** Picks most above their draft slot's expectation, best first. */
  steals: PlayerHighlight[];
  /** Picks furthest below their draft slot's expectation, worst first. */
  busts: PlayerHighlight[];
  /** Team that produced the most core starters. */
  mostCoreStarters: TeamHighlight | null;
}
```

And the return:

```ts
return {
  steals: [...candidates].sort(compareSteal).slice(0, HIGHLIGHT_LIST_MAX),
  busts: candidates
    .filter((c) => !isBustExcluded(c.pick.playerId))
    .sort(compareBust)
    .slice(0, HIGHLIGHT_LIST_MAX),
  mostCoreStarters: pickCoreLeader(coreCount, scoredCount, teamById),
  ...getCareerShapeHighlights(draftClasses, teams),
  // No options: this band's subject is the seasons `draftingTeamOnly` removes.
  ...getRetentionHighlights(draftClasses, teams),
};
```

Extend the JSDoc on `getLeagueHighlights` to name the three bands it now returns.

- [ ] **Step 4: Run the whole suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/getLeagueHighlights.ts src/lib/getLeagueHighlights.test.ts
git commit -m "feat: compose the highlight bands into one league result"
```

---

### Task 11: Generalise the highlight row (no visible change)

Pure refactor. `PlayerRow` is welded to `PlayerHighlight`'s `score`/`overSlot`; six new lists rank on other things. One row shape, one list component, two adapters.

**Files:**

- Modify: `src/components/views/highlights/HighlightsView.tsx`
- Test: `src/components/views/highlights/HighlightsView.test.tsx`

- [ ] **Step 1: Confirm the current tests pass, and keep them as the safety net**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx`
Expected: PASS. These tests must still pass unchanged at the end of this task — that is what makes it a refactor.

- [ ] **Step 2: Introduce the row shape and adapters**

Add near the top of the view:

```tsx
/** What every highlight row needs, whatever list it came from. */
interface HighlightRowData {
  pick: DraftPick;
  team: Team | undefined;
  draftYear: number;
  /** Right-hand column, e.g. `+12.4` or `5`. */
  headline: string;
  /** Colour cue for the headline. */
  tone: 'high' | 'low';
  /** Trailing text on the meta line, e.g. `score 84` or `90% when active`. */
  detail: string;
  /** Tooltip on the headline. */
  headlineTitle: string;
}

function fromPlayerHighlight(h: PlayerHighlight): HighlightRowData {
  return {
    pick: h.pick,
    team: h.team,
    draftYear: h.draftYear,
    headline: formatOverSlot(h.overSlot),
    tone: h.overSlot >= 0 ? 'high' : 'low',
    detail: `score ${h.score.toFixed(0)}`,
    headlineTitle: 'Draft score above or below what this draft slot predicted',
  };
}

function fromRankedPlayer(r: RankedPlayer, title: string): HighlightRowData {
  return {
    pick: r.pick,
    team: r.team,
    draftYear: r.draftYear,
    headline: r.headline,
    tone: 'high',
    detail: r.detail,
    headlineTitle: title,
  };
}
```

- [ ] **Step 3: Rewrite `PlayerRow`, `PlayerMeta` and `PlayerList` against `HighlightRowData`**

`PlayerMeta` takes `detail: string` in place of `score: number` and prints it where `score {n}` was. `PlayerRow` takes `row: HighlightRowData` and reads `row.headline` / `row.tone` / `row.headlineTitle` where it read `overSlot`. `PlayerList` takes `items: HighlightRowData[]`. The steals and busts call sites map through `fromPlayerHighlight`.

The `key` on each row stays `pick.playerId`, which is unique within a list.

- [ ] **Step 4: Run the view tests**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx`
Expected: PASS, unchanged. If a test needed editing, you changed behaviour — back it out.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/highlights/HighlightsView.tsx
git commit -m "refactor: give every highlight list one row shape"
```

---

### Task 12: Render the three bands

**Files:**

- Modify: `src/components/views/highlights/HighlightsView.tsx`, `src/App.css:875-890`
- Test: `src/components/views/highlights/HighlightsView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `HighlightsView.test.tsx` (extend the existing highlights fixture with populated `dayOneStarters` etc.):

```tsx
it('renders the three bands in order', () => {
  renderView();

  const headings = screen.getAllByRole('heading', { level: 2 });
  expect(headings.map((h) => h.textContent)).toEqual([
    'Value',
    'Career shape',
    'Retention',
  ]);
});

it('renders each new list with its own detail line', () => {
  renderView();

  expect(screen.getByText('Day-one starters')).toBeInTheDocument();
  expect(screen.getByText('Late bloomers')).toBeInTheDocument();
  expect(screen.getByText('Iron men')).toBeInTheDocument();
  expect(screen.getByText('Snakebit')).toBeInTheDocument();
  expect(screen.getByText('The ones that got away')).toBeInTheDocument();
  expect(screen.getByText('Kept the band together')).toBeInTheDocument();
});

it('shows an empty state rather than hiding a list with no picks', () => {
  renderView({ ironMen: [] });

  expect(
    screen.getByText('No picks with data in this window yet.'),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx`
Expected: FAIL — no band headings.

- [ ] **Step 3: Implement**

Add the band wrapper:

```tsx
// `ReactNode` needs adding to the existing `react` import:
//   import { memo, useState, type ReactNode } from 'react';
function HighlightBand({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="highlights-band">
      <h2 className="highlights-band__title kicker">{title}</h2>
      <div className="highlights-lists">{children}</div>
    </section>
  );
}
```

Replace the current `.highlights-lists` block with three bands:

- **Value** — steals (`accent="core"`), busts (`accent="non"`), unchanged notes.
- **Career shape** — Day-one starters (`rookie-year snap share`), Late bloomers (`rise from rookie year to peak`), Iron men (`longest run of full seasons`), Snakebit (`games missed by a full-time player`). All `accent="core"` except Snakebit, which takes `accent="non"` — it is a story about loss, and the colour should say so.
- **Retention** — The ones that got away (`accent="non"`, `score gained after leaving`) and Kept the band together, rendered with the `TeamLeader` visual language as five rows.

Each new list maps its items through `fromRankedPlayer` with a headline tooltip: e.g. `'Snap share in his rookie season'`, `'Snap-share points gained from rookie year to peak'`, `'Consecutive full, contributing seasons'`, `'Team games missed'`, `'Season-score points gained after leaving'`.

`mostCoreStarters` keeps its existing card below the bands.

CSS in `src/App.css`, after the `.highlights-lists` rule:

```css
.highlights-band__title {
  padding: 28px 48px 0;
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}
.highlights-band + .highlights-band .highlights-lists {
  padding-top: 12px;
}
@media (max-width: 900px) {
  .highlights-band__title {
    padding: 24px 24px 0;
  }
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/highlights/HighlightsView.tsx src/components/views/highlights/HighlightsView.test.tsx src/App.css
git commit -m "feat: group the highlights into value, career shape and retention"
```

---

### Task 13: Extend the footnote

The page must state the apprenticeship divergence itself, or it appears to contradict the player view.

**Files:**

- Modify: `src/components/views/highlights/HighlightsView.tsx` (the `.highlights-foot` block)

- [ ] **Step 1: Write the failing test**

```tsx
it('explains why an apprentice season counts here', () => {
  renderView();

  expect(screen.getByText(/sat before he started/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx -t "apprentice"`
Expected: FAIL.

- [ ] **Step 3: Implement**

Extend the footnote with, in the page's existing voice:

- what career shape measures (rookie-year usage, the rise to a peak, unbroken availability, and games missed by someone who started when he dressed);
- that a player who **sat before he started** counts his quiet rookie year here, because the rise is the point, even though the score elsewhere forgives those seasons rather than counting them;
- that retention credits the drafting team for who left, and rates only the picks worth keeping.

- [ ] **Step 4: Run and watch it pass**

Run: `pnpm vitest run src/components/views/highlights/HighlightsView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/highlights/HighlightsView.tsx src/components/views/highlights/HighlightsView.test.tsx
git commit -m "docs: say on the page why a rookie year that never started still counts"
```

---

### Task 14: Full verification

- [ ] **Step 1: Run the whole gate**

Run: `pnpm validate`
Expected: PASS — format, `tsc -b`, eslint, jscpd, vitest, build. If jscpd flags the two `classOf` helpers across the new test files, hoist one into `src/test/factories.ts` rather than silencing it.

- [ ] **Step 2: Sanity-check against real data**

Run: `pnpm dev`, open the Highlights view, and confirm the lists are populated and plausible — day-one starters should be dominated by early picks, iron men should be recognisable names, snakebit should contain players you would not call busts.

If a list is empty against real data, the gate is wrong, not the data. Report it rather than loosening the constant.

- [ ] **Step 3: Visual verification (mandatory — AGENTS.md)**

Invoke `/visual-verify`. Check both the desktop two-column layout and the ≤900px single-column collapse. Zero tolerance: every issue found gets fixed before this task closes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify the highlight bands end to end"
```

---

## Out of scope

Do not touch, even if it looks tempting mid-task:

- `bustExclusions.json` — some entries arguably belong on the snakebit list now. Separate judgement call on a hand-maintained file.
- Position factories, hardest position to hit, best/worst single class, most improved drafter, draft-score vs win-total divergence.
- The player view, team view, sitemap, scoring engine, role classification, slot baseline.
- `src/App.tsx` — if you find yourself editing it, the composition in Task 10 went wrong.

One known documentation defect, worth fixing if you are already in the file: `Season.restGame`'s doc comment in `src/types.ts:49` says `loadData.ts` applies `withoutRestGame`; the call actually lives in `draftClass.ts:59`.
