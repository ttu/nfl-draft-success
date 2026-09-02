# Injured Reserve as a Load Signal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the pipeline to see injured reserve, so a player who missed the front of a season and returned (Derwin James 2019) is forgiven in Load the same way a player on the weekly injury report already is.

**Architecture:** A new nflverse source — `weekly_rosters/roster_weekly_{season}.csv`, 2016 onward — yields a per-player-season count of weeks spent on reserve. That count becomes a third signal in the existing `max()` inside `injuryAdjustedFullSeasonDenominator`, replacing the `seasonEndingAbsence` snap-shape heuristic from 2016 on while leaving it in place for 2013–2015, where the roster feed is unreliable. A season spent wholly on reserve is labelled in the UI but deliberately not rescored.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, React Testing Library, `csv-parse/sync`, tsx scripts.

**Spec:** `docs/superpowers/specs/2026-08-24-injured-reserve-load-design.md` — read it before starting. It carries the measurements behind every constant here.

---

## Context you need before Task 1

**The scoring chain.** `getSeasonScore` = `0.7 × load + 0.3 × availability`. Load is `cumulativeSnapShare`, precomputed by `scripts/update-data.ts` and stored in `public/data/draft-{year}.json`. Availability is raw `gamesPlayed / teamGames` and is **never** injury-adjusted. This plan only ever moves Load.

**Why the app is fed by a script.** The site is static, front-end only. `scripts/update-data.ts` fetches nflverse CSVs and writes JSON; the app reads that JSON. Pure logic lives in `src/lib/` so it can be unit-tested without network; the script orchestrates. Follow that split — new parsing logic goes in `src/lib/`, not in the script.

**Two ids.** nflverse rows carry both `pfr_id` and `gsis_id`. `pfr_id` is the app's `playerId`, but it is missing from 26–68% of weekly roster rows. `gsis_id` is present in 99%. Join reserve data on `gsis_id`. The draft_picks row carries its own `gsis_id` (`update-data.ts:902`) — no id map needs building.

**Commands:**

- One test file: `pnpm exec vitest run src/lib/reserveWeeks.test.ts`
- One test by name: `pnpm exec vitest run src/lib/reserveWeeks.test.ts -t "counts distinct weeks"`
- Everything: `pnpm test`
- Types: `pnpm type-check`
- Never use `--no-verify` on a commit.

---

## File Structure

| File                                               | Responsibility                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/reserveWeeks.ts` (new)                    | Pure: fold roster rows → reserve weeks per `gsis_id`. Owns the status allowlist and the `R62` exclusion. |
| `src/lib/injuredSeason.ts` (new)                   | Pure: one predicate, "did this player spend the season on reserve without playing".                      |
| `src/lib/teamSeasonDenominator.ts`                 | Add `reserveWeeks` to the adjustment guard and the `max()`.                                              |
| `src/lib/seasonEndingAbsence.ts`                   | Unchanged behavior; doc rewritten to say it is the pre-2016 fallback.                                    |
| `src/lib/explainDraftScore.ts`                     | `explainInjury` must know the third signal or the UI note never renders.                                 |
| `src/lib/careerShapeHighlights.ts`                 | Two call sites that read the gated field.                                                                |
| `src/types.ts`                                     | `Season.reserveWeeks?: number`.                                                                          |
| `scripts/update-data.ts`                           | Fetch, `FIRST_RESERVE_SEASON`, and the era gate at the write point.                                      |
| `src/components/views/player/PlayerDetailView.tsx` | `injured` chip; generalise `SeasonEndingInjuryMarker`.                                                   |
| `src/components/views/player/ScoreBreakdown.tsx`   | Third signal string.                                                                                     |
| `src/App.css`                                      | `.role-chip.injured`.                                                                                    |
| `docs/calculations.md`, `docs/datamodel.md`        | Document the new signal and field.                                                                       |

Tasks 1–3 are pure and independent. Task 4 wires the script. Tasks 5–9 are consumers. Task 10+ is data and verification.

---

## Task 1: Reserve-week accumulation

**Files:**

- Create: `src/lib/reserveWeeks.ts`
- Test: `src/lib/reserveWeeks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { accumulateReserveWeeks } from './reserveWeeks';

const row = (o: Partial<Record<string, string>>) => ({
  gsis_id: '00-0034790',
  status: 'RES',
  status_description_abbr: 'R01',
  game_type: 'REG',
  week: '1',
  ...o,
});

