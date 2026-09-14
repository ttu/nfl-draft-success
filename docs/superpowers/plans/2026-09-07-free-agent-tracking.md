# Undrafted Free Agent Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score undrafted players against an empirical undrafted-cohort expectation, grouped into the draft class of the season they first appeared, and show those numbers beside — never merged into — the existing draft numbers.

**Architecture:** A new per-year data file `public/data/fa-{year}.json` carries `FreeAgent` records that reuse `Season[]` verbatim. The scoring engine widens from `DraftPick` to `Acquisition = DraftPick | FreeAgent`, discriminated structurally on the presence of `round`, and takes its contract window from a single new `acquisitionWindow()` helper. Over-slot dispatches: the draft-slot curve for picks, a single derived scalar for free agents.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + React Testing Library, `tsx` scripts against nflverse CSV releases, CSS in `src/App.css`.

**Spec:** `docs/superpowers/specs/2026-09-07-free-agent-tracking-design.md`

## Global Constraints

- **Nothing picks-only may change value.** The rolling draft score, its over-slot, team rankings, roster rankings, highlights, the draft-score↔win-rate correlation, and `default-rankings.json` / `lagged-draft-rankings.json` keep their current definitions and outputs exactly. Widening a type is fine; changing a number is a bug.
- **Cohort membership:** undrafted in `players.csv` (no `draft_year` and no `draft_pick`), `rookie_season == Y`, and at least one snap in `snap_counts` in some season.
- **Free-agent contract window:** `FA_WINDOW = 3` seasons. Picks keep `rookieWindow(round)` (5 for round 1, 4 otherwise).
- **Class floor:** 2013, the existing `FIRST_DRAFT_YEAR`.
- **Owning team:** the franchise of the player's first snap, normalized through `normalizeNflverseTeam`.
- **TDD, always.** Test first, watch it fail, minimal implementation, watch it pass, commit.
- **Never `git commit --no-verify`.** Conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- **Copy rule:** user-facing wording is "undrafted free agents" / "undrafted", never "UDFA".
- Run `pnpm test` for the suite and `pnpm exec vitest run <path>` for one file.

---

### Task 1: `Acquisition` type and contract window

Introduces the union every later task depends on, plus the one function that knows a free agent's window is three years.

**Files:**

- Modify: `src/types.ts` (after the `DraftPick` interface, ~line 133)
- Create: `src/lib/acquisition.ts`
- Test: `src/lib/acquisition.test.ts`

**Interfaces:**

- Consumes: `DraftPick`, `Season` from `src/types.ts`; `rookieWindow` from `src/lib/rookieWindow.ts`.
- Produces:
  - `interface FreeAgent` — `playerId`, `playerName`, `position`, `teamId`, `draftYear`, `espnId?`, `headshotUrl?`, `seasons: Season[]`. No `round`, no `overallPick`.
  - `interface FreeAgentClass { year: number; freeAgents: FreeAgent[] }`
  - `type Acquisition = DraftPick | FreeAgent`
  - `isDraftPick(a: Acquisition): a is DraftPick`
  - `acquisitionWindow(a: Acquisition): number`
  - `const FA_WINDOW = 3`

- [ ] **Step 1: Write the failing test**

Create `src/lib/acquisition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { acquisitionWindow, isDraftPick, FA_WINDOW } from './acquisition';
import { makePick } from '../test/factories';
import type { FreeAgent } from '../types';

const freeAgent: FreeAgent = {
  playerId: 'fa-1',
  playerName: 'Undrafted Guy',
  position: 'ZZ',
  teamId: 'BUF',
  draftYear: 2020,
  seasons: [],
};

describe('isDraftPick', () => {
  it('is true for a pick, which carries a round', () => {
    expect(isDraftPick(makePick({ round: 3 }))).toBe(true);
  });

  it('is false for a free agent, which has no round', () => {
    expect(isDraftPick(freeAgent)).toBe(false);
  });
});

describe('acquisitionWindow', () => {
  it('gives a first-rounder five years for the fifth-year option', () => {
    expect(acquisitionWindow(makePick({ round: 1 }))).toBe(5);
  });

  it('gives a later pick four years', () => {
    expect(acquisitionWindow(makePick({ round: 4 }))).toBe(4);
  });

  it('gives a free agent three, the undrafted rookie deal', () => {
    expect(acquisitionWindow(freeAgent)).toBe(FA_WINDOW);
    expect(FA_WINDOW).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/acquisition.test.ts`
Expected: FAIL — cannot resolve `./acquisition`.

- [ ] **Step 3: Add the types**

In `src/types.ts`, directly after the `DraftPick` interface:

```ts
/**
 * A player who entered the league undrafted, grouped into the class of the
 * season he first appeared in.
 *
 * Deliberately `DraftPick` minus `round` and `overallPick` — the absence of
 * `round` is what {@link isDraftPick} discriminates on, so no `kind` tag is
 * stored and no data migration is needed. `seasons` is the identical shape, so
 * every season-level library (load, role tiering, injury forgiveness, reserve
 * weeks, rest games) applies unchanged.
 */
export interface FreeAgent {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  /**
   * The class year he belongs to: his `rookie_season`, the year he first
   * appeared. Named to match `DraftPick.draftYear` because the scoring engine
   * measures elapsed seasons from this field for picks and free agents alike.
   * Stamped from the enclosing class by `stampFreeAgentYear`, not stored in
   * `fa-{year}.json`.
   */
  draftYear: number;
  espnId?: string;
  headshotUrl?: string;
  seasons: Season[];
}

/** One year's undrafted cohort, as stored in `public/data/fa-{year}.json`. */
export interface FreeAgentClass {
  year: number;
  freeAgents: FreeAgent[];
}

/**
 * Any player a team added: drafted or undrafted. The scoring engine operates on
 * this, so the two populations share one implementation of load, role tiering
 * and score, and differ only where they genuinely differ — the contract window
 * and the expectation they are measured against.
 */
export type Acquisition = DraftPick | FreeAgent;
```

- [ ] **Step 4: Write the implementation**

Create `src/lib/acquisition.ts`:

```ts
import type { Acquisition, DraftPick } from '../types';

/**
 * Seasons an undrafted rookie contract entitles his team to.
 *
 * Three, not four. Judging a free agent over a late pick's four-year window
 * would charge him a season he was never owed — the same reasoning that gives
 * rounds 2–7 four years instead of a first-rounder's five.
 */
export const FA_WINDOW = 3;
/** Rookie deal for a first-round pick: four years plus the fifth-year option. */
const FIRST_ROUND_WINDOW = 5;
/** Rookie deal for rounds 2–7: four years, no option. */
const LATE_ROUND_WINDOW = 4;

/**
 * True when the acquisition was drafted.
 *
 * Discriminates on the presence of `round` rather than a stored `kind` tag, so
 * the existing `draft-{year}.json` files need no migration and a free agent
 * record stays exactly the fields it has.
 */
export function isDraftPick(a: Acquisition): a is DraftPick {
  return 'round' in a;
}

/**
 * How many seasons this acquisition's rookie contract entitles its team to.
 *
 * The round constants live here rather than in `rookieWindow.ts` so that module
 * can delegate to this one without a cycle: `rookieWindow.ts` already imports
 * scoring helpers, and this module must stay a leaf.
 */
export function acquisitionWindow(a: Acquisition): number {
  if (!isDraftPick(a)) return FA_WINDOW;
  return a.round === 1 ? FIRST_ROUND_WINDOW : LATE_ROUND_WINDOW;
}
```

Then update `src/lib/rookieWindow.ts` so its own `rookieWindow(round)` delegates, keeping every existing caller working and the constants defined once:

```ts
import { acquisitionWindow } from './acquisition';
import type { DraftPick } from '../types';

// (delete the local FIRST_ROUND_WINDOW / LATE_ROUND_WINDOW constants)

/** @see acquisitionWindow — the round-only entry point for existing callers. */
export function rookieWindow(round: number): number {
  return acquisitionWindow({ round } as DraftPick);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/acquisition.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Type-check and commit**

```bash
pnpm run type-check
git add src/types.ts src/lib/acquisition.ts src/lib/acquisition.test.ts
git commit -m "feat: add Acquisition union and free-agent contract window"
```

---

### Task 2: Widen the scoring engine to `Acquisition`

Pure type widening. Every existing number must stay identical — the regression test in this task is what proves it.

**Files:**

- Modify: `src/lib/rookieWindow.ts` (`scoredSeasonCount`, `scoredWindowYears`, `hasDeparted`)
- Modify: `src/lib/getPlayerRole.ts` (`getPlayerDraftScore`, `getPlayerRole`, `getPlayerAverageScoreWeight`, `getPlayerPeakRole`, `pickHasSeasonSnapData`, `computePlayerDraftScore`, the `WeakMap` memo tables)
- Modify: `src/lib/apprenticeship.ts` (`apprenticeSeasonCount`, `firstScoredYear`, `withoutApprenticeSeasons`)
- Modify: `src/lib/draftPickLatestSeason.ts` (`isDraftPickRetainedLatest`)
- Test: `src/lib/acquisitionScoring.test.ts` (new)

**Interfaces:**

- Consumes: `Acquisition`, `acquisitionWindow`, `isDraftPick` from Task 1.
- Produces: the functions above accepting `Acquisition` instead of `DraftPick`. Signatures otherwise unchanged, so no call site needs editing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/acquisitionScoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getPlayerDraftScore, getPlayerRole } from './getPlayerRole';
import { scoredSeasonCount } from './rookieWindow';
import { makeSeason } from '../test/factories';
import type { FreeAgent } from '../types';

function makeFreeAgent(overrides: Partial<FreeAgent> = {}): FreeAgent {
  return {
    playerId: 'fa-1',
    playerName: 'Undrafted Guy',
    position: 'ZZ',
    teamId: 'BUF',
    draftYear: 2019,
    seasons: [],
    ...overrides,
  };
}

describe('scoring a free agent', () => {
  it('divides by the three-year window, not four', () => {
    // Three core-starter seasons on a three-year window is a full score;
    // the same three on a late pick's four-year window would lose a quarter.
    const fa = makeFreeAgent({
      seasons: [
        makeSeason({ year: 2019 }),
        makeSeason({ year: 2020 }),
        makeSeason({ year: 2021 }),
      ],
    });
    expect(scoredSeasonCount(fa, 3)).toBe(3);
    expect(getPlayerDraftScore(fa)).toBeGreaterThan(90);
  });

  it('charges a departed free agent the rest of his window', () => {
    const fa = makeFreeAgent({
      seasons: [makeSeason({ year: 2019, retained: false })],
    });
    expect(scoredSeasonCount(fa, 1)).toBe(3);
  });

  it('classifies a role the same way it does for a pick', () => {
    const fa = makeFreeAgent({
      seasons: [
        makeSeason({ year: 2019 }),
        makeSeason({ year: 2020 }),
        makeSeason({ year: 2021 }),
      ],
    });
    expect(getPlayerRole(fa)).toBe('core_starter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/acquisitionScoring.test.ts`
Expected: FAIL — TypeScript rejects `FreeAgent` where `DraftPick` is required.

- [ ] **Step 3: Widen `rookieWindow.ts`**

Change the imports and the three signatures. In `scoredSeasonCount`, replace the window line:

```ts
// was: const window = Math.max(0, rookieWindow(pick.round) - apprenticeSeasons);
const window = Math.max(0, acquisitionWindow(pick) - apprenticeSeasons);
```

Change the parameter types of `hasDeparted`, `scoredSeasonCount` and `scoredWindowYears` from `DraftPick` to `Acquisition`. `rookieWindow(round: number)` already delegates to `acquisitionWindow` after Task 1 and needs no further change — it stays the round-only entry point for existing callers.

- [ ] **Step 4: Widen `getPlayerRole.ts`**

Replace `DraftPick` with `Acquisition` in the parameter type of `pickHasSeasonSnapData`, `getPlayerPeakRole`, `getPlayerAverageScoreWeight`, `getPlayerDraftScore`, `computePlayerDraftScore`, `getPlayerRole`, and `getFilteredSeasons`. Widen the memo tables:

```ts
const scoreByPick = [
  new WeakMap<Acquisition, number>(),
  new WeakMap<Acquisition, number>(),
] as const;
const roleByPick = [
  new WeakMap<Acquisition, Role>(),
  new WeakMap<Acquisition, Role>(),
] as const;
```

- [ ] **Step 5: Widen `apprenticeship.ts` and `draftPickLatestSeason.ts`**

Change `DraftPick` to `Acquisition` in the parameter types of `apprenticeSeasonCount`, `firstScoredYear`, `withoutApprenticeSeasons` and `isDraftPickRetainedLatest`. None of them read `round` or `overallPick`, so the bodies are unchanged. The QB apprenticeship rule now applies to undrafted quarterbacks, which is intended.

- [ ] **Step 6: Run the new test and the whole suite**

Run: `pnpm exec vitest run src/lib/acquisitionScoring.test.ts && pnpm test`
Expected: the new file PASSES and **every pre-existing test still passes with no changed expectations**. If any existing expectation moved, a number changed — stop and fix the widening rather than the test.

- [ ] **Step 7: Type-check and commit**

```bash
pnpm run type-check
git add src/lib
git commit -m "refactor: widen scoring engine from DraftPick to Acquisition"
```

---

### Task 3: Free-agent cohort selection (pure)

The rule that decides who is in a year's free-agent round, extracted from the data script so it can be tested without a network call.

**Files:**

- Create: `src/lib/freeAgentCohort.ts`
- Test: `src/lib/freeAgentCohort.test.ts`

**Interfaces:**

- Produces:
  - `interface NflversePlayerRow { pfrId: string; gsisId: string; position: string; rookieSeason: number | null; draftYear: number | null; draftPick: number | null; headshot: string; espnId: string; playerName: string }`
  - `isUndraftedRookieOf(row: NflversePlayerRow, year: number): boolean`
  - `const FA_FIRST_CLASS_YEAR = 2013`

- [ ] **Step 1: Write the failing test**

Create `src/lib/freeAgentCohort.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isUndraftedRookieOf, type NflversePlayerRow } from './freeAgentCohort';

function row(overrides: Partial<NflversePlayerRow> = {}): NflversePlayerRow {
  return {
    pfrId: 'AbcdEf00',
    gsisId: '00-0012345',
    playerName: 'Undrafted Guy',
    position: 'WR',
    rookieSeason: 2020,
    draftYear: null,
    draftPick: null,
    headshot: '',
    espnId: '',
    ...overrides,
  };
}

describe('isUndraftedRookieOf', () => {
  it('accepts an undrafted player whose rookie season is the class year', () => {
    expect(isUndraftedRookieOf(row(), 2020)).toBe(true);
  });

  it('rejects him for any other class year', () => {
    expect(isUndraftedRookieOf(row(), 2021)).toBe(false);
  });

  it('rejects a drafted player, who already has a class', () => {
    expect(
      isUndraftedRookieOf(row({ draftYear: 2020, draftPick: 201 }), 2020),
    ).toBe(false);
  });

  it('rejects a player drafted but with no recorded pick number', () => {
    expect(isUndraftedRookieOf(row({ draftYear: 2020 }), 2020)).toBe(false);
  });

  it('rejects a player with no rookie season recorded', () => {
    expect(isUndraftedRookieOf(row({ rookieSeason: null }), 2020)).toBe(false);
  });

  it('rejects a veteran whose rookie season predates the data window', () => {
    expect(isUndraftedRookieOf(row({ rookieSeason: 2009 }), 2013)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/freeAgentCohort.test.ts`
Expected: FAIL — cannot resolve `./freeAgentCohort`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/freeAgentCohort.ts`:

```ts
/**
 * Who belongs in a year's undrafted free-agent round.
 *
 * Membership is decided from `players.csv` alone — `rookie_season` is
 * authoritative rather than a first-snap heuristic, so a veteran whose earliest
 * snap happens to land inside the data window is never mislabeled a
 * first-timer. The snap requirement (at least one snap, ever) is applied by the
 * caller, which is the only party holding snap data.
 */