describe('accumulateReserveWeeks', () => {
  it('counts distinct weeks per player', () => {
    const got = accumulateReserveWeeks([
      row({ week: '1' }),
      row({ week: '2' }),
      row({ week: '2' }), // duplicate week must not count twice
    ]);
    expect(got.get('00-0034790')).toBe(2);
  });

  it('counts RES, RSR, PUP and NON as reserve', () => {
    // RSR matters: Tyler Eifert 2014 and Alec Ogletree 2015 carry it, not RES.
    for (const status of ['RES', 'RSR', 'PUP', 'NON']) {
      const got = accumulateReserveWeeks([row({ status })]);
      expect(got.get('00-0034790'), status).toBe(1);
    }
  });

  it('ignores active and practice-squad rows', () => {
    for (const status of ['ACT', 'INA', 'DEV', 'CUT']) {
      const got = accumulateReserveWeeks([row({ status })]);
      expect(got.get('00-0034790'), status).toBeUndefined();
    }
  });

  it('excludes R62, which is the 2020 COVID-19 reserve list', () => {
    const got = accumulateReserveWeeks([
      row({ week: '1', status_description_abbr: 'R62' }),
      row({ week: '2', status_description_abbr: 'R01' }),
    ]);
    expect(got.get('00-0034790')).toBe(1);
  });

  it('ignores preseason rows', () => {
    const got = accumulateReserveWeeks([row({ game_type: 'PRE' })]);
    expect(got.get('00-0034790')).toBeUndefined();
  });

  it('counts postseason weeks', () => {
    const got = accumulateReserveWeeks([
      row({ week: '19', game_type: 'POST' }),
    ]);
    expect(got.get('00-0034790')).toBe(1);
  });

  it('skips rows with no gsis_id or an unusable week', () => {
    const got = accumulateReserveWeeks([
      row({ gsis_id: '' }),
      row({ gsis_id: '00-0000001', week: '' }),
      row({ gsis_id: '00-0000002', week: '0' }),
    ]);
    expect(got.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm exec vitest run src/lib/reserveWeeks.test.ts`
Expected: FAIL — cannot resolve `./reserveWeeks`.

- [ ] **Step 3: Implement**

```ts
/**
 * Weeks a player spent on a reserve list, from nflverse weekly rosters.
 * Used by scripts/update-data.ts; see docs/calculations.md.
 *
 * This is the direct measurement of an injury the weekly injury report cannot
 * make. A player placed on IR leaves the 53-man roster and the report with it,
 * so the worst injuries are exactly the ones `injuryReportWeeks` scores as
 * zero. The roster feed still carries him, marked reserve, every week he is out.
 */

/** The fields of an nflverse weekly-roster row this module reads. */
export interface ReserveRosterRow {
  gsis_id?: string;
  status?: string;
  status_description_abbr?: string;
  game_type?: string;
  week?: string;
}

/**
 * Roster statuses that mean "not available, and not by choice of the coach".
 *
 * `RSR` is easy to miss and matters: Tyler Eifert's 2014 and Alec Ogletree's
 * 2015 season-ending injuries are filed under it rather than `RES`.
 */
export const RESERVE_STATUSES: readonly string[] = ['RES', 'RSR', 'PUP', 'NON'];

/**
 * Reserve codes that are not injuries.
 *
 * `R62` appears 701 times in 2020 and zero times in every other season, which
 * together with 2020 being the year the NFL ran a COVID-19 reserve list
 * identifies it. nflverse publishes no code dictionary, so this is inference
 * from the distribution rather than documented fact — recorded as such so it
 * can be overturned with better evidence.
 *
 * Excluding it is only possible because 2020 is one of the seasons where the
 * code column is populated at all; see FIRST_RESERVE_SEASON.
 */
export const NON_INJURY_RESERVE_CODES: readonly string[] = ['R62'];

/**
 * Distinct reserve weeks per `gsis_id` for one season's roster rows.
 *
 * Weeks are a set for the same reason `accumulateInjuryReports` (in `scripts/update-data.ts:579`) uses one: a
 * player can appear more than once in a week without being out twice. A bye
 * week spent on reserve does inflate the count against games missed, and that
 * is deliberate — `injuryAdjustedFullSeasonDenominator` already caps the
 * excusal at games actually missed, so no second rule is needed here.
 */
export function accumulateReserveWeeks(
  rows: ReserveRosterRow[],
): Map<string, number> {
  const weeks = new Map<string, Set<number>>();

  for (const row of rows) {
    const gsisId = (row.gsis_id ?? '').trim();
    if (!gsisId) continue;
    if (!RESERVE_STATUSES.includes(row.status ?? '')) continue;
    if (NON_INJURY_RESERVE_CODES.includes(row.status_description_abbr ?? ''))
      continue;
    // Preseason roster churn is not a season absence.
    const gameType = row.game_type ?? '';
    if (gameType !== 'REG' && gameType !== 'POST') continue;

    const week = parseInt(row.week ?? '', 10);
    if (!Number.isFinite(week) || week <= 0) continue;

    let set = weeks.get(gsisId);
    if (!set) {
      set = new Set();
      weeks.set(gsisId, set);
    }
    set.add(week);
  }

  return new Map([...weeks].map(([id, set]) => [id, set.size]));
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm exec vitest run src/lib/reserveWeeks.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reserveWeeks.ts src/lib/reserveWeeks.test.ts
git commit -m "feat: count reserve weeks from nflverse weekly rosters"
```

---

## Task 2: `Season.reserveWeeks`

**Files:**

- Modify: `src/types.ts:42` (after `seasonEndingAbsenceGames`)

- [ ] **Step 1: Add the field**

```ts
  /**
   * Weeks the player spent on a reserve list — the direct IR measurement, from
   * nflverse weekly rosters. Present only when non-zero, and only from 2016 on.
   *
   * This and `seasonEndingAbsenceGames` are two answers to the same question
   * and are never both present on a season: from 2016 the roster feed is
   * reliable and this field is written, before 2016 it is not and the snap-shape
   * heuristic is. Which one a season carries tells you which era it came from.
   * See `src/lib/reserveWeeks.ts` and `scripts/update-data.ts`.
   */
  reserveWeeks?: number;
```

- [ ] **Step 2: Type-check**

Run: `pnpm type-check`
Expected: PASS — the field is optional, so nothing else breaks yet.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Season.reserveWeeks"
```

---

## Task 3: Reserve weeks as a load signal

The single most important change in the plan. `resolveCumulativeLoadWithInjury` guards the adjustment behind a disjunction of the two existing signals — miss it and a season carrying only reserve weeks takes the unadjusted branch and the feature does nothing at all.

**Files:**

- Modify: `src/lib/teamSeasonDenominator.ts:328-373` (`injuryAdjustedFullSeasonDenominator`), `:390-435` (`resolveCumulativeLoadWithInjury`)
- Test: `src/lib/teamSeasonDenominator.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to the existing describe block for these functions:

```ts
describe('reserveWeeks as a third injury signal', () => {
  // Derwin James 2019: 11 weeks on IR, returned for the last 5 games, and
  // absent from the weekly injury report for the whole season.
  const james2019 = {
    cumNum: 500,
    cumDenGamesPlayed: 504,
    fullSeasonTeamDen: 1600,
    useFullSeasonDenominator: true,
    injuryReportWeeks: 0,
    seasonEndingAbsenceGames: 0,
    teamGames: 16,
    gamesPlayed: 5,
    gameCount: 16,
  };

  it('adjusts the denominator when reserve weeks are the only signal', () => {
    const before = resolveCumulativeLoadWithInjury(james2019);
    const after = resolveCumulativeLoadWithInjury({
      ...james2019,
      reserveWeeks: 11,
    });
    expect(before.share).toBeCloseTo(500 / 1600, 5);
    // 11 of 16 games excused takes 1600 down to 500 — but the function floors
    // the result at `cumDenGamesPlayed` (504 here), so 504 is the answer, not
    // 500. Read `injuryAdjustedFullSeasonDenominator`'s closing
    // `Math.max(adjusted, cumDenGamesPlayed)` before changing this number.
    expect(after.denominator).toBeCloseTo(504, 5);
    // Which lands him on the 0.992 the spec predicts for James 2019.
    expect(after.share).toBeCloseTo(500 / 504, 5);
    expect(after.share).toBeGreaterThan(before.share);
  });

  it('takes the largest signal and never their sum', () => {
    const got = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1600,
      gameCount: 16,
      injuryReportWeeks: 4,
      seasonEndingAbsenceGames: 0,
      reserveWeeks: 6,
      teamGames: 16,
      gamesPlayed: 10,
      cumDenGamesPlayed: 0,
    });
    // 6 excused, not 10.
    expect(got).toBeCloseTo(1600 - 6 * 100, 5);
  });

  it('still caps the excusal at games actually missed', () => {
    const got = injuryAdjustedFullSeasonDenominator({
      fullSeasonTeamDen: 1600,
      gameCount: 16,
      injuryReportWeeks: 0,
      seasonEndingAbsenceGames: 0,
      // A bye week on reserve pushes the week count past the games missed.
      reserveWeeks: 12,
      teamGames: 16,
      gamesPlayed: 5,
      cumDenGamesPlayed: 0,
    });
    expect(got).toBeCloseTo(1600 - 11 * 100, 5);
  });

  it('leaves a season with no signal untouched', () => {
    const got = resolveCumulativeLoadWithInjury({
      ...james2019,
      gamesPlayed: 16,
      reserveWeeks: 0,
    });
    expect(got.denominator).toBeCloseTo(1600, 5);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/lib/teamSeasonDenominator.test.ts -t "reserveWeeks as a third"`
Expected: FAIL — the first test's `after.share` equals `before.share`, because the guard never lets the adjustment run.

- [ ] **Step 3: Add `reserveWeeks` to both functions**

In `injuryAdjustedFullSeasonDenominator`, add to the options interface:

```ts
  /** Weeks on a reserve list — the direct IR signal, 2016 on */
  reserveWeeks?: number;
```

destructure it with `reserveWeeks = 0`, and widen the max:

```ts
const excusedWeeks = Math.min(
  Math.max(0, injuryReportWeeks, seasonEndingAbsenceGames, reserveWeeks),
  missedGames,
);
```

Extend the existing doc comment, which currently says "Two signals, whichever is stronger":

```
 * Three signals, whichever is stronger: weeks on the injury report, weeks on a
 * reserve list (see {@link ./reserveWeeks}), and games missed from a
 * season-ending absence (see {@link ./seasonEndingAbsence}), the pre-2016
 * fallback for the same thing. They are not summed — all three describe the
 * same absence.
```

In `resolveCumulativeLoadWithInjury`, add `reserveWeeks?: number` to the options, and — **the load-bearing line** — add it to the guard:

```ts
const reserveWeeks = options.reserveWeeks ?? 0;
const applyInjuryAdjustmentToFullSeasonDen =
  options.useFullSeasonDenominator &&
  (options.injuryReportWeeks > 0 ||
    seasonEndingAbsenceGames > 0 ||
    reserveWeeks > 0) &&
  options.gameCount > 0;
```

then pass `reserveWeeks` through to `injuryAdjustedFullSeasonDenominator`.

- [ ] **Step 4: Run the whole file**

Run: `pnpm exec vitest run src/lib/teamSeasonDenominator.test.ts`
Expected: PASS, including every pre-existing test — `reserveWeeks` defaults to 0, so nothing already passing may change.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamSeasonDenominator.ts src/lib/teamSeasonDenominator.test.ts
git commit -m "feat: accept reserve weeks as a load-denominator signal"
```

---

## Task 4: Fetch weekly rosters and gate the era

**Files:**

- Modify: `scripts/update-data.ts` — constants near `:44-47`, a loader beside `loadInjuryData` (`:606`), `SeasonLoadMeta` (`:115-123`), `PickSources` (`:876`), `buildPickSeason` (`:790`), `buildDraftPick` (`:894`), `main` (`:1014`, injuries block around `:1067`)

No unit test: this file is a script, and its logic already lives in the tested libs. The verification is Task 11's data run.

- [ ] **Step 1: Add the constant**

Beside `FIRST_INJURY_SEASON`:

```ts
/**
 * First season nflverse weekly rosters record reserve status reliably.
 *
 * Not a publication date — the releases go back to 2012 — but a quality floor.
 * Before 2016 only ~200-250 players per season carry any reserve week against
 * a league reality of 500-700, and their weeks are placed wrong: the mean
 * reserve week is 6.8, ahead of the season's midpoint, when injuries in fact
 * accumulate towards the end (2016+ seasons mean 10.0). Tyler Eifert's 2014,
 * a week-1 injury that ended his year, is a single row. Luke Joeckel's 2013 IR
 * stint is recorded against weeks 1-5, the weeks he played.
 *
 * Applied to 2013-2015 the reserve signal strips excusal from 150 player-seasons
 * and grants it to 40 — data loss, not correction. Those seasons keep the
 * snap-shape heuristic in `src/lib/seasonEndingAbsence.ts` instead.
 */
const FIRST_RESERVE_SEASON = 2016;
```

- [ ] **Step 2: Add the loader**

Import at the top:

```ts
import { accumulateReserveWeeks } from '../src/lib/reserveWeeks';
```

Beside `loadInjuryData`:

```ts
/**
 * Load reserve weeks: gsis_id -> season -> weeks on a reserve list.
 *
 * The heaviest fetch in this script — roughly 13MB per season — because the
 * weekly roster release carries every player on every roster for every week.
 */
async function loadReserveData(
  seasons: number[],
): Promise<Map<string, Map<number, number>>> {
  const result = new Map<string, Map<number, number>>();

  for (const season of seasons) {
    const url = `${BASE}/weekly_rosters/roster_weekly_${season}.csv`;
    // Same tolerance as injuries: reserve weeks only soften a denominator, so a
    // season that has not published yet must read as "nobody was on reserve",
    // never as a build failure.
    const csv = await fetchSeasonCsv(url, `roster_weekly_${season}`, {
      required: false,
    });
    if (csv === undefined) continue;

    for (const [gsisId, weeks] of accumulateReserveWeeks(parseCsv(csv))) {
      let pm = result.get(gsisId);
      if (!pm) {
        pm = new Map();
        result.set(gsisId, pm);
      }
      pm.set(season, weeks);
    }
  }

  return result;
}
```

- [ ] **Step 3: Wire it through**

`PickSources` gains:

```ts
reserveData: Map<string, Map<number, number>>;
```

`buildDraftPick` (beside the existing `playerInjuries` lookup at `:907`):

```ts
const playerReserve = gsisId ? sources.reserveData.get(gsisId) : undefined;
```

and passes `playerReserve` into each `buildPickSeason` call.

`buildPickSeason` gains `playerReserve?: Map<number, number>` in its params, and **applies the era gate**:

```ts
// The era gate. `seasonEndingAbsenceGames` is computed unconditionally in
// loadSnapData and carried on loadMeta, so this is where it stops being
// written: from FIRST_RESERVE_SEASON the roster feed measures the same
// absence directly and better, and a season must never carry both — which
// one it carries is how a reader tells the eras apart.
const useReserve = season >= FIRST_RESERVE_SEASON;
const reserveWeeks = useReserve ? (playerReserve?.get(season) ?? 0) : 0;
const absenceGames = useReserve
  ? 0
  : (data?.loadMeta?.seasonEndingAbsenceGames ?? 0);
```

Note this replaces the existing `absenceGames` line at `:815`.

Pass `reserveWeeks` into the `resolveCumulativeLoadWithInjury` call, and replace the `seasonEndingAbsenceGames` argument — which currently reads `data.loadMeta.seasonEndingAbsenceGames` — with the gated `absenceGames` local, or the gate will leak past the write point into the maths.

The returned object gains, beside the existing conditional spreads:

```ts
    ...(reserveWeeks > 0 ? { reserveWeeks } : {}),
```

- [ ] **Step 4: Fetch it in `main`**

After the injuries block:

```ts
const reserveSeasons = seasonRange(FIRST_RESERVE_SEASON, maxSeason);
console.log(
  `Fetching weekly rosters (${FIRST_RESERVE_SEASON}–${maxSeason})...`,
);
const reserveData = await loadReserveData(reserveSeasons);
```

and add `reserveData` to the `sources` object.

- [ ] **Step 5: Type-check**

Run: `pnpm type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/update-data.ts
git commit -m "feat: read reserve weeks from weekly rosters, gated at 2016"
```

---

## Task 5: `seasonEndingAbsence.ts` doc

**Files:**

- Modify: `src/lib/seasonEndingAbsence.ts:1-9`

- [ ] **Step 1: Rewrite the module doc**

Behavior does not change and its tests must not change. Only the doc, which currently presents this as the only IR signal:

```ts
/**
 * Detecting season-ending absences from snap data alone — the pre-2016 fallback.
 *
 * The nflverse injury feed is the weekly practice/game-status report, and a
 * player placed on IR drops off the 53-man roster and off that report entirely.
 * The worst injuries therefore leave no trace in `injuryReportWeeks` (Nick Bosa
 * has zero 2020 rows despite tearing his ACL in week 2). Snap counts still show
 * the shape of it: the player appears every week, then never again.
 *
 * From 2016 this is superseded by `src/lib/reserveWeeks.ts`, which measures the
 * same absence directly from roster status instead of inferring it, and is not
 * blind to an injury that starts a season rather than ending one — this rule
 * returns 0 whenever the player came back. Only 2013-2015 still relies on it,
 * because the weekly roster feed is unreliable that far back; see
 * FIRST_RESERVE_SEASON in `scripts/update-data.ts` for the evidence.
 */
```

- [ ] **Step 2: Confirm nothing broke**

Run: `pnpm exec vitest run src/lib/seasonEndingAbsence.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/seasonEndingAbsence.ts
git commit -m "docs: mark seasonEndingAbsence as the pre-2016 fallback"
```

---

## Task 6: `explainInjury` learns the third signal

Without this the Task 7 UI string is unreachable code: `explainInjury` returns `undefined` for exactly the seasons this feature targets.

**Files:**

- Modify: `src/lib/explainDraftScore.ts:32-39` (`InjuryAdjustmentExplanation`), `:127-142` (`explainInjury`)
- Test: `src/lib/explainDraftScore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
describe('explainInjury with reserve weeks', () => {
  const injuredSeason = (o = {}) =>
    season({
      year: 2019,
      gamesPlayed: 5,
      teamGames: 16,
      snapShare: 0.992,
      cumulativeSnapShare: 0.992,
      retained: true,
      reserveWeeks: 11,
      ...o,
    });

  it('explains a season whose only signal is reserve weeks', () => {
    const rows = seasonRows(
      explainDraftScore(pick({ seasons: [injuredSeason()] }), true)!,
    );
    const y2019 = rows.find((r) => r.year === 2019)!;

    expect(y2019.injury).toBeDefined();
    expect(y2019.injury?.reserveWeeks).toBe(11);
    expect(y2019.injury?.excusedGames).toBe(11);
    expect(y2019.injury?.loadDenominatorGames).toBe(5);
  });

  it('still says nothing about a season with no snaps', () => {
    // A wholly-missed season has a Load of zero whatever the denominator, so
    // there is no forgiveness to describe. It gets the `injured` chip instead.
    const rows = seasonRows(
      explainDraftScore(
        pick({
          seasons: [injuredSeason({ gamesPlayed: 0, reserveWeeks: 16 })],
        }),
        true,
      )!,
    );
    expect(rows.find((r) => r.year === 2019)!.injury).toBeUndefined();
  });
});
```

**Use the file's real API, not an invented one.** `explainDraftScore(pick, draftingTeamOnly)` takes two arguments and returns `DraftScoreExplanation | null`, and `rows` is a discriminated union on `kind` — so the existing tests narrow with the local `seasonRows(...)` helper and build fixtures with the local `pick()` / `season()` helpers. Copy that shape; `explainDraftScore(p).rows[0].injury` will not type-check.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/lib/explainDraftScore.test.ts -t "reserve weeks"`
Expected: FAIL — `row.injury` is `undefined` in the first test.

- [ ] **Step 3: Implement**

`InjuryAdjustmentExplanation` gains `reserveWeeks: number;`, and its `excusedGames` doc changes from "The larger of the two signals" to "The largest of the three signals, capped at games actually missed."

In `explainInjury`:

```ts
const reserveWeeks = s.reserveWeeks ?? 0;
if (
  injuryReportWeeks === 0 &&
  seasonEndingAbsenceGames === 0 &&
  reserveWeeks === 0
)
  return undefined;
```

Leave the `if (s.gamesPlayed === 0) return undefined;` line exactly as it is — that is what keeps a wholly-missed season from advertising an adjustment that did nothing. Widen the max and return `reserveWeeks` alongside the other two.

Update the function's doc comment, which currently says "The two signals describe the same absence from different angles", to name three.

- [ ] **Step 4: Fix the pre-existing exact-match assertion**

Adding a key to `InjuryAdjustmentExplanation` breaks a test that does not mention reserve weeks at all. `explainDraftScore.test.ts:302-308` asserts with `toEqual`, which is exact:

```ts
expect(y2023.injury).toEqual({
  injuryReportWeeks: 2,
  seasonEndingAbsenceGames: 12,
  excusedGames: 12,
  loadDenominatorGames: 5,
});
```

Add `reserveWeeks: 0,` to that literal. The season is Sheldon Richardson's 2023, pre-dating nothing relevant — the zero is simply the absence of the new signal.

- [ ] **Step 5: Run and confirm pass**

Run: `pnpm exec vitest run src/lib/explainDraftScore.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/explainDraftScore.ts src/lib/explainDraftScore.test.ts
git commit -m "feat: explain load forgiveness driven by reserve weeks"
```

---

## Task 7: The score-breakdown wording

**Files:**

- Modify: `src/components/views/player/ScoreBreakdown.tsx:359-366`
- Test: `src/components/views/player/ScoreBreakdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Three things about this file that the test must respect: the helper is `renderBreakdown(pick, draftingTeamOnly)`, **the breakdown is collapsed until the toggle is clicked**, and the default fixture emits several injury notes, so existing tests use `getAllByTestId`. Build a single-season pick to keep the assertion unambiguous:

```ts
it('names reserve weeks when they are the winning signal', () => {
  const reservePick = pick({
    seasons: [
      season({
        year: 2019,
        gamesPlayed: 5,
        teamGames: 16,
        snapShare: 0.992,
        cumulativeSnapShare: 0.992,
        reserveWeeks: 11,
      }),
    ],
  });
  renderBreakdown(reservePick);
  fireEvent.click(screen.getByTestId('score-breakdown-toggle'));

  const [note] = screen.getAllByTestId('score-breakdown-injury');
  expect(note).toHaveTextContent('11 weeks on injured reserve');
});
```

Use whatever the file names its fixture builders (`pick`/`season`/`makePick`/`makeSeason` — check the imports at the top) rather than the names written here.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/components/views/player/ScoreBreakdown.test.tsx -t "reserve weeks"`

- [ ] **Step 3: Implement**

Replace the two-way `signal` ternary with a three-way pick of the largest. Keep the existing comment about naming only the winning signal — it is the reason this is a pick and not a list:

```ts
const {
  injuryReportWeeks,
  seasonEndingAbsenceGames,
  reserveWeeks,
  excusedGames,
} = injury;
// Name only the signal that won. Reporting more than one invites the reader
// to add them, which is exactly the mistake the max() is there to prevent.
const signal =
  reserveWeeks >= Math.max(injuryReportWeeks, seasonEndingAbsenceGames)
    ? `${reserveWeeks} week${reserveWeeks === 1 ? '' : 's'} on injured reserve`
    : seasonEndingAbsenceGames > injuryReportWeeks
      ? `${seasonEndingAbsenceGames} games after his last snap`
      : `${injuryReportWeeks} week${injuryReportWeeks === 1 ? '' : 's'} on the injury report`;
```

Guard the `reserveWeeks >= ...` branch so it cannot win at zero — when all three are 0 `explainInjury` has already returned `undefined`, so the branch is only reached with a positive max, but write it so a future reader does not have to prove that.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm exec vitest run src/components/views/player/ScoreBreakdown.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/views/player/ScoreBreakdown.tsx src/components/views/player/ScoreBreakdown.test.tsx
git commit -m "feat: name injured reserve in the score breakdown"
```

---

## Task 8: The injured-season predicate

**Files:**

- Create: `src/lib/injuredSeason.ts`
- Test: `src/lib/injuredSeason.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { isInjuredOutSeason } from './injuredSeason';
import type { Season } from '../types';

const season = (o: Partial<Season>): Season => ({
  year: 2020,
  gamesPlayed: 0,
  teamGames: 16,
  snapShare: 0,
  retained: true,
  ...o,
});

describe('isInjuredOutSeason', () => {
  it('is true for a season on reserve with no games played', () => {
    expect(isInjuredOutSeason(season({ reserveWeeks: 16 }))).toBe(true);
  });

  it('is true for a partial stint that still yielded no games', () => {
    // Two weeks on IR and then released. He played nothing either way, and the
    // label claims nothing about how the year ended. Accepted deliberately —
    // the alternative is a tolerance constant with no principled value.
    expect(isInjuredOutSeason(season({ reserveWeeks: 2 }))).toBe(true);
  });

  it('is false once he played at all', () => {
    expect(
      isInjuredOutSeason(season({ reserveWeeks: 11, gamesPlayed: 5 })),
    ).toBe(false);
  });

  it('is false for an upcoming season with no games to miss', () => {
    expect(isInjuredOutSeason(season({ teamGames: 0, reserveWeeks: 0 }))).toBe(
      false,
    );
  });

  it('is false for legacy JSON with no reserveWeeks', () => {
    expect(isInjuredOutSeason(season({}))).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/lib/injuredSeason.test.ts`

- [ ] **Step 3: Implement**

```ts
import type { Season } from '../types';

/**
 * A season the player spent on reserve without ever taking the field.
 *
 * Scored zero and counted in full — `src/lib/seasonPlayed.ts` states why, and
 * that decision is untouched here. This exists only so the Role column can say
 * *injured* rather than *non-contributor*, which is a verdict on a player who
 * was never given the chance to earn one.
 *
 * The obvious predicate, `reserveWeeks >= teamGames`, is wrong: `reserveWeeks`
 * counts calendar weeks, bye included, while `teamGames` counts games, so for
 * an 18-game playoff team the two never line up and a player out all year reads
 * false. Requiring only that he was on reserve at all avoids inventing a
 * tolerance — a released player carries CUT or DEV status, not reserve, so he
 * scores zero reserve weeks and is never labelled.
 */
export function isInjuredOutSeason(season: Season): boolean {
  return (
    season.gamesPlayed === 0 &&
    season.teamGames > 0 &&
    (season.reserveWeeks ?? 0) > 0
  );
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm exec vitest run src/lib/injuredSeason.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 4b: Lock the headline behavior with a regression test**

The spec asks for this explicitly, and Task 12's JSON inspection is a one-off check rather than a guard. Add to `src/lib/getSeasonScore.test.ts` a James-2019-shaped season — synthetic, not read from `public/data`, so the test does not couple to a data refresh:

```ts
it('scores a forgiven IR season on what he did when fit', () => {
  // Derwin James 2019: 11 weeks on IR, back for the last 5 at a 0.992 share.
  const season = {
    year: 2019,
    gamesPlayed: 5,
    teamGames: 16,
    snapShare: 0.992,
    cumulativeSnapShare: 0.992,
    retained: true,
    reserveWeeks: 11,
  };
  expect(getSeasonScore(season, 'S')).toBeCloseTo(79.4, 0);
  expect(classifyRole(snapShareForRoleTier(season, 'S'), 5 / 16, 'S')).toBe(
    'starter_when_healthy',
  );
});
```

Note this asserts the _scoring_ half only — that a forgiven Load produces the expected score and role. Whether the pipeline actually writes `cumulativeSnapShare: 0.992` for him is what Task 12 verifies.

- [ ] **Step 5: Commit**

```bash
git add src/lib/injuredSeason.ts src/lib/injuredSeason.test.ts src/lib/getSeasonScore.test.ts
git commit -m "feat: identify a season lost entirely to reserve"
```

---

## Task 9: The career table

Two changes. The second is not optional: the era gate would otherwise delete the existing `IR` marker from every season after 2015.

**Files:**

- Modify: `src/components/views/player/PlayerDetailView.tsx:626-638` (role cell), `:796-810` (`SeasonEndingInjuryMarker`)
- Modify: `src/App.css:2731` (beside `.role-chip.learning`)
- Test: `src/components/views/player/PlayerDetailView.test.tsx`

- [ ] **Step 1: Write the failing tests**

This file builds fixtures with `makePick` / `makeSeason` / `makeDraftClass` and renders inside a `<MemoryRouter>` through a small local closure per describe block — see `renderInjured()` at `:134`, which is the exact pattern to copy. Add a describe block with its own `renderReserve()` closure alongside it:

```ts
const reserveSeasons = makePick({
  seasons: [
    makeSeason({ year: 2019, gamesPlayed: 5, teamGames: 16, snapShare: 0.992, cumulativeSnapShare: 0.992, reserveWeeks: 11 }),
    makeSeason({ year: 2020, gamesPlayed: 0, teamGames: 16, snapShare: 0, cumulativeSnapShare: 0, reserveWeeks: 16 }),
  ],
});

function renderReserve() {
  render(
    <MemoryRouter>
      <PlayerDetailView
        pick={reserveSeasons}
        draftYear={2018}
        draftClasses={[makeDraftClass({ year: 2018, picks: [reserveSeasons] })]}
        draftingTeamOnly={false}
      />
    </MemoryRouter>,
  );
}

it('labels a season lost entirely to reserve', () => {
  renderReserve();
  expect(screen.getByText('injured')).toBeInTheDocument();
  // The season still counts — no uncounted mark.
  expect(screen.queryByTestId('season-uncounted-2020')).not.toBeInTheDocument();
});

it('keeps the IR marker on a post-2015 reserve season', () => {
  // The era gate stops writing seasonEndingAbsenceGames from 2016, so a marker
  // keyed only on that field would vanish from the best-covered decade.
  renderReserve();
  expect(screen.getByTestId('season-ending-injury-2019')).toBeInTheDocument();
});
```

Match the real `makePick` signature — copy the `injured` fixture above `renderInjured()` rather than guessing which fields are required.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/components/views/player/PlayerDetailView.test.tsx -t "reserve"`
Expected: both FAIL.

- [ ] **Step 3: Generalise the marker**

```tsx
/**
 * Flags a season an injury cut short or wiped out. Players placed on IR drop
 * off the weekly injury report, so these are exactly the seasons where "IR wks"
 * reads 0 while Load has been forgiven — without the marker that pairing looks
 * like a bug.
 *
 * Two signals feed it, and only one is ever present: reserve weeks from 2016,
 * the snap-shape heuristic before. The tooltip follows whichever spoke, because
 * their units differ — weeks on a list, against games after a last snap — and a
 * reserve stint need not have ended the season at all.
 */
function SeasonEndingInjuryMarker({ season }: { season: Season }) {
  const reserveWeeks = season.reserveWeeks ?? 0;
  const missed = season.seasonEndingAbsenceGames ?? 0;
  if (reserveWeeks <= 0 && missed <= 0) return null;
  const label =
    reserveWeeks >= missed
      ? `${reserveWeeks} ${reserveWeeks === 1 ? 'week' : 'weeks'} on injured reserve`
      : `Season ended by injury — missed the final ${missed} ${missed === 1 ? 'game' : 'games'}`;
  return (
    <abbr
      className="season-ending-injury"
      data-testid={`season-ending-injury-${season.year}`}
      aria-label="Season affected by injury"
      title={label}
    >
      IR
    </abbr>
  );
}
```

- [ ] **Step 4: Add the chip**

Import `isInjuredOutSeason`, and in the role cell after the existing `learning` block:

```tsx
{
  isInjuredOutSeason(s) && (
    // Same problem the `learning` chip solves, same solution: Role is the
    // column readers scan, and "non-contributor" beside a zero is a
    // verdict on a player who never got on the field to earn one. Unlike
    // `learning` this season is still counted — no ✕ — because the team
    // really did lose the year.
    <span className="role-chip injured">injured</span>
  );
}
```

Note the `aria-label` moves from "Season ended by injury" to "Season affected by injury", because a reserve stint need not have ended the season. The existing marker tests assert `toHaveAccessibleDescription(/season ended by injury/i)` and `/14 games/i` — both read the `title`, not the label, so they keep passing. Do not "fix" them.

- [ ] **Step 5: Add the CSS**

Beside `.role-chip.learning` at `App.css:2731`, matching its shape and using existing tokens only:

```css
.role-chip.injured {
  margin-left: 6px;
  color: var(--ink-3);
  background: var(--paper-2);
}
.role-chip.injured::before {
  background: var(--ink-4);
}
```

This is byte-identical to `.role-chip.learning` bar the selector, and `pnpm validate` runs `jscpd`. At two rules it should pass; if it trips, merge the selectors into one comma-separated list rather than adding an ignore.

- [ ] **Step 6: Run and confirm pass**

Run: `pnpm exec vitest run src/components/views/player/PlayerDetailView.test.tsx`
Expected: PASS, including every pre-existing marker test.

- [ ] **Step 7: Commit**

```bash
git add src/components/views/player/PlayerDetailView.tsx src/components/views/player/PlayerDetailView.test.tsx src/App.css
git commit -m "feat: label injured seasons in the career table"
```

---

## Task 10: Career-shape highlights

Both call sites read the field the era gate stops writing. Left alone, iron-man streaks silently swallow injured seasons and the "started when healthy" list loses the IR cases it exists to find.

**Files:**

- Modify: `src/lib/careerShapeHighlights.ts:151-160` (`isIronManSeason`), `:365-371` (`wasHurt`)
- Test: `src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it('does not count a reserve season toward an iron-man streak', () => {
  const season = {
    year: 2019,
    gamesPlayed: 16,
    teamGames: 16,
    reserveWeeks: 4,
  };
  expect(isIronManSeason(season, 'S')).toBe(false);
});

it('treats reserve weeks as evidence he was hurt', () => {
  expect(
    wasHurt({ year: 2019, gamesPlayed: 5, teamGames: 16, reserveWeeks: 11 }),
  ).toBe(true);
});
```

Both functions are module-private — test them through the exported highlight builders the existing tests already use, following that file's established style.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm exec vitest run src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 3: Implement**

In `isIronManSeason`, replace the single-signal check:

```ts
Math.max(season.seasonEndingAbsenceGames ?? 0, season.reserveWeeks ?? 0) <
  MIN_SEASON_ENDING_ABSENCE_GAMES;
```

In `wasHurt`, add the third disjunct:

```ts
function wasHurt(season: Season): boolean {
  return (
    (season.injuryReportWeeks ?? 0) > 0 ||
    (season.seasonEndingAbsenceGames ?? 0) > 0 ||
    (season.reserveWeeks ?? 0) > 0
  );
}
```

Extend both doc comments to name the third signal — `wasHurt`'s in particular explains why benchings must not qualify, and reserve status is the cleanest evidence yet that a season was not one.

- [ ] **Step 4: Run and confirm pass**

Run: `pnpm exec vitest run src/lib/careerShapeHighlights.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerShapeHighlights.ts src/lib/careerShapeHighlights.test.ts
git commit -m "feat: count reserve weeks in career-shape highlights"
```

---

## Task 11: Documentation

**Files:**

- Modify: `docs/calculations.md` (the Load / injury-adjustment section)
- Modify: `docs/datamodel.md` (the `Season` field table)

- [ ] **Step 1: Document the signal**

In `docs/calculations.md`, cover: the three signals and that they are maxed rather than summed; the 2016 floor and why; that Availability is still never adjusted; and the known limitation that 2016–2019 cannot separate injury reserve from other reserve, bounded at 15–25% of reserve weeks by the code distribution in the seasons that do carry codes.

- [ ] **Step 2: Document the field**

`docs/datamodel.md` documents the `Season` fields, `injuryReportWeeks` and `seasonEndingAbsenceGames` among them, and the repo has a `docs-sync` check that compares those docs against the types. Add `reserveWeeks` and state the era-exclusivity rule: a season carries one absence signal or the other, never both.

- [ ] **Step 3: Commit**

```bash
git add docs/calculations.md docs/datamodel.md
git commit -m "docs: document reserve weeks in the load calculation"
```

---

## Task 12: Regenerate the data

Roughly 3,000 player-seasons move. Everything derived from scores must be rebuilt in order, or the rankings will disagree with the picks they rank.

- [ ] **Step 1: Full refresh**

Run: `pnpm update-data`

This runs `update-data`, then position baselines, draft-slot baseline, default rankings, lagged rankings, team success, and the sitemap, in the order they depend on each other. Expect it to be slow — the weekly roster fetch adds roughly 130MB.

Watch the log for `Fetching weekly rosters (2016–…)` and for any `Skip roster_weekly_…` lines. A skip for the current, unfinished season is normal; a skip for a completed one is not, and means the release moved.

- [ ] **Step 2: Verify the headline case**

Derwin James is `JameDe00` in `public/data/draft-2018.json`. Confirm against the spec's predictions:

- 2019: `reserveWeeks` present and ≈11, `cumulativeSnapShare` ≈0.99 (was 0.308), season score ≈79 (was 31.3), role `starter_when_healthy` (was `contributor`).
- 2020: `reserveWeeks` ≈16, score still **0.0**, and `seasonEndingAbsenceGames` absent.
- Any season from 2016 on: `seasonEndingAbsenceGames` must be absent everywhere. If it appears, the era gate leaked.
- 2013–2015 seasons across the older classes: `seasonEndingAbsenceGames` still present where it was, `reserveWeeks` absent everywhere.

- [ ] **Step 3: Sanity-check the spread**

Confirm the direction matches the spec's measured blast radius — roughly 3,000 seasons changed, net more forgiving, with gains outnumbering losses in games. A result where losses dominate means the `gsis_id` join failed; that failure is silent and looks exactly like "nobody was ever injured".

- [ ] **Step 4: Full validation**

Run: `pnpm validate`
Expected: format, types, lint, duplication, tests, and build all pass.

- [ ] **Step 5: Commit**

```bash
git add public/data src/data docs/superpowers/specs docs/superpowers/plans
git commit -m "feat: regenerate data with injured-reserve load forgiveness"
```

The spec and this plan are committed here, with the code they describe — this project does not commit specs separately.

---

## Task 13: Visual verification

Mandatory under `AGENTS.md` — the work is not complete without it.

- [ ] **Step 1: Run the loop**

Invoke `/visual-verify`.

- [ ] **Step 2: Check these surfaces specifically**

- Derwin James's player page: the 2019 row's Load bar, the `IR` marker, and the score.
- The 2020 row: the `injured` chip beside the Role column, no `✕`, and no layout break where the chip sits.
- The score breakdown for 2019: the injury note reading "11 weeks on injured reserve".
- The chip in both light and dark themes, and on a mobile width — the IR-weeks column is hidden on mobile, which is the reason the chip exists.

- [ ] **Step 3: Fix everything found**

Zero tolerance, no deferrals.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual verification fixes for the injured chip"
```

---

## Done when

- `pnpm validate` passes.
- James 2019 scores ≈79 as `starter_when_healthy`; James 2020 scores 0.0 with an `injured` chip.
- No season from 2016 on carries `seasonEndingAbsenceGames`; no season before it carries `reserveWeeks`.
- Visual verification passes.