/** Earliest class the site tracks; matches the draft's `FIRST_DRAFT_YEAR`. */
export const FA_FIRST_CLASS_YEAR = 2013;

/** The `players.csv` fields the cohort rule reads, already parsed. */
export interface NflversePlayerRow {
  pfrId: string;
  gsisId: string;
  playerName: string;
  position: string;
  rookieSeason: number | null;
  draftYear: number | null;
  draftPick: number | null;
  headshot: string;
  espnId: string;
}

/**
 * True when this player entered the league undrafted in `year`.
 *
 * A recorded `draftYear` *or* `draftPick` disqualifies him: nflverse rows are
 * inconsistent about which draft columns are populated, and a player with one
 * but not the other is a drafted player with a gap in his record, not an
 * undrafted one.
 */
export function isUndraftedRookieOf(
  row: NflversePlayerRow,
  year: number,
): boolean {
  if (year < FA_FIRST_CLASS_YEAR) return false;
  if (row.draftYear != null || row.draftPick != null) return false;
  return row.rookieSeason === year;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/freeAgentCohort.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/freeAgentCohort.ts src/lib/freeAgentCohort.test.ts
git commit -m "feat: add undrafted free-agent cohort rule"
```

---

### Task 4: Emit `fa-{year}.json` from the data script

**Files:**

- Modify: `scripts/update-data.ts` — `loadNflversePlayers` (~line 715), the `PickSources` interface (~line 1075), `buildDraftPick` (~line 1092), and `main()`'s per-year loop (~line 1296)
- Test: manual run (this script has no unit tests today; its testable rule lives in Task 3)

**Interfaces:**

- Consumes: `isUndraftedRookieOf`, `NflversePlayerRow`, `FA_FIRST_CLASS_YEAR` from Task 3.
- Produces: `public/data/fa-{year}.json` files shaped `{ year, freeAgents: Omit<FreeAgent,'draftYear'>[] }`.

- [ ] **Step 1: Extend the players loader**

In `loadNflversePlayers`, add a third return value alongside `headshots` and `metaByPfrId`:

```ts
const playerRows: NflversePlayerRow[] = [];
// ...inside the existing row loop, after the pfrId guard:
playerRows.push({
  pfrId,
  gsisId: (row.gsis_id ?? '').trim(),
  playerName: (row.display_name ?? row.full_name ?? '').trim(),
  position: (row.position ?? '').trim(),
  rookieSeason: intOrNull(row.rookie_season),
  draftYear: intOrNull(row.draft_year),
  draftPick: intOrNull(row.draft_pick),
  headshot,
  espnId: (row.espn_id ?? '').trim(),
});
```

with a small helper beside it:

```ts
/** Parse an nflverse integer column, treating blank and non-numeric as absent. */
function intOrNull(raw: string | undefined): number | null {
  const n = parseInt((raw ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}
```

Return `{ headshots, metaByPfrId, playerRows }` and widen the declared return type.

- [ ] **Step 2: Add the free-agent builder**

Beside `buildDraftPick`, add:

```ts
/**
 * Build one free-agent record, with a season row for every year from his rookie
 * season through the newest played one — the same shape `buildDraftPick`
 * produces, so every scoring library treats the two identically.
 *
 * `teamId` is the franchise of his first snap: for an undrafted player that is
 * the team that signed and played him, and it fills the role the drafting team
 * fills for a pick.
 */
function buildFreeAgent(
  row: NflversePlayerRow,
  year: number,
  teamId: string,
  sources: PickSources,
): Omit<FreeAgent, 'draftYear'> {
  const playerSnaps = sources.snapData.get(row.pfrId);
  const playerInjuries = row.gsisId
    ? sources.injuryData.get(row.gsisId)
    : undefined;
  const playerReserve = row.gsisId
    ? sources.reserveData.get(row.gsisId)
    : undefined;

  const seasons: PickSeason[] = [];
  for (let s = year; s <= sources.maxSeason; s++) {
    seasons.push(
      buildPickSeason({
        season: s,
        teamId,
        playerSnaps,
        playerInjuries,
        playerReserve,
        loadedReserveSeasons: sources.loadedReserveSeasons,
        lookups: sources.lookups,
      }),
    );
  }

  if (sources.roster && year <= sources.maxSeason) {
    const offseason = buildOffseasonSeason({
      roster: sources.roster,
      gsisId: row.gsisId,
      pfrId: row.pfrId,
      teamId,
      seasons,
      maxSeason: sources.maxSeason,
    });
    if (offseason) seasons.push(offseason);
  }

  const headshotUrl = sources.headshots.get(row.pfrId);
  return {
    playerId: row.pfrId,
    playerName: row.playerName,
    position: row.position || (sources.lookups ? 'ZZ' : 'ZZ'),
    teamId,
    ...(row.espnId ? { espnId: row.espnId } : {}),
    ...(headshotUrl ? { headshotUrl } : {}),
    seasons,
  };
}
```

Read `buildDraftPick`'s tail before writing this and mirror exactly how it assembles `espnId`, `headshotUrl`, and `position` — the point is that a free agent record is indistinguishable from a pick record minus `round`/`overallPick`.

- [ ] **Step 3: Resolve each free agent's first-snap team**

Add a helper that reads the already-loaded `snapData`:

```ts
/**
 * The franchise a player took his first snap for, and the season he took it —
 * `null` when he never took one, which excludes him from the cohort.
 *
 * The team is normalized, so a player whose first snaps came for the Chargers
 * in San Diego is credited to the same franchise as one in Los Angeles.
 */
function firstSnapTeam(
  pfrId: string,
  snapData: SnapDataIndex,
): { teamId: string; season: number } | null {
  // Walk seasons ascending; within the first season with snaps, take the team
  // with the most snaps (a player split across two teams belongs to the one
  // that actually played him).
}
```

Implement it against whatever `snapData`'s concrete type is in this file — read `loadSnapData`'s return type first and use it verbatim rather than inventing `SnapDataIndex`.

- [ ] **Step 4: Write the files in `main()`**

After the existing per-year draft loop, add:

```ts
console.log('Building undrafted free-agent classes...');
const faYears = seasonRange(FA_FIRST_CLASS_YEAR, maxSeason);
for (const year of faYears) {
  const freeAgents: Omit<FreeAgent, 'draftYear'>[] = [];
  for (const row of playerRows) {
    if (!isUndraftedRookieOf(row, year)) continue;
    const first = firstSnapTeam(row.pfrId, snapData);
    if (!first) continue; // never took a snap: not in the cohort
    freeAgents.push(buildFreeAgent(row, year, first.teamId, sources));
  }
  const outPath = path.join(outDir, `fa-${year}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ year, freeAgents }, null, 2));
  console.log(`  Wrote ${freeAgents.length} free agents to ${outPath}`);
}
```

- [ ] **Step 5: Run the script and sanity-check the output**

```bash
pnpm exec tsx scripts/update-data.ts
ls -la public/data/fa-*.json
python3 -c "
import json
d=json.load(open('public/data/fa-2023.json'))
print('count', len(d['freeAgents']))
print('teams', len({f['teamId'] for f in d['freeAgents']}))
print('sample', d['freeAgents'][0]['playerName'], d['freeAgents'][0]['position'])
assert 60 <= len(d['freeAgents']) <= 200, 'cohort size off — expected ~104 for 2023'
assert all(f['seasons'] for f in d['freeAgents']), 'every member must have season rows'
"
```

Expected: roughly 104 players for 2023, spread across most of the 32 teams, every record carrying season rows.

- [ ] **Step 6: Verify nothing picks-only moved**

```bash
git diff --stat public/data/draft-*.json
```

Expected: **no changes to any `draft-{year}.json`.** If the draft files moved, the script's shared code was altered — revert that part.

- [ ] **Step 7: Commit**

```bash
git add scripts/update-data.ts public/data/fa-*.json
git commit -m "feat: emit undrafted free-agent classes from the data script"
```

---

### Task 5: Load free-agent classes in the app

**Files:**

- Create: `src/lib/freeAgentClass.ts`
- Test: `src/lib/freeAgentClass.test.ts`
- Modify: `src/lib/loadData.ts` (add loaders after `loadDataForYears`, ~line 88)
- Modify: `src/lib/loadData.test.ts` (add cases)

**Interfaces:**

- Consumes: `FreeAgentClass`, `FreeAgent` from Task 1; `withoutRestGame` from `src/lib/restGame.ts`.
- Produces:
  - `interface RawFreeAgentClass { year: number; freeAgents: Omit<FreeAgent, 'draftYear'>[] }`
  - `stampFreeAgentYear(cls: RawFreeAgentClass): FreeAgentClass`
  - `loadFreeAgentClass(year: string): Promise<FreeAgentClass>`
  - `loadFreeAgentsForYears(years: number[]): Promise<FreeAgentClass[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/freeAgentClass.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeSeason } from '../test/factories';

describe('stampFreeAgentYear', () => {
  it('stamps the class year onto every free agent', () => {
    const stamped = stampFreeAgentYear({
      year: 2021,
      freeAgents: [
        {
          playerId: 'a',
          playerName: 'A',
          position: 'ZZ',
          teamId: 'BUF',
          seasons: [makeSeason({ year: 2021 })],
        },
      ],
    });
    expect(stamped.freeAgents[0].draftYear).toBe(2021);
  });

  it('subtracts a rested finale, exactly as the draft path does', () => {
    const stamped = stampFreeAgentYear({
      year: 2021,
      freeAgents: [
        {
          playerId: 'a',
          playerName: 'A',
          position: 'ZZ',
          teamId: 'BUF',
          seasons: [
            makeSeason({
              year: 2021,
              restGame: {
                playerGames: 1,
                playerShareSum: 0.9,
                playerSnaps: 60,
                teamSnaps: 65,
              },
            }),
          ],
        },
      ],
    });
    expect(stamped.freeAgents[0].seasons[0].restGame).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/freeAgentClass.test.ts`
Expected: FAIL — cannot resolve `./freeAgentClass`.

- [ ] **Step 3: Write `freeAgentClass.ts`**

```ts
import type { FreeAgent, FreeAgentClass } from '../types';
import { withoutRestGame } from './restGame';

/**
 * A free-agent class as it exists in `fa-{year}.json`: the stored shape, minus
 * the `draftYear` that is stamped at parse time.
 *
 * Mirrors `RawDraftClass` deliberately — see `stampDraftYear` for why the year
 * is stamped per player rather than read from the enclosing class at score
 * time, and why rest-game subtraction belongs at this single parse point.
 */
export interface RawFreeAgentClass {
  year: number;
  freeAgents: Omit<FreeAgent, 'draftYear'>[];
}

/**
 * Prepares a freshly-parsed free-agent class: stamps each player's class year
 * and subtracts any rested finale from his seasons.
 *
 * Every path that parses `fa-{year}.json` must call this. A missed call leaves
 * `draftYear` undefined and scores the class `NaN`.
 */
export function stampFreeAgentYear(cls: RawFreeAgentClass): FreeAgentClass {
  const stamped = cls as FreeAgentClass;
  for (const fa of stamped.freeAgents) {
    fa.draftYear = stamped.year;
    fa.seasons = fa.seasons.map(withoutRestGame);
  }
  return stamped;
}
```

- [ ] **Step 4: Add the loaders**

In `src/lib/loadData.ts`, after `loadDataForYears`:

```ts
/**
 * Load the undrafted free-agent class for a year from
 * `public/data/fa-{year}.json`.
 *
 * A separate file from `draft-{year}.json` on purpose: the draft payload and
 * its load path stay untouched, and this is fetched only by views that show it.
 */
export async function loadFreeAgentClass(
  year: string,
): Promise<FreeAgentClass> {
  return cached(`fa-${year}`, async () =>
    stampFreeAgentYear(
      await fetchJson<RawFreeAgentClass>(
        `fa-${year}.json`,
        `free agent data for ${year}`,
      ),
    ),
  );
}

/** Load free-agent classes for multiple years in parallel, oldest first. */
export async function loadFreeAgentsForYears(
  years: number[],
): Promise<FreeAgentClass[]> {
  const results = await Promise.all(
    years.map((y) => loadFreeAgentClass(String(y))),
  );
  return [...results].sort((a, b) => a.year - b.year);
}
```

- [ ] **Step 5: Add a loader test**

Append to `src/lib/loadData.test.ts`, following the fetch-stub pattern already in that file:

```ts
it('loads and stamps a free agent class', async () => {
  // stub fetch to return { year: 2021, freeAgents: [...] } for fa-2021.json,
  // matching the existing stub helper in this file
  const [cls] = await loadFreeAgentsForYears([2021]);
  expect(cls.year).toBe(2021);
  expect(cls.freeAgents[0].draftYear).toBe(2021);
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm exec vitest run src/lib/freeAgentClass.test.ts src/lib/loadData.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/freeAgentClass.ts src/lib/freeAgentClass.test.ts src/lib/loadData.ts src/lib/loadData.test.ts
git commit -m "feat: load undrafted free-agent classes"
```

---

### Task 6: Free-agent expectation baseline

**Files:**

- Create: `src/lib/deriveFreeAgentBaseline.ts`
- Test: `src/lib/deriveFreeAgentBaseline.test.ts`
- Create: `scripts/derive-fa-baseline.ts`
- Create: `src/data/fa-baseline.json` (written by the script)
- Modify: `src/types.ts` (add `FreeAgentBaselineData`)
- Modify: `package.json` (add the script to `update-data`)

**Interfaces:**

- Consumes: `FreeAgentClass` (Task 1), `stampFreeAgentYear` (Task 5), `getPlayerDraftScore` and `pickHasSeasonSnapData` (Task 2), `DRAFT_SLOT_MATURITY_LAG` from `src/lib/deriveDraftSlotBaseline.ts`.
- Produces:
  - `interface FreeAgentBaselineData { generatedAt: string; method: string; matureFrom: number; matureTo: number; playerCount: number; expected: number }`
  - `deriveFreeAgentBaseline(classes: FreeAgentClass[]): { expected: number; playerCount: number; matureFrom: number | null; matureTo: number | null }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/deriveFreeAgentBaseline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveFreeAgentBaseline } from './deriveFreeAgentBaseline';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeSeason } from '../test/factories';

function classOf(year: number, shares: number[]) {
  return stampFreeAgentYear({
    year,
    freeAgents: shares.map((snapShare, i) => ({
      playerId: `fa-${year}-${i}`,
      playerName: `FA ${i}`,
      position: 'ZZ',
      teamId: 'BUF',
      seasons: [
        makeSeason({ year, snapShare }),
        makeSeason({ year: year + 1, snapShare }),
        makeSeason({ year: year + 2, snapShare }),
      ],
    })),
  });
}

describe('deriveFreeAgentBaseline', () => {
  it('averages the scores of members with season data', () => {
    const result = deriveFreeAgentBaseline([classOf(2014, [0.9, 0.1])]);
    expect(result.playerCount).toBe(2);
    expect(result.expected).toBeGreaterThan(0);
    expect(result.expected).toBeLessThan(100);
  });

  it('ignores classes too young to have played out their window', () => {
    // Maturity is relative to the newest class present, exactly as
    // collectMatureDraftSlotPoints measures it: with 2020 in the set, the
    // cutoff is 2017 and the 2019 class is excluded.
    const result = deriveFreeAgentBaseline([
      classOf(2014, [0.9]),
      classOf(2019, [0.1]),
      classOf(2020, [0.1]),
    ]);
    expect(result.playerCount).toBe(1);
    expect(result.matureFrom).toBe(2014);
    expect(result.matureTo).toBe(2014);
  });

  it('reports no baseline when nothing is mature enough to fit', () => {
    const result = deriveFreeAgentBaseline([
      classOf(2019, [0.9]),
      classOf(2020, [0.9]),
    ]);
    expect(result.playerCount).toBe(0);
    expect(result.matureFrom).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/deriveFreeAgentBaseline.test.ts`
Expected: FAIL — cannot resolve `./deriveFreeAgentBaseline`.

- [ ] **Step 3: Write the derivation**

Create `src/lib/deriveFreeAgentBaseline.ts`:

```ts
import type { FreeAgentClass } from '../types';
import { getPlayerDraftScore, pickHasSeasonSnapData } from './getPlayerRole';
import { DRAFT_SLOT_MATURITY_LAG } from './deriveDraftSlotBaseline';

/**
 * Fit in drafting-team mode, matching `FIT_SCORE_OPTIONS` in
 * `deriveDraftSlotBaseline.ts`. The two expectations must be fit on the same
 * basis or a free agent's residual and a pick's would not be comparable.
 */
const FIT_SCORE_OPTIONS = { draftingTeamOnly: true } as const;

/**
 * The score an undrafted free agent is *expected* to earn — the cohort's own
 * mean, over classes old enough to have played out their window.
 *
 * A single scalar rather than the per-slot curve picks get, because there is no
 * slot dimension here to vary along: position baselines already normalize load
 * before scoring, so what remains is one population with one expectation.
 *
 * Scored in drafting-team mode, matching how the draft-slot curve is fit, so
 * free-agent and pick over-slot are computed on the same basis and read
 * sensibly side by side.
 *
 * Because it is the cohort's own mean, free-agent over-slot is centered on zero
 * by construction: it ranks teams against each other and can never say the
 * league as a whole is good or bad at signing undrafted players. The Info modal
 * states that.
 */
export function deriveFreeAgentBaseline(classes: FreeAgentClass[]): {
  expected: number;
  playerCount: number;
  matureFrom: number | null;
  matureTo: number | null;
} {
  // Maturity relative to the newest class present, exactly as
  // `collectMatureDraftSlotPoints` measures it.
  const cutoff =
    classes.reduce((max, c) => Math.max(max, c.year), -Infinity) -
    DRAFT_SLOT_MATURITY_LAG;

  let sum = 0;
  let playerCount = 0;
  let matureFrom: number | null = null;
  let matureTo: number | null = null;
  for (const cls of classes) {
    if (cls.year > cutoff) continue;
    for (const fa of cls.freeAgents) {
      if (!pickHasSeasonSnapData(fa)) continue;
      sum += getPlayerDraftScore(fa, FIT_SCORE_OPTIONS);
      playerCount += 1;
      matureFrom =
        matureFrom == null ? cls.year : Math.min(matureFrom, cls.year);
      matureTo = matureTo == null ? cls.year : Math.max(matureTo, cls.year);
    }
  }

  return {
    expected: playerCount > 0 ? sum / playerCount : 0,
    playerCount,
    matureFrom,
    matureTo,
  };
}
```

The cutoff and the scoring options above are copied from `collectMatureDraftSlotPoints` in `src/lib/deriveDraftSlotBaseline.ts`. Read that function before writing this one and mirror it exactly — if it has changed, follow it rather than this snippet.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/deriveFreeAgentBaseline.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the type and the script**

In `src/types.ts`:

```ts
/** Written by `scripts/derive-fa-baseline.ts` as `src/data/fa-baseline.json`. */
export interface FreeAgentBaselineData {
  generatedAt: string;
  method: string;
  matureFrom: number;
  matureTo: number;
  playerCount: number;
  /** Mean score of the mature undrafted cohort, on the 0–100 scale. */
  expected: number;
}
```

Create `scripts/derive-fa-baseline.ts`, modeled directly on `scripts/derive-draft-slot-baseline.ts`:

```ts
#!/usr/bin/env npx tsx
/**
 * Derive the undrafted free-agent expectation and write
 * src/data/fa-baseline.json.
 *
 * Reads local `public/data/fa-{year}.json` only (no network), so it is safe to
 * run at build time. Run: npx tsx scripts/derive-fa-baseline.ts
 * Also runs automatically as part of `pnpm update-data`.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { FreeAgentBaselineData } from '../src/types';
import { stampFreeAgentYear } from '../src/lib/freeAgentClass';
import { deriveFreeAgentBaseline } from '../src/lib/deriveFreeAgentBaseline';
import { DRAFT_SLOT_MATURITY_LAG } from '../src/lib/deriveDraftSlotBaseline';

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => /^fa-\d{4}\.json$/.test(f));

  if (files.length === 0) {
    throw new Error(`No fa-{year}.json files found in ${dataDir}`);
  }

  const classes = files.map((file) =>
    stampFreeAgentYear(
      JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8')),
    ),
  );

  const { expected, playerCount, matureFrom, matureTo } =
    deriveFreeAgentBaseline(classes);
  if (matureFrom == null || matureTo == null || playerCount === 0) {
    throw new Error(
      'No mature free-agent classes with season data to fit the baseline.',
    );
  }

  const output: FreeAgentBaselineData = {
    generatedAt: new Date().toISOString().slice(0, 10),
    method:
      `mean draft score of undrafted players with season data; ` +
      `classes ≥ ${DRAFT_SLOT_MATURITY_LAG} yrs old`,
    matureFrom,
    matureTo,
    playerCount,
    expected: +expected.toFixed(2),
  };

  const outPath = path.join(process.cwd(), 'src', 'data', 'fa-baseline.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(
    `Wrote ${outPath} — expected ${output.expected} from ${playerCount} ` +
      `free agents in ${matureFrom}–${matureTo}`,
  );
}

main();
```

- [ ] **Step 6: Wire into package.json and run it**

Add `derive-fa-baseline` to the `scripts` block and into the `update-data` chain, right after `derive-draft-slot-baseline`:

```json
"derive-fa-baseline": "tsx scripts/derive-fa-baseline.ts",
```

```bash
pnpm run derive-fa-baseline
cat src/data/fa-baseline.json
```

Expected: an `expected` value well below the draft-wide mean — a low double digit or single digit. If it lands near a late-round pick's expectation, re-check the cohort filter in Task 4.

- [ ] **Step 7: Commit**

```bash
pnpm run type-check
git add src/lib/deriveFreeAgentBaseline.ts src/lib/deriveFreeAgentBaseline.test.ts scripts/derive-fa-baseline.ts src/data/fa-baseline.json src/types.ts package.json
git commit -m "feat: derive undrafted free-agent expectation baseline"
```

---

### Task 7: Over-slot dispatch

One function every UI surface calls, so a row never has to know which population it is showing.

**Files:**

- Create: `src/lib/overSlot.ts`
- Test: `src/lib/overSlot.test.ts`

**Interfaces:**

- Consumes: `isDraftPick` (Task 1), `expectedScoreForPick` and `getPlayerDraftSkill` from `src/lib/draftSlotBaseline.ts`, `fa-baseline.json` (Task 6).
- Produces:
  - `expectedScoreForFreeAgent(): number`
  - `expectedScoreForAcquisition(a: Acquisition): number`
  - `getAcquisitionOverSlot(a: Acquisition, options?: GetPlayerRoleOptions): number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/overSlot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  expectedScoreForAcquisition,
  expectedScoreForFreeAgent,
  getAcquisitionOverSlot,
} from './overSlot';
import { getPlayerDraftSkill } from './draftSlotBaseline';
import { makePick, makeSeason } from '../test/factories';
import type { FreeAgent } from '../types';

const productiveFreeAgent: FreeAgent = {
  playerId: 'fa-1',
  playerName: 'Undrafted Guy',
  position: 'ZZ',
  teamId: 'BUF',
  draftYear: 2019,
  seasons: [
    makeSeason({ year: 2019 }),
    makeSeason({ year: 2020 }),
    makeSeason({ year: 2021 }),
  ],
};

describe('expectedScoreForAcquisition', () => {
  it('reads the slot curve for a pick', () => {
    const pick = makePick({ round: 1, overallPick: 1 });
    expect(expectedScoreForAcquisition(pick)).toBeGreaterThan(50);
  });

  it('reads the cohort scalar for a free agent', () => {
    expect(expectedScoreForAcquisition(productiveFreeAgent)).toBe(
      expectedScoreForFreeAgent(),
    );
  });

  it('expects far less of a free agent than of any pick', () => {
    expect(expectedScoreForFreeAgent()).toBeLessThan(
      expectedScoreForAcquisition(makePick({ round: 7, overallPick: 260 })),
    );
  });
});

describe('getAcquisitionOverSlot', () => {
  it('matches the existing pick path exactly', () => {
    const pick = makePick({
      round: 3,
      overallPick: 80,
      seasons: [makeSeason({ year: 2021 })],
    });
    expect(getAcquisitionOverSlot(pick)).toBe(getPlayerDraftSkill(pick));
  });

  it('credits a productive free agent well above his cohort', () => {
    expect(getAcquisitionOverSlot(productiveFreeAgent)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/overSlot.test.ts`
Expected: FAIL — cannot resolve `./overSlot`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/overSlot.ts`:

```ts
import faBaseline from '../data/fa-baseline.json';
import type { Acquisition } from '../types';
import { isDraftPick } from './acquisition';
import { expectedScoreForPick } from './draftSlotBaseline';
import {
  getPlayerDraftScore,
  type GetPlayerRoleOptions,
} from './getPlayerRole';

/**
 * What an undrafted free agent is expected to earn: the cohort's own mean, from
 * `src/data/fa-baseline.json`. See `deriveFreeAgentBaseline` for why it is one
 * scalar and what that implies for how the residual reads.
 */
export function expectedScoreForFreeAgent(): number {
  return faBaseline.expected;
}

/**
 * What this acquisition was expected to earn, given only how it was acquired:
 * the empirical slot curve for a pick, the cohort mean for a free agent.
 *
 * The dispatch lives here rather than at each call site so a UI row can show a
 * mixed list without branching, and so the two populations can never drift onto
 * different definitions of the residual.
 */
export function expectedScoreForAcquisition(a: Acquisition): number {
  return isDraftPick(a)
    ? expectedScoreForPick(a.overallPick)
    : expectedScoreForFreeAgent();
}

/**
 * Score above expectation ("over slot"): positive means the player outplayed
 * what his acquisition route predicted. Same units for picks and free agents.
 */
export function getAcquisitionOverSlot(
  a: Acquisition,
  options?: GetPlayerRoleOptions,
): number {
  return getPlayerDraftScore(a, options) - expectedScoreForAcquisition(a);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/overSlot.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/overSlot.ts src/lib/overSlot.test.ts
git commit -m "feat: dispatch over-slot expectation by acquisition route"
```

---

### Task 8: Team free-agent aggregates

**Files:**

- Create: `src/lib/getFreeAgentScore.ts`
- Test: `src/lib/getFreeAgentScore.test.ts`

**Interfaces:**

- Consumes: `FreeAgentClass` (Task 1), `getPlayerDraftScore` / `getPlayerRole` / `pickHasSeasonSnapData` (Task 2), `getAcquisitionOverSlot` (Task 7), `isDraftPickRetainedLatest` (Task 2).
- Produces:
  - `interface FreeAgentScore { score: number; skillScore: number; totalFreeAgents: number; scoredCount: number; coreStarterRate: number; coreStarterCount: number; retentionRate: number; retainedCount: number }`
  - `getTeamFreeAgents(classes: FreeAgentClass[], teamId: string): FreeAgent[]`
  - `getFreeAgentScore(classes, teamId, options?): FreeAgentScore`

- [ ] **Step 1: Write the failing test**

Create `src/lib/getFreeAgentScore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getFreeAgentScore, getTeamFreeAgents } from './getFreeAgentScore';
import { stampFreeAgentYear } from './freeAgentClass';
import { makeSeason } from '../test/factories';

function classWith(
  year: number,
  members: {
    id: string;
    teamId: string;
    snapShare?: number;
    retained?: boolean;
  }[],
) {
  return stampFreeAgentYear({
    year,
    freeAgents: members.map((m) => ({
      playerId: m.id,
      playerName: m.id,
      position: 'ZZ',
      teamId: m.teamId,
      seasons: [
        makeSeason({
          year,
          snapShare: m.snapShare ?? 0.9,
          retained: m.retained ?? true,
        }),
      ],
    })),
  });
}

describe('getTeamFreeAgents', () => {
  it('returns only the requested team, in class order', () => {
    const classes = [
      classWith(2020, [
        { id: 'a', teamId: 'BUF' },
        { id: 'b', teamId: 'NYJ' },
      ]),
      classWith(2021, [{ id: 'c', teamId: 'BUF' }]),
    ];
    expect(getTeamFreeAgents(classes, 'BUF').map((f) => f.playerId)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('getFreeAgentScore', () => {
  it('averages over members with season data', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'BUF' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result.scoredCount).toBe(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it('reports over-slot against the free-agent baseline, not a draft slot', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'BUF' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result.skillScore).toBeGreaterThan(0);
    expect(result.skillScore).toBeLessThan(result.score);
  });

  it('returns zeroes for a team with no free agents', () => {
    const classes = [classWith(2020, [{ id: 'a', teamId: 'NYJ' }])];
    const result = getFreeAgentScore(classes, 'BUF');
    expect(result).toMatchObject({
      score: 0,
      skillScore: 0,
      totalFreeAgents: 0,
      scoredCount: 0,
      coreStarterRate: 0,
      retentionRate: 0,
    });
  });

  it('counts a departed free agent against retention', () => {
    const classes = [
      classWith(2020, [{ id: 'a', teamId: 'BUF', retained: false }]),
    ];
    expect(getFreeAgentScore(classes, 'BUF').retentionRate).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/getFreeAgentScore.test.ts`
Expected: FAIL — cannot resolve `./getFreeAgentScore`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/getFreeAgentScore.ts`, mirroring `getRollingDraftScore`'s body exactly except for the population and the expectation:

```ts
import type { FreeAgent, FreeAgentClass } from '../types';
import {
  getPlayerDraftScore,
  getPlayerRole,
  pickHasSeasonSnapData,
  type GetPlayerRoleOptions,
} from './getPlayerRole';
import { getAcquisitionOverSlot } from './overSlot';
import { isDraftPickRetainedLatest } from './draftPickLatestSeason';

/**
 * A team's undrafted free-agent record over the loaded classes.
 *
 * Reported beside the rolling draft score, never merged into it: the draft
 * number and every ranking derived from it keep their existing meaning, and a
 * team that develops undrafted players gets credit on its own axis.
 */
export interface FreeAgentScore {
  score: number;
  /** Mean score above the undrafted cohort's own expectation. */
  skillScore: number;
  totalFreeAgents: number;
  scoredCount: number;
  coreStarterRate: number;
  coreStarterCount: number;
  retentionRate: number;
  retainedCount: number;
}

/** One team's free agents across `classes`, in class order. */
export function getTeamFreeAgents(
  classes: FreeAgentClass[],
  teamId: string,
): FreeAgent[] {
  const out: FreeAgent[] = [];
  for (const cls of classes) {
    for (const fa of cls.freeAgents) {
      if (fa.teamId === teamId) out.push(fa);
    }
  }
  return out;
}

export function getFreeAgentScore(
  classes: FreeAgentClass[],
  teamId: string,
  options?: GetPlayerRoleOptions,
): FreeAgentScore {
  const opts = { draftingTeamOnly: options?.draftingTeamOnly === true };
  const all = getTeamFreeAgents(classes, teamId);
  const scored = all.filter(pickHasSeasonSnapData);

  let scoreSum = 0;
  let skillSum = 0;
  let coreStarterCount = 0;
  let retainedCount = 0;
  for (const fa of scored) {
    scoreSum += getPlayerDraftScore(fa, opts);
    skillSum += getAcquisitionOverSlot(fa, opts);
    if (getPlayerRole(fa, opts) === 'core_starter') coreStarterCount += 1;
    if (isDraftPickRetainedLatest(fa)) retainedCount += 1;
  }

  const scoredCount = scored.length;
  return {
    score: scoredCount > 0 ? scoreSum / scoredCount : 0,
    skillScore: scoredCount > 0 ? skillSum / scoredCount : 0,
    totalFreeAgents: all.length,
    scoredCount,
    coreStarterRate: scoredCount > 0 ? coreStarterCount / scoredCount : 0,
    coreStarterCount,
    retentionRate: scoredCount > 0 ? retainedCount / scoredCount : 0,
    retainedCount,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/getFreeAgentScore.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/getFreeAgentScore.ts src/lib/getFreeAgentScore.test.ts
git commit -m "feat: aggregate a team's undrafted free-agent record"
```

---

### Task 9: Load free-agent classes in `App.tsx`

**Files:**

- Modify: `src/App.tsx` — add a loader hook beside `useDraftClassLoader` (~line 377), thread `freeAgentClasses` to `TeamDetailContent` and `YearDraftView`
- Test: `src/App.freeAgents.test.tsx` (new)

**Interfaces:**

- Consumes: `loadFreeAgentsForYears` (Task 5).
- Produces: `freeAgentClasses: FreeAgentClass[]` prop on `TeamDetailContent` and `YearDraftView`.

- [ ] **Step 1: Write the failing test**

Create `src/App.freeAgents.test.tsx`, following the fetch-stub pattern in `src/App.dataLoading.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

describe('free agent loading', () => {
  it('renders the undrafted section for a team once fa data loads', async () => {
    // stub fetch for draft-{year}.json and fa-{year}.json, render the app at
    // /BUF, then:
    expect(
      await screen.findByRole('heading', { name: /undrafted free agents/i }),
    ).toBeInTheDocument();
  });

  it('still renders the team when fa data is missing', async () => {
    // stub fa-{year}.json to 404; the draft view must still render and no
    // error banner may appear
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/App.freeAgents.test.tsx`
Expected: FAIL — no such heading.

- [ ] **Step 3: Add the loader hook**

In `src/App.tsx`, beside `useDraftClassLoader`:

```tsx
/**
 * Loads the undrafted free-agent classes for a year range.
 *
 * Failures are swallowed to an empty list rather than surfaced: free agents are
 * a side panel, and a deploy whose `fa-{year}.json` files have not been
 * generated yet must still render the draft view it has always rendered.
 */
function useFreeAgentClassLoader(
  startYear: number,
  endYear: number,
): FreeAgentClass[] {
  const [classes, setClasses] = useState<FreeAgentClass[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadFreeAgentsForYears(generateYearArray(startYear, endYear))
      .then((data) => {
        if (!cancelled) setClasses(data);
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [startYear, endYear]);

  return classes;
}
```

Call it next to the existing `useDraftClassLoader` call and pass `freeAgentClasses` down to `TeamDetailContent` and `YearDraftView`.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run src/App.freeAgents.test.tsx`
Expected: PASS on the missing-data case. The heading test cannot pass until Task 10 builds the section, so **write it as `it.todo(...)` in this task with the assertion body intact but commented above it**, and Task 10 restores it to `it(...)`. The repo's pre-commit hook runs the whole suite, so a knowingly-failing test cannot be committed — do not weaken the assertion to make it pass.

- [ ] **Step 5: Commit**

```bash
pnpm run type-check
git add src/App.tsx src/App.freeAgents.test.tsx
git commit -m "feat: load undrafted free-agent classes in the app shell"
```

---

### Task 10: Team detail — undrafted free agents section

**Files:**

- Modify: `src/components/draft/PlayerList.tsx` (widen to `Acquisition`, use `getAcquisitionOverSlot`)
- Modify: `src/components/draft/PlayerList.test.tsx` (add a free-agent case)
- Create: `src/components/views/team/FreeAgentSection.tsx`
- Test: `src/components/views/team/FreeAgentSection.test.tsx`
- Modify: `src/components/views/team/TeamDetailContent.tsx` (render it below `ClassGrid`, ~line 161)
- Modify: `src/App.css` (styles for the new section)

**Interfaces:**

- Consumes: `FreeAgentScore`, `getFreeAgentScore`, `getTeamFreeAgents` (Task 8); `getAcquisitionOverSlot` (Task 7).
- Produces: `<FreeAgentSection freeAgentClasses={...} selectedTeam={...} draftingTeamOnly={...} />`

- [ ] **Step 1: Widen `PlayerList`**

Change `PlayerWithDraftYear.pick` from `DraftPick` to `Acquisition`, and swap the over-slot call:

```tsx
// was: getPlayerDraftSkill(pick, { draftingTeamOnly })
getAcquisitionOverSlot(pick, { draftingTeamOnly });
```

Anywhere the row renders `pick.round` or `pick.overallPick`, guard with `isDraftPick(pick)` and render `UDFA`-free wording — the label for a free agent row is `undrafted`. Also replace the empty-state copy `No picks to show.` with a `label` prop defaulting to `picks` so the free-agent list can say `No undrafted free agents to show.`

- [ ] **Step 2: Write the failing tests**

Add to `src/components/draft/PlayerList.test.tsx`:

```tsx
it('labels a free agent row undrafted rather than showing a round', () => {
  // render PlayerList with a single FreeAgent entry
  expect(screen.getByText(/undrafted/i)).toBeInTheDocument();
  expect(screen.queryByText(/round/i)).not.toBeInTheDocument();
});
```

Create `src/components/views/team/FreeAgentSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FreeAgentSection } from './FreeAgentSection';
import { stampFreeAgentYear } from '../../../lib/freeAgentClass';
import { makeSeason } from '../../../test/factories';

const classes = [
  stampFreeAgentYear({
    year: 2020,
    freeAgents: [
      {
        playerId: 'a',
        playerName: 'Undrafted Starter',
        position: 'WR',
        teamId: 'BUF',
        seasons: [makeSeason({ year: 2020 })],
      },
    ],
  }),
];

function renderSection(teamId = 'BUF') {
  return render(
    <MemoryRouter>
      <FreeAgentSection
        freeAgentClasses={classes}
        selectedTeam={teamId}
        draftingTeamOnly={false}
      />
    </MemoryRouter>,
  );
}

describe('FreeAgentSection', () => {
  it('heads the section and lists the team’s undrafted players', () => {
    renderSection();
    expect(
      screen.getByRole('heading', { name: /undrafted free agents/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Undrafted Starter')).toBeInTheDocument();
  });

  it('shows a score and an over-slot stat', () => {
    renderSection();
    expect(screen.getByText(/over slot/i)).toBeInTheDocument();
  });

  it('renders an empty state for a team with none', () => {
    renderSection('NYJ');
    expect(screen.getByText(/no undrafted free agents/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/views/team/FreeAgentSection.test.tsx`
Expected: FAIL — cannot resolve `./FreeAgentSection`.

- [ ] **Step 4: Write the component**

Create `src/components/views/team/FreeAgentSection.tsx`. Match the existing team-view section markup (read `RosterSection` in `TeamDetailContent.tsx` and copy its heading and stat-strip structure rather than inventing new classes):

- Heading: `Undrafted free agents`
- Sub-line: `{scoredCount} who took a snap, {startYear}–{endYear}`
- Two stats: `Score` (rounded `score`) and `Over slot` (`formatOverSlot(skillScore)`, colored by `isOverSlotPositive`)
- Body: `<PlayerList picks={...} teamId={selectedTeam} />` with members sorted by score descending
- Empty state when `totalFreeAgents === 0`

- [ ] **Step 5: Render it in `TeamDetailContent`**

Insert between `<ClassGrid />` and `<section className="team-body">`:

```tsx
<FreeAgentSection
  freeAgentClasses={freeAgentClasses}
  selectedTeam={selectedTeam}
  draftingTeamOnly={draftingTeamOnly}
/>
```

Add `freeAgentClasses: FreeAgentClass[]` to `TeamDetailContentProps`.

- [ ] **Step 6: Run tests**

Run: `pnpm exec vitest run src/components/views/team src/components/draft src/App.freeAgents.test.tsx`
Expected: PASS, including the App heading test from Task 9.

- [ ] **Step 7: Commit**

```bash
pnpm run type-check && pnpm run lint
git add src/components src/App.css src/App.tsx
git commit -m "feat: show a team's undrafted free agents beside its draft classes"
```

---

### Task 11: Draft-year view — undrafted block

**Files:**

- Modify: `src/components/views/draft-year/YearDraftView.tsx` (append after the "rounds 2–7" list, ~line 123)
- Modify: `src/components/views/draft-year/YearDraftView.test.tsx`

**Interfaces:**

- Consumes: `FreeAgentClass` (Task 1), `getPlayerDraftScore` (Task 2), `PlayerList` (Task 10).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Add to `src/components/views/draft-year/YearDraftView.test.tsx`:

```tsx
it('lists the year’s undrafted free agents after the later rounds', () => {
  // render with a freeAgentClasses prop holding one 2020 member
  expect(screen.getByText(/undrafted/i)).toBeInTheDocument();
  expect(screen.getByText('Undrafted Starter')).toBeInTheDocument();
});

it('omits the block entirely for a year with no free agent data', () => {
  // render with freeAgentClasses={[]}
  expect(screen.queryByText(/undrafted/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/views/draft-year/YearDraftView.test.tsx`
Expected: FAIL — no such text.

- [ ] **Step 3: Add the block**

After the existing `rounds 2–7` list, mirroring its markup:

```tsx
{
  freeAgents.length > 0 && (
    <>
      <div className="kicker">undrafted</div>
      <PlayerList
        picks={freeAgents.map((fa) => ({ pick: fa, draftYear: year }))}
        teamId=""
        brandByDraftingTeam
        draftingTeamOnly={draftingTeamOnly}
      />
    </>
  );
}
```

Sort `freeAgents` by `getPlayerDraftScore` descending, and add the year's free-agent count and mean score to the existing summary strip as their own labeled stats (`Undrafted`, `Undrafted score`) — never folded into the `all rounds` figures above them.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run src/components/views/draft-year`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/draft-year src/App.tsx
git commit -m "feat: list undrafted free agents on the draft-year view"
```

---

### Task 12: Player detail and score breakdown

**Files:**

- Modify: `src/App.tsx` — `usePlayerLookup` (~line 425)
- Modify: `src/components/views/player/PlayerDetailView.tsx`
- Modify: `src/components/views/player/PlayerDetailView.test.tsx`
- Modify: `src/components/views/player/ScoreBreakdown.tsx`
- Modify: `src/components/views/player/ScoreBreakdown.test.tsx`

**Interfaces:**

- Consumes: `isDraftPick` (Task 1), `acquisitionWindow` (Task 1), `expectedScoreForAcquisition` / `getAcquisitionOverSlot` (Task 7), `freeAgentClasses` (Task 9).

**Controller ruling carried into this task:** Tasks 10 and 11 link every free-agent row to `/player/:id`, but `usePlayerLookup` in `src/App.tsx` searches `draftClasses` only — so those links resolve to nothing. Closing that is part of this task, not a follow-up: widen `usePlayerLookup` to search `freeAgentClasses` after `draftClasses`, and widen the `playerInfo` it returns to `{ pick: Acquisition; draftYear: number }`. Add a test asserting a free agent's `/player/:id` route renders his detail page.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/views/player/ScoreBreakdown.test.tsx`:

```tsx
it('explains a free agent against the undrafted cohort, not a draft slot', () => {
  // render ScoreBreakdown for a FreeAgent
  expect(screen.getByText(/undrafted free agents/i)).toBeInTheDocument();
  expect(screen.queryByText(/draft slot/i)).not.toBeInTheDocument();
});

it('divides a free agent by a three-season window', () => {
  expect(screen.getByText(/3 seasons/i)).toBeInTheDocument();
});
```

Add to `src/components/views/player/PlayerDetailView.test.tsx`:

```tsx
it('shows “Undrafted” where a pick shows its round and slot', () => {
  expect(screen.getByText(/undrafted/i)).toBeInTheDocument();
  expect(screen.queryByText(/round \d/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/components/views/player`
Expected: FAIL.

- [ ] **Step 3: Branch the copy**

In both components, widen the prop type from `DraftPick` to `Acquisition` and branch on `isDraftPick`:

- Round/slot line → `Undrafted free agent, {draftYear}`
- Window denominator → `acquisitionWindow(player)` rather than `rookieWindow(player.round)`
- Over-slot explanation → "compared with what undrafted free agents earn on average ({expected})" using `expectedScoreForAcquisition`

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run src/components/views/player`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/player
git commit -m "feat: explain a free agent's score against the undrafted cohort"
```

---

### Task 13: Documentation, Info modal, full verification

**Files:**

- Modify: `src/components/layout/InfoView.tsx` (and its test, `InfoView.test.tsx`)
- Modify: `docs/SPEC_CLARIFICATIONS.md`
- Modify: `docs/calculations.md`
- Modify: `docs/datamodel.md`
- Modify: `AGENTS.md` only if a workflow actually changed (likely not)

- [ ] **Step 1: Add the Info modal paragraph**

Under a heading `Undrafted free agents`:

> Players who entered the league undrafted are grouped into the class of the season they first appeared, and counted only if they took at least one snap. They are scored on the same 0–100 scale as draft picks, over a three-season window — the length of an undrafted rookie contract. Their expectation is the average score undrafted players actually earn, so "over slot" here means "better than a typical undrafted signing". Because that expectation is the cohort's own average, it is centered on zero by construction: it compares teams with each other, and cannot say whether the league as a whole signs undrafted players well. These numbers sit beside the draft score and are never folded into it.

- [ ] **Step 2: Add the spec section**

Append to `docs/SPEC_CLARIFICATIONS.md` after **Retention**, covering: cohort membership (three conditions), owning team, `FA_WINDOW = 3`, the baseline definition and its zero-centering, and the explicit statement that the rolling draft score and all rankings remain picks-only. State the known limitation about signing volume.

- [ ] **Step 3: Document the derivation**

Add a `docs/calculations.md` section for the free-agent baseline: input population, maturity lag, career-mode scoring basis, the resulting scalar, and where it is stored.

- [ ] **Step 4: Document the data file**

Add `fa-{year}.json` and the `FreeAgent` field table to `docs/datamodel.md`, noting that `draftYear` means rookie season for a free agent.

- [ ] **Step 5: Full verification**

```bash
pnpm run validate
```

Expected: format, type-check, lint, duplication, the full test suite and the build all pass. If `lint:duplication` flags `getFreeAgentScore.ts` against `getRollingDraftScore.ts`, extract the shared loop into a small internal helper both call rather than adding a jscpd ignore.

- [ ] **Step 6: Confirm nothing picks-only moved**

```bash
git diff --stat public/data/default-rankings.json public/data/lagged-draft-rankings.json public/data/draft-*.json
```

Expected: no output. Any change here is a regression against the Global Constraints.

- [ ] **Step 7: Visual verification (MANDATORY)**

Before running it, check for a stale dev server holding port 4173 (`lsof -i:4173`) — that has hung the pre-commit hook before.

Invoke `/visual-verify`. Fix every issue it finds; zero deferrals. The new surfaces to check are the team detail free-agent section, the draft-year undrafted block, and a free agent's player detail page.

- [ ] **Step 8: Commit**

```bash
git add docs src/content src/components
git commit -m "docs: document undrafted free-agent scoring"
```

---

## Self-Review

**Spec coverage:**

| Spec section                                          | Task                                       |
| ----------------------------------------------------- | ------------------------------------------ |
| Cohort membership (undrafted, rookie_season, ≥1 snap) | 3, 4                                       |
| Owning team = first-snap franchise                    | 4                                          |
| Class floor 2013                                      | 3                                          |
| Three-season window                                   | 1, 2                                       |
| Empirical cohort baseline, single scalar              | 6                                          |
| Over-slot dispatch, same units                        | 7                                          |
| Separate from the draft score                         | 8, plus the Global Constraints check in 13 |
| `fa-{year}.json` data file                            | 4, 5                                       |
| `Acquisition` union, widened engine                   | 1, 2                                       |
| QB apprenticeship applies                             | 2                                          |
| Team detail section                                   | 10                                         |
| Draft-year block                                      | 11                                         |
| Player detail / ScoreBreakdown                        | 12                                         |
| Info modal, docs                                      | 13                                         |
| Testing (unit, integration, visual-verify)            | every task; 13 for the full run            |

**Known follow-up left for the implementer:** Task 4 Step 3 deliberately does not spell out `firstSnapTeam`'s body, because it must be written against `loadSnapData`'s actual return type in `scripts/update-data.ts`. That is the one place this plan asks the implementer to read before writing; everywhere else the code is given.
