# Current Roster Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-team Current Roster view at `/roster/:teamId` listing every tracked draftee (2013–2026) on that team's current roster, grouped by position group, each with his career average draft score.

**Architecture:** Two new pure modules in `src/lib/` (`positionGroup.ts`, `currentRoster.ts`) derive the roster from the draft JSON already shipped — no data-pipeline change. A new lazy view component renders it. `App.tsx` gains a route, an `ActiveView`, an all-years data load for this route only, and a Subbar breadcrumb; `Masthead` gains a Roster tab that pairs with the existing Team tab whenever a team is open.

**Tech Stack:** React 19 + TypeScript + Vite, react-router-dom 7, Vitest + React Testing Library, Playwright for e2e, global CSS in `src/App.css` (this repo does **not** use CSS Modules despite AGENTS.md — follow the existing global-class convention).

**Spec:** `docs/superpowers/specs/2026-08-25-current-roster-tab-design.md`

## Global Constraints

- Package manager is **pnpm**. Tests: `pnpm test`, single file: `pnpm exec vitest run <path>`.
- Never use `git commit --no-verify`. Conventional commit types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`.
- TDD is mandatory: failing test first, then minimal implementation.
- The spec file `docs/superpowers/specs/2026-08-25-current-roster-tab-design.md` is currently untracked. It ships **with** the implementation — `git add` it in Task 1's commit. Do not create a separate spec commit.
- Test fixtures come from `src/test/factories.ts` (`makePick`, `makeSeason`, `makeDraftClass`). Note `makePick` defaults to `position: 'ZZ'` (unknown position, snap baseline 1.0) and `seasons: []`.
- The "current season" used to detect roster membership is `DRAFT_YEAR_BOUNDS.max` from `src/lib/draftYearBounds.ts` (2026 today). Never hard-code the year in `src/`; tests may hard-code it via the same import.
- Career average score is `getPlayerDraftScore(pick)` **with no options** — career mode is already a plain mean over played seasons. Passing `{ draftingTeamOnly: true }` divides by the rookie-contract window instead and is wrong here.
- After any UI-affecting change, the `/visual-verify` loop is mandatory before the work is considered complete (Task 8).

---

### Task 1: Position groups

**Files:**

- Create: `src/lib/positionGroup.ts`
- Test: `src/lib/positionGroup.test.ts`

**Interfaces:**

- Consumes: `normalizeDraftPosition` from `src/lib/normalizeDraftPosition.ts`.
- Produces: `type PositionGroupId`, `POSITION_GROUP_ORDER: PositionGroupId[]`, `POSITION_GROUP_LABELS: Record<PositionGroupId, string>`, `getPositionGroup(position: string): PositionGroupId`.

Why this exists: `src/lib/positionUnit.ts` only resolves three sides of the ball. The roster page needs depth-chart-sized groups.

- [ ] **Step 1: Write the failing test**

Create `src/lib/positionGroup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getPositionGroup,
  POSITION_GROUP_ORDER,
  POSITION_GROUP_LABELS,
} from './positionGroup';

describe('getPositionGroup', () => {
  it('maps each offensive skill code to its own group', () => {
    expect(getPositionGroup('QB')).toBe('QB');
    expect(getPositionGroup('RB')).toBe('RB');
    expect(getPositionGroup('FB')).toBe('RB');
    expect(getPositionGroup('WR')).toBe('WR');
    expect(getPositionGroup('TE')).toBe('TE');
  });

  it('collects the offensive line', () => {
    for (const code of ['OT', 'G', 'C', 'OL', 'IOL']) {
      expect(getPositionGroup(code)).toBe('OL');
    }
  });

  it('collects the defensive line and linebackers', () => {
    for (const code of ['DE', 'DT', 'NT', 'DL']) {
      expect(getPositionGroup(code)).toBe('DL');
    }
    for (const code of ['LB', 'ILB', 'MLB', 'OLB', 'EDGE']) {
      expect(getPositionGroup(code)).toBe('LB');
    }
  });

  it('collects the secondary and the specialists', () => {
    for (const code of ['CB', 'S', 'SS', 'DB', 'NB']) {
      expect(getPositionGroup(code)).toBe('DB');
    }
    for (const code of ['K', 'P', 'LS']) {
      expect(getPositionGroup(code)).toBe('ST');
    }
  });

  it('normalizes feed aliases before grouping', () => {
    expect(getPositionGroup('T')).toBe('OL'); // T -> OT
    expect(getPositionGroup('OG')).toBe('OL'); // OG -> G
    expect(getPositionGroup('FS')).toBe('DB'); // FS -> S
    expect(getPositionGroup('  qb ')).toBe('QB');
  });

  it('sends an unknown code to OTHER rather than a real unit', () => {
    expect(getPositionGroup('ZZ')).toBe('OTHER');
    expect(getPositionGroup('')).toBe('OTHER');
  });

  it('orders groups offense, defense, special teams, other', () => {
    expect(POSITION_GROUP_ORDER).toEqual([
      'QB',
      'RB',
      'WR',
      'TE',
      'OL',
      'DL',
      'LB',
      'DB',
      'ST',
      'OTHER',
    ]);
  });

  it('labels every group in the order list', () => {
    for (const id of POSITION_GROUP_ORDER) {
      expect(POSITION_GROUP_LABELS[id]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/positionGroup.test.ts`
Expected: FAIL — cannot resolve `./positionGroup`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/positionGroup.ts`:

```ts
import { normalizeDraftPosition } from './normalizeDraftPosition';

/**
 * Depth-chart-sized position groups for the current-roster view.
 *
 * Coarser than a raw position code and finer than `./positionUnit`'s three
 * sides of the ball: a roster reads as quarterbacks, then backs, then
 * receivers, and a page grouped by side of the ball would put a punter beside
 * a nose tackle.
 */
export type PositionGroupId =
  'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST' | 'OTHER';

/** Display order: offense, defense, special teams, then anything unrecognised. */
export const POSITION_GROUP_ORDER: PositionGroupId[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'DL',
  'LB',
  'DB',
  'ST',
  'OTHER',
];

export const POSITION_GROUP_LABELS: Record<PositionGroupId, string> = {
  QB: 'Quarterbacks',
  RB: 'Running backs',
  WR: 'Wide receivers',
  TE: 'Tight ends',
  OL: 'Offensive line',
  DL: 'Defensive line',
  LB: 'Linebackers',
  DB: 'Defensive backs',
  ST: 'Special teams',
  OTHER: 'Other',
};

const GROUP_BY_CODE: Record<string, PositionGroupId> = {
  QB: 'QB',
  RB: 'RB',
  FB: 'RB',
  WR: 'WR',
  TE: 'TE',
  OT: 'OL',
  G: 'OL',
  C: 'OL',
  OL: 'OL',
  IOL: 'OL',
  DE: 'DL',
  DT: 'DL',
  NT: 'DL',
  DL: 'DL',
  LB: 'LB',
  ILB: 'LB',
  MLB: 'LB',
  OLB: 'LB',
  EDGE: 'LB',
  CB: 'DB',
  S: 'DB',
  SS: 'DB',
  DB: 'DB',
  NB: 'DB',
  K: 'ST',
  P: 'ST',
  LS: 'ST',
};

/**
 * Group for a draft `position` code, aliases resolved first (`T` → `OT`,
 * `OG` → `G`, `FS` → `S`).
 *
 * An unrecognised code lands in `OTHER` rather than a side-of-ball catch-all:
 * `OL` and `DL` are codes the feed genuinely uses, so folding an unknown into
 * one of them would report a player as a lineman he may not be.
 */
export function getPositionGroup(position: string): PositionGroupId {
  const code = normalizeDraftPosition(position);
  return GROUP_BY_CODE[code] ?? 'OTHER';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/positionGroup.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/positionGroup.ts src/lib/positionGroup.test.ts docs/superpowers/specs/2026-08-25-current-roster-tab-design.md docs/superpowers/plans/2026-08-25-current-roster-tab.md
git commit -m "feat: group draft positions into depth-chart units"
```

---

### Task 2: Derive the current roster

**Files:**

- Create: `src/lib/currentRoster.ts`
- Test: `src/lib/currentRoster.test.ts`

**Interfaces:**

- Consumes: `getPositionGroup`, `POSITION_GROUP_ORDER`, `POSITION_GROUP_LABELS` (Task 1); `DRAFT_YEAR_BOUNDS`; `getPlayerDraftScore`, `getPlayerRole`; `playedSeasons` from `src/lib/seasonPlayed.ts`.
- Produces:
  - `interface RosterEntry { pick: DraftPick; draftYear: number; score: number | undefined; role: Role | undefined; seasonsPlayed: number; acquired: boolean }`
  - `getCurrentTeamForPick(pick: DraftPick): string | undefined`
  - `getCurrentRoster(draftClasses: DraftClass[], teamId: string): RosterEntry[]`
  - `interface RosterGroup { id: PositionGroupId; label: string; entries: RosterEntry[]; meanScore: number | undefined }`
  - `groupRosterByPosition(entries: RosterEntry[]): RosterGroup[]`
  - `rosterMeanScore(entries: RosterEntry[]): number | undefined`

Domain background the implementer needs:

- `scripts/update-data.ts` writes a season row for the **upcoming** season (`teamGames: 0`) for every player who is on some roster, carrying `retained` and, when he has moved, `currentTeam`. That row's presence _is_ the roster signal.
- So membership must read the row for `DRAFT_YEAR_BOUNDS.max` **only**. 169 picks in the shipped data have a 2025 row as their newest — they played last season but are on nobody's 2026 roster (DeAndre Hopkins, Zach Ertz, Darius Slay). A "latest row wins" rule would wrongly park them on a team.
- 84 picks carry a 2026 row with `retained: false` and no `currentTeam`: explicitly out of the league.
- Every pick in the newest draft class has `seasons: []` — no row at all — so rookies need their own clause or the freshest class vanishes from the page.

- [ ] **Step 1: Write the failing test**

Create `src/lib/currentRoster.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getCurrentTeamForPick,
  getCurrentRoster,
  groupRosterByPosition,
  rosterMeanScore,
} from './currentRoster';
import { DRAFT_YEAR_BOUNDS } from './draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from '../test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

/** The synthetic "where he stands" row update-data writes for the season ahead. */
const upcoming = (overrides: { retained: boolean; currentTeam?: string }) =>
  makeSeason({
    year: CURRENT,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

describe('getCurrentTeamForPick', () => {
  it('returns the drafting team when the current-season row is retained', () => {
    const pick = makePick({
      teamId: 'BUF',
      seasons: [
        makeSeason({ year: CURRENT - 1 }),
        upcoming({ retained: true }),
      ],
    });
    expect(getCurrentTeamForPick(pick)).toBe('BUF');
  });

  it('returns the new team when the current-season row shows a move', () => {
    const pick = makePick({
      teamId: 'JAX',
      seasons: [upcoming({ retained: false, currentTeam: 'BUF' })],
    });
    expect(getCurrentTeamForPick(pick)).toBe('BUF');
  });

  it('returns undefined when the current-season row names no team', () => {
    const pick = makePick({
      teamId: 'JAX',
      seasons: [upcoming({ retained: false })],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });

  it('returns undefined for a player whose newest row is last season', () => {
    // Played in the league last year, on nobody's roster now: without this the
    // page would show retired veterans as current players.
    const pick = makePick({
      teamId: 'ARI',
      draftYear: CURRENT - 10,
      seasons: [makeSeason({ year: CURRENT - 1, retained: true })],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });

  it('places a rookie with no season rows on his drafting team', () => {
    const pick = makePick({ teamId: 'KC', draftYear: CURRENT, seasons: [] });
    expect(getCurrentTeamForPick(pick)).toBe('KC');
  });

  it('does not place an older pick with no season rows on any roster', () => {
    const pick = makePick({
      teamId: 'KC',
      draftYear: CURRENT - 3,
      seasons: [],
    });
    expect(getCurrentTeamForPick(pick)).toBeUndefined();
  });
});

describe('getCurrentRoster', () => {
  it('includes retained players and players acquired from other teams', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({
            overallPick: 1,
            teamId: 'BUF',
            seasons: [upcoming({ retained: true })],
          }),
          makePick({
            overallPick: 2,
            teamId: 'JAX',
            seasons: [upcoming({ retained: false, currentTeam: 'BUF' })],
          }),
          makePick({
            overallPick: 3,
            teamId: 'BUF',
            seasons: [upcoming({ retained: false, currentTeam: 'KC' })],
          }),
        ],
      }),
    ];
    const roster = getCurrentRoster(classes, 'BUF');
    expect(roster.map((e) => e.pick.overallPick)).toEqual([1, 2]);
    expect(roster.map((e) => e.acquired)).toEqual([false, true]);
    expect(roster[0].draftYear).toBe(CURRENT - 2);
  });

  it('scores a career across every team the player suited up for', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT - 3,
        picks: [
          makePick({
            overallPick: 1,
            teamId: 'JAX',
            seasons: [
              makeSeason({ year: CURRENT - 3, retained: true }),
              makeSeason({
                year: CURRENT - 2,
                retained: false,
                currentTeam: 'BUF',
              }),
              upcoming({ retained: false, currentTeam: 'BUF' }),
            ],
          }),
        ],
      }),
    ];
    const [entry] = getCurrentRoster(classes, 'BUF');
    expect(entry.seasonsPlayed).toBe(2);
    // Two identical full seasons: the mean is one season's score, not a
    // rookie-window-divided fraction of it.
    expect(entry.score).toBeGreaterThan(80);
    expect(entry.role).toBe('core_starter');
  });

  it('leaves score and role undefined for a player who has not played', () => {
    const classes = [
      makeDraftClass({
        year: CURRENT,
        picks: [makePick({ overallPick: 1, teamId: 'BUF', seasons: [] })],
      }),
    ];
    const [entry] = getCurrentRoster(classes, 'BUF');
    expect(entry.seasonsPlayed).toBe(0);
    expect(entry.score).toBeUndefined();
    expect(entry.role).toBeUndefined();
  });
});

describe('rosterMeanScore', () => {
  it('averages scored players and ignores unscored ones', () => {
    const entries = [
      { score: 80 },
      { score: 60 },
      { score: undefined },
    ] as Parameters<typeof rosterMeanScore>[0];
    expect(rosterMeanScore(entries)).toBe(70);
  });

  it('is undefined when nobody has played', () => {
    const entries = [{ score: undefined }] as Parameters<
      typeof rosterMeanScore
    >[0];
    expect(rosterMeanScore(entries)).toBeUndefined();
  });
});

describe('groupRosterByPosition', () => {
  it('orders groups by unit, sorts by score, and drops empty groups', () => {
    const seasons = [
      makeSeason({ year: CURRENT - 1 }),
      upcoming({ retained: true }),
    ];
    const weakSeasons = [
      makeSeason({ year: CURRENT - 1, gamesPlayed: 2, snapShare: 0.1 }),
      upcoming({ retained: true }),
    ];
    const classes = [
      makeDraftClass({
        year: CURRENT - 2,
        picks: [
          makePick({ overallPick: 1, teamId: 'BUF', position: 'CB', seasons }),
          makePick({
            overallPick: 2,
            teamId: 'BUF',
            position: 'QB',
            seasons: weakSeasons,
          }),
          makePick({ overallPick: 3, teamId: 'BUF', position: 'QB', seasons }),
        ],
      }),
      // The rookie belongs in the newest class: makeDraftClass stamps every
      // pick's draftYear from the class year, and only the newest class's
      // picks are assumed to be on their drafting team without season rows.
      makeDraftClass({
        year: CURRENT,
        picks: [
          makePick({
            overallPick: 4,
            teamId: 'BUF',
            position: 'QB',
            seasons: [],
          }),
        ],
      }),
    ];
    const groups = groupRosterByPosition(getCurrentRoster(classes, 'BUF'));
    expect(groups.map((g) => g.id)).toEqual(['QB', 'DB']);
    expect(groups[0].label).toBe('Quarterbacks');
    // Best score first; the player awaiting data goes last.
    expect(groups[0].entries.map((e) => e.pick.overallPick)).toEqual([3, 2, 4]);
    expect(groups[1].meanScore).toBeGreaterThan(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/currentRoster.test.ts`
Expected: FAIL — cannot resolve `./currentRoster`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/currentRoster.ts`:

```ts
import type { DraftClass, DraftPick, Role } from '../types';
import { DRAFT_YEAR_BOUNDS } from './draftYearBounds';
import { getPlayerDraftScore, getPlayerRole } from './getPlayerRole';
import { playedSeasons } from './seasonPlayed';
import {
  getPositionGroup,
  POSITION_GROUP_LABELS,
  POSITION_GROUP_ORDER,
  type PositionGroupId,
} from './positionGroup';

/** One tracked draftee on a team's current roster. */
export interface RosterEntry {
  pick: DraftPick;
  draftYear: number;
  /** Career mean season score (0–100), or undefined when nothing has been played. */
  score: number | undefined;
  /** Career role badge, or undefined when nothing has been played. */
  role: Role | undefined;
  seasonsPlayed: number;
  /** True when another team drafted him. */
  acquired: boolean;
}

export interface RosterGroup {
  id: PositionGroupId;
  label: string;
  entries: RosterEntry[];
  meanScore: number | undefined;
}

/**
 * Team the pick is on for the season ahead, or `undefined` when he is on no
 * roster at all.
 *
 * Reads the row for the current draft year and nothing else. `update-data.ts`
 * writes that row for every player who is on a roster, so its absence is the
 * statement that he is not — a player whose newest row is last season played
 * football but has since gone unsigned, and taking "latest row" instead would
 * keep him on his old team forever.
 *
 * The one exception is the freshest draft class, whose picks have no rows at
 * all until they play: those are assumed to be with the team that drafted them.
 */
export function getCurrentTeamForPick(pick: DraftPick): string | undefined {
  const current = pick.seasons.find((s) => s.year === DRAFT_YEAR_BOUNDS.max);
  if (current) {
    return current.retained ? pick.teamId : current.currentTeam;
  }
  if (pick.seasons.length === 0 && pick.draftYear === DRAFT_YEAR_BOUNDS.max) {
    return pick.teamId;
  }
  return undefined;
}

/**
 * Every tracked draftee currently on `teamId`, drafted by anyone.
 *
 * Scores in career mode — the mean of the seasons he actually played, for any
 * team. The question this page asks is how good the player has been, not what
 * his drafting team got out of him, so the rookie-window denominator that
 * `draftingTeamOnly` applies would be the wrong measure here.
 */
export function getCurrentRoster(
  draftClasses: DraftClass[],
  teamId: string,
): RosterEntry[] {
  const entries: RosterEntry[] = [];
  for (const dc of draftClasses) {
    for (const pick of dc.picks) {
      if (getCurrentTeamForPick(pick) !== teamId) continue;
      const seasonsPlayed = playedSeasons(pick).length;
      entries.push({
        pick,
        draftYear: dc.year,
        score: seasonsPlayed > 0 ? getPlayerDraftScore(pick) : undefined,
        role: seasonsPlayed > 0 ? getPlayerRole(pick) : undefined,
        seasonsPlayed,
        acquired: pick.teamId !== teamId,
      });
    }
  }
  return entries;
}

/** Mean score of the entries that have one; undefined when none have. */
export function rosterMeanScore(
  entries: Pick<RosterEntry, 'score'>[],
): number | undefined {
  const scored = entries.filter(
    (e): e is { score: number } => e.score !== undefined,
  );
  if (scored.length === 0) return undefined;
  return scored.reduce((sum, e) => sum + e.score, 0) / scored.length;
}

/**
 * Roster split into position groups in depth-chart order, best score first
 * within each. Players awaiting their first season sort last — they have no
 * score to rank, and a zero would read as a bad one.
 */
export function groupRosterByPosition(entries: RosterEntry[]): RosterGroup[] {
  const byGroup = new Map<PositionGroupId, RosterEntry[]>();
  for (const entry of entries) {
    const id = getPositionGroup(entry.pick.position);
    const list = byGroup.get(id) ?? [];
    list.push(entry);
    byGroup.set(id, list);
  }

  const groups: RosterGroup[] = [];
  for (const id of POSITION_GROUP_ORDER) {
    const list = byGroup.get(id);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    groups.push({
      id,
      label: POSITION_GROUP_LABELS[id],
      entries: list,
      meanScore: rosterMeanScore(list),
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/currentRoster.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/currentRoster.ts src/lib/currentRoster.test.ts
git commit -m "feat: derive a team's current roster from shipped draft data"
```

---

### Task 3: RosterView component

**Files:**

- Create: `src/components/views/team/RosterView.tsx`
- Test: `src/components/views/team/RosterView.test.tsx`
- Modify: `src/App.css` (append the roster styles at the end of the file)

**Interfaces:**

- Consumes: `getCurrentRoster`, `groupRosterByPosition`, `rosterMeanScore` (Task 2); `TEAMS` from `src/data/teams.ts`; `teamColor`, `teamFg`, `PlayerAvatar`, `RoleChip`, `scoreTierClass` from `src/components/design/Primitives.tsx`; `buildPlayerHref` from `src/lib/playerBackTarget.ts`; `cx` from `src/lib/cx.ts`.
- Produces: `export function RosterView({ teamId, draftClasses }: { teamId: string; draftClasses: DraftClass[] })`.

Presentational only: it takes the classes and does its own derivation with the Task 2 helpers. No data loading, no routing decisions.

- [ ] **Step 1: Write the failing test**

Create `src/components/views/team/RosterView.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { RosterView } from './RosterView';
import { DRAFT_YEAR_BOUNDS } from '../../../lib/draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from '../../../test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

const upcoming = (overrides: { retained: boolean; currentTeam?: string }) =>
  makeSeason({
    year: CURRENT,
    gamesPlayed: 0,
    teamGames: 0,
    snapShare: 0,
    ...overrides,
  });

const played = makeSeason({ year: CURRENT - 1 });

const renderView = (ui: ReactElement) =>
  render(<MemoryRouter initialEntries={['/roster/BUF']}>{ui}</MemoryRouter>);

const classes = [
  makeDraftClass({
    year: CURRENT - 2,
    picks: [
      makePick({
        overallPick: 1,
        teamId: 'BUF',
        position: 'QB',
        playerName: 'Josh Starter',
        seasons: [played, upcoming({ retained: true })],
      }),
      makePick({
        overallPick: 2,
        teamId: 'JAX',
        position: 'CB',
        playerName: 'Traded Corner',
        seasons: [played, upcoming({ retained: false, currentTeam: 'BUF' })],
      }),
      makePick({
        overallPick: 3,
        teamId: 'BUF',
        position: 'WR',
        playerName: 'Gone Receiver',
        seasons: [played, upcoming({ retained: false, currentTeam: 'KC' })],
      }),
    ],
  }),
  makeDraftClass({
    year: CURRENT,
    picks: [
      makePick({
        overallPick: 4,
        teamId: 'BUF',
        position: 'QB',
        playerName: 'Rookie Passer',
        seasons: [],
      }),
    ],
  }),
];

describe('RosterView', () => {
  it('lists players currently on the team and omits those who left', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(screen.getByText('Josh Starter')).toBeInTheDocument();
    expect(screen.getByText('Traded Corner')).toBeInTheDocument();
    expect(screen.queryByText('Gone Receiver')).not.toBeInTheDocument();
  });

  it('groups by position group in depth-chart order', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Quarterbacks', 'Defensive backs']);
  });

  it('marks a player his team did not draft', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const row = screen.getByText('Traded Corner').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText(/JAX/)).toBeInTheDocument();
  });

  it('shows a player with no played seasons as awaiting data', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    const row = screen.getByText('Rookie Passer').closest('tr');
    expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('links each player to his profile', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(
      screen.getByRole('link', { name: 'Josh Starter' }).getAttribute('href'),
    ).toContain('/player/');
  });

  it('says the page covers tracked draftees only', () => {
    renderView(<RosterView teamId="BUF" draftClasses={classes} />);
    expect(
      screen.getByText(
        new RegExp(`drafted ${DRAFT_YEAR_BOUNDS.min}.${DRAFT_YEAR_BOUNDS.max}`),
      ),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no tracked player is on the roster', () => {
    renderView(<RosterView teamId="NYJ" draftClasses={classes} />);
    expect(screen.getByText(/No tracked draftees/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/views/team/RosterView.test.tsx`
Expected: FAIL — cannot resolve `./RosterView`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/views/team/RosterView.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { DraftClass } from '../../../types';
import { TEAMS } from '../../../data/teams';
import { DRAFT_YEAR_BOUNDS } from '../../../lib/draftYearBounds';
import {
  getCurrentRoster,
  groupRosterByPosition,
  rosterMeanScore,
  type RosterEntry,
} from '../../../lib/currentRoster';
import { buildPlayerHref } from '../../../lib/playerBackTarget';
import { cx } from '../../../lib/cx';
import {
  PlayerAvatar,
  RoleChip,
  scoreTierClass,
  teamColor,
  teamFg,
} from '../../design/Primitives';

interface RosterViewProps {
  teamId: string;
  /** All shipped classes — the roster is not a year-range question. */
  draftClasses: DraftClass[];
}

/** Score cell text: a rounded score, or an em dash for a player yet to play. */
function scoreLabel(entry: RosterEntry): string {
  return entry.score === undefined ? '—' : String(Math.round(entry.score));
}

export function RosterView({ teamId, draftClasses }: RosterViewProps) {
  const location = useLocation();
  const origin = location.pathname + location.search;
  const team = TEAMS.find((t) => t.id === teamId);
  const color = teamColor(teamId);
  const entries = getCurrentRoster(draftClasses, teamId);
  const groups = groupRosterByPosition(entries);
  const mean = rosterMeanScore(entries);

  return (
    <section
      className="roster-view"
      style={
        {
          ['--team' as never]: color,
          ['--team-fg' as never]: teamFg(color),
        } as CSSProperties
      }
    >
      <header className="roster-view__head">
        <h2 className="roster-view__title">
          {team?.name ?? teamId} · Current roster
        </h2>
        <div className="roster-view__stats">
          <span className="mono tnum">{entries.length} tracked players</span>
          <span className="mono tnum">
            Average score {mean === undefined ? '—' : Math.round(mean)}
          </span>
        </div>
        <p className="roster-view__caveat">
          Players drafted {DRAFT_YEAR_BOUNDS.min}–{DRAFT_YEAR_BOUNDS.max} who
          are on the roster now, wherever they were drafted. Undrafted players
          and older veterans are not tracked, so this is not the full 53.
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="roster-view__empty mono">
          No tracked draftees on this roster.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="roster-group">
            <h3 className="roster-group__title">{group.label}</h3>
            <div className="roster-group__meta mono tnum">
              {group.entries.length} ·{' '}
              {group.meanScore === undefined
                ? '—'
                : Math.round(group.meanScore)}
            </div>
            <table className="roster-table">
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.pick.playerId}>
                    <td style={{ width: 40 }}>
                      <PlayerAvatar
                        teamId={teamId}
                        name={entry.pick.playerName}
                        src={entry.pick.headshotUrl}
                        size={28}
                      />
                    </td>
                    <td style={{ width: 36 }}>
                      <span className="pos-chip">{entry.pick.position}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <Link
                        className="player-row__link"
                        to={buildPlayerHref(entry.pick.playerId, origin)}
                      >
                        {entry.pick.playerName}
                      </Link>
                    </td>
                    <td className="mono roster-table__origin">
                      {entry.draftYear} · R{entry.pick.round}
                      {entry.acquired ? ` · from ${entry.pick.teamId}` : ''}
                    </td>
                    <td className="mono tnum roster-table__seasons">
                      {entry.seasonsPlayed} yr
                    </td>
                    <td
                      className={cx(
                        'roster-table__score',
                        entry.score === undefined
                          ? undefined
                          : scoreTierClass(Math.round(entry.score), {
                              high: 'roster-table__score--top',
                              low: 'roster-table__score--low',
                            }),
                      )}
                    >
                      {scoreLabel(entry)}
                    </td>
                    <td style={{ width: 150, textAlign: 'right' }}>
                      {entry.role ? (
                        <RoleChip role={entry.role} />
                      ) : (
                        <span className="mono roster-table__awaiting">
                          Awaiting data
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/views/team/RosterView.test.tsx`
Expected: PASS (7 tests).

`teamColor` and `teamFg` are both exported from `src/components/design/Primitives.tsx` (lines 11 and 17).

- [ ] **Step 5: Add the styles**

Append to `src/App.css`:

```css
/* ---- Current roster view ---- */
.roster-view {
  padding: 18px 0 40px;
}
.roster-view__head {
  border-bottom: 1px solid var(--line);
  padding-bottom: 14px;
  margin-bottom: 18px;
}
.roster-view__title {
  font-size: 22px;
  margin: 0 0 6px;
}
.roster-view__stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--ink-3);
}
.roster-view__caveat {
  margin: 10px 0 0;
  max-width: 62ch;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-4);
}
.roster-view__empty {
  color: var(--ink-3);
  font-size: 13px;
  padding: 24px 0;
}
.roster-group {
  margin-bottom: 26px;
}
.roster-group__title {
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
  color: var(--team);
}
.roster-group__meta {
  font-size: 11px;
  color: var(--ink-4);
  margin-bottom: 6px;
}
.roster-table__origin,
.roster-table__seasons,
.roster-table__awaiting {
  font-size: 11px;
  color: var(--ink-4);
  white-space: nowrap;
}
.roster-table__seasons {
  text-align: right;
  width: 56px;
}
```

Before writing these, open `src/App.css` and confirm the CSS custom properties used above (`--line`, `--ink-3`, `--ink-4`, `--team`) exist. If a name differs, use the one the file actually defines — do not introduce new variables.

- [ ] **Step 6: Run the full suite and commit**

Run: `pnpm test`
Expected: PASS.

```bash
git add src/components/views/team/RosterView.tsx src/components/views/team/RosterView.test.tsx src/App.css
git commit -m "feat: add the current roster view"
```

---

### Task 4: Route, active view and Masthead tab

**Files:**

- Modify: `src/types.ts` (the `ActiveView` const at ~line 200)
- Modify: `src/lib/viewRouter.ts` (`determineActiveView`)
- Test: `src/lib/viewRouter.test.ts`
- Modify: `src/components/layout/Masthead.tsx`
- Test: `src/components/layout/Masthead.test.tsx`

**Interfaces:**

- Produces: `ActiveView.Roster === 'roster'`; `determineActiveView({ isYearView, isPositionView, isHighlightsView, isRosterView, hasSelectedTeam })`; `MastheadTab` gains `'roster'`; `Masthead` gains an optional `teamId?: string` prop.

Navigation only — the route itself is wired in Task 5.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/viewRouter.test.ts` inside the `determineActiveView` describe block:

```ts
it('selects the roster view when on a roster route', () => {
  expect(
    determineActiveView({
      isYearView: false,
      isPositionView: false,
      isRosterView: true,
      hasSelectedTeam: true,
    }),
  ).toBe(ActiveView.Roster);
});

it('lets a year route win over a roster route', () => {
  expect(
    determineActiveView({
      isYearView: true,
      isPositionView: false,
      isRosterView: true,
      hasSelectedTeam: true,
    }),
  ).toBe(ActiveView.DraftYears);
});
```

Add to `src/components/layout/Masthead.test.tsx`:

```tsx
it('offers both Team and Roster tabs when a team is open', () => {
  render(
    <MemoryRouter initialEntries={['/BUF']}>
      <Masthead
        active="team"
        teamId="BUF"
        dataLastUpdatedDate="Jan 1, 2026"
        onShowInfo={() => {}}
        dark={false}
        onToggleDark={() => {}}
      />
    </MemoryRouter>,
  );
  const labels = screen
    .getAllByRole('button')
    .map((b) => b.textContent)
    .filter(Boolean);
  expect(labels).toContain('Team');
  expect(labels).toContain('Roster');
});

it('omits the Roster tab when no team is open', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Masthead
        active="rankings"
        dataLastUpdatedDate="Jan 1, 2026"
        onShowInfo={() => {}}
        dark={false}
        onToggleDark={() => {}}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: 'Roster' })).toBeNull();
});
```

Match the existing `renderMasthead` helper in that file if its signature already covers these props — read the file first and extend the helper rather than duplicating it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/viewRouter.test.ts src/components/layout/Masthead.test.tsx`
Expected: FAIL — `ActiveView.Roster` undefined; no Roster tab rendered.

- [ ] **Step 3: Implement**

In `src/types.ts`, extend the `ActiveView` const:

```ts
export const ActiveView = {
  TeamDetail: 'teamDetail',
  TeamRankings: 'teamRankings',
  DraftYears: 'draftYears',
  Position: 'position',
  Highlights: 'highlights',
  Roster: 'roster',
} as const;
```

In `src/lib/viewRouter.ts`, extend `determineActiveView` — a roster route outranks the plain team route because both carry a team id:

```ts
export function determineActiveView({
  isYearView,
  isPositionView,
  isHighlightsView = false,
  isRosterView = false,
  hasSelectedTeam,
}: {
  isYearView: boolean;
  isPositionView: boolean;
  isHighlightsView?: boolean;
  isRosterView?: boolean;
  hasSelectedTeam: boolean;
}): ActiveView {
  if (isYearView) return ActiveView.DraftYears;
  if (isPositionView) return ActiveView.Position;
  if (isHighlightsView) return ActiveView.Highlights;
  if (isRosterView && hasSelectedTeam) return ActiveView.Roster;
  if (hasSelectedTeam) return ActiveView.TeamDetail;
  return ActiveView.TeamRankings;
}
```

Update the doc comment above it to name the roster route in the precedence list.

In `src/components/layout/Masthead.tsx`:

```ts
export type MastheadTab =
  'rankings' | 'team' | 'year' | 'pos' | 'highlights' | 'roster';
```

Add `teamId?: string;` to `MastheadProps` and to the destructured parameters, then replace the `goTeam` handler and the conditional Team entry:

```ts
const goTeam = () =>
  navigate({ pathname: teamId != null ? `/${teamId}` : '/', search });
const goRoster = () =>
  teamId != null && navigate({ pathname: `/roster/${teamId}`, search });

// Team and Roster are two views of one open team, so they appear together.
// Roster needs the id to link to and is dropped without one.
const inTeamContext =
  teamId != null || active === 'team' || active === 'roster';

const tabs: Array<{ id: MastheadTab; label: string; onClick: () => void }> = [
  { id: 'rankings', label: 'Rankings', onClick: goRankings },
  ...(inTeamContext
    ? [{ id: 'team' as const, label: 'Team', onClick: goTeam }]
    : []),
  ...(inTeamContext && teamId != null
    ? [{ id: 'roster' as const, label: 'Roster', onClick: goRoster }]
    : []),
  { id: 'highlights', label: 'Highlights', onClick: goHighlights },
  { id: 'year', label: 'Draft Year', onClick: goYear },
  { id: 'pos', label: 'Position', onClick: goPos },
];
```

Delete the now-stale comment above the old Team entry ("The Team tab points at a specific team's detail view, so it only makes sense once a team is selected…") and replace it with the two-line comment shown above.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/viewRouter.test.ts src/components/layout/Masthead.test.tsx`
Expected: PASS. The two pre-existing Masthead ordering tests must still pass — if one now sees an extra Roster tab, it is passing a `teamId`; adjust the assertion to include Roster in the expected order rather than removing the tab.

- [ ] **Step 5: Type-check and commit**

Run: `pnpm run type-check`
Expected: errors only in `src/App.tsx` if `ACTIVE_VIEW_TAB` does not yet map `ActiveView.Roster` — fix that map now by adding `[ActiveView.Roster]: 'roster',`, then re-run.

```bash
git add src/types.ts src/lib/viewRouter.ts src/lib/viewRouter.test.ts src/components/layout/Masthead.tsx src/components/layout/Masthead.test.tsx src/App.tsx
git commit -m "feat: add a Roster tab beside the Team tab"
```

---

### Task 5: Wire `/roster/:teamId` in App

**Files:**

- Modify: `src/App.tsx`
- Test: `src/App.roster.test.tsx` (create)

**Interfaces:**

- Consumes: `RosterView` (Task 3), `ActiveView.Roster` and `determineActiveView`'s `isRosterView` (Task 4).
- Produces: the `/roster/:teamId` route, rendered with all shipped draft classes.

Key facts for the implementer:

- `useDraftClassLoader(startYear, endYear)` loads only the selected year range. The roster must not be truncated by that range, so this route loads every year — the same trick `usePlayerLookup` already uses for an out-of-range player (see `loadDataForYears(generateYearArray(YEAR_MIN, YEAR_MAX))`).
- `loadData.ts` caches per file, so the extra load is paid once per session.
- `selectedTeam` already resolves from `useParams().teamId`, which the new route supplies.

- [ ] **Step 1: Write the failing test**

Create `src/App.roster.test.tsx`. Follow the established pattern in
`src/App.dataLoading.test.tsx`: mock `./lib/loadData` wholesale and import
`App` _after_ the mock is registered — do not stub `fetch`.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DraftClass } from './types';
import { DRAFT_YEAR_BOUNDS } from './lib/draftYearBounds';
import { makeDraftClass, makePick, makeSeason } from './test/factories';

const CURRENT = DRAFT_YEAR_BOUNDS.max;

/** The "where he stands" row update-data writes for the season ahead. */
const upcoming = makeSeason({
  year: CURRENT,
  gamesPlayed: 0,
  teamGames: 0,
  snapShare: 0,
  retained: true,
});

const CLASSES: DraftClass[] = [
  makeDraftClass({
    year: 2021,
    picks: [
      makePick({
        playerId: 'roster-starter',
        playerName: 'Roster Starter',
        position: 'QB',
        overallPick: 1,
        teamId: 'BUF',
        seasons: [makeSeason({ year: 2021 }), upcoming],
      }),
    ],
  }),
];

const loadDataForYears = vi.fn(async (years: number[]) =>
  CLASSES.filter((dc) => years.includes(dc.year)),
);
const loadDefaultRankings = vi.fn(async () => ({ rankings: [] }));
const loadTeamSuccess = vi.fn(async () => ({
  from: 2018,
  to: 2025,
  teams: [],
}));
const loadLaggedRankings = vi.fn(async () => ({
  from: 2018,
  to: 2021,
  rankings: [],
}));
const loadDataMeta = vi.fn(async () => null);

vi.mock('./lib/loadData', () => ({
  loadDataForYears,
  loadDefaultRankings,
  loadTeamSuccess,
  loadLaggedRankings,
  loadDataMeta,
}));

// Import App AFTER the mock is registered.
const { default: App } = await import('./App');

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('/roster/:teamId', () => {
  it('renders the team roster for a deep link', async () => {
    renderAt('/roster/BUF');
    expect(await screen.findByText('Roster Starter')).toBeInTheDocument();
    expect(await screen.findByText(/Current roster/)).toBeInTheDocument();
  });

  it('loads every shipped class, not just the selected range', async () => {
    renderAt('/roster/BUF');
    await screen.findByText('Roster Starter');
    const requested = loadDataForYears.mock.calls.map((c) => c[0]);
    expect(
      requested.some(
        (years) =>
          years.includes(DRAFT_YEAR_BOUNDS.min) &&
          years.includes(DRAFT_YEAR_BOUNDS.max),
      ),
    ).toBe(true);
  });

  it('redirects an unknown team to the rankings', async () => {
    renderAt('/roster/ZZZ');
    await screen.findByRole('button', { name: 'Rankings' });
    expect(screen.queryByText(/Current roster/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/App.roster.test.tsx`
Expected: FAIL — no route matches `/roster/BUF`, so the rankings render instead.

- [ ] **Step 3: Implement**

In `src/App.tsx`:

1. Add the lazy import beside the other view imports:

```tsx
const RosterView = lazy(() =>
  import('./components/views/team/RosterView').then((m) => ({
    default: m.RosterView,
  })),
);
```

2. Add the route in the `App` component:

```tsx
<Route path="/roster/:teamId" element={<AppContent />} />
```

Place it **before** `<Route path="/:teamId" …>` for readability; react-router matches the more specific path either way.

3. In `AppContent`, detect the route and feed `determineActiveView`:

```tsx
const isRosterView = !!useMatch('/roster/:teamId');
...
const activeView = determineActiveView({
  isYearView,
  isPositionView,
  isHighlightsView,
  isRosterView,
  hasSelectedTeam: selectedTeam != null,
});
```

4. Redirect an unknown team, next to the existing year-param redirect effect:

```tsx
useLayoutEffect(() => {
  if (isRosterView && selectedTeam == null) {
    navigate('/', { replace: true });
  }
}, [isRosterView, selectedTeam, navigate]);
```

5. Add the all-years loader above `AppContent` (mirrors `usePlayerLookup`'s approach):

```tsx
/**
 * Every shipped draft class, loaded only on the roster route.
 *
 * A current roster is a fact about today, not a slice of the year selector, so
 * it cannot be built from the range `useDraftClassLoader` fetched. `loadData`
 * caches per file, so the wider set is paid for once a session.
 */
function useRosterClasses(isRosterView: boolean): DraftClass[] | null {
  const [rosterClasses, setRosterClasses] = useState<DraftClass[] | null>(null);

  useEffect(() => {
    if (!isRosterView) return;
    let cancelled = false;
    loadDataForYears(generateYearArray(YEAR_MIN, YEAR_MAX))
      .then((all) => {
        if (!cancelled) setRosterClasses(all);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isRosterView]);

  return isRosterView ? rosterClasses : null;
}
```

Call it in `AppContent`: `const rosterClasses = useRosterClasses(isRosterView);`

6. Pass `rosterClasses` through `renderMainContent`: add `rosterClasses: DraftClass[] | null;` to `RenderMainArgs`, pass `rosterClasses` in the call object, and add this branch at the top of `renderMainContent`, right after the `isPlayerView` branch:

```tsx
if (a.activeView === ActiveView.Roster) {
  if (!a.selectedTeam || !a.rosterClasses) {
    return <LoadingSpinner message="Loading roster…" />;
  }
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RosterView teamId={a.selectedTeam} draftClasses={a.rosterClasses} />
    </Suspense>
  );
}
```

7. Give the Masthead the team id: `teamId={selectedTeam ?? undefined}` on the `<Masthead …>` element.

8. Add the Subbar breadcrumb. In `renderSubbar`, before the `ActiveView.TeamDetail` branch — no `YearRangeChips`, because this view ignores the range:

```tsx
if (activeView === ActiveView.Roster) {
  return (
    <Subbar>
      <button className="subbar__crumb" onClick={onShowRankings}>
        ← Rankings
      </button>
      <span className="subbar__slash">/</span>
      <span className="subbar__crumb-active">
        {selectedTeamName ?? selectedTeam}
      </span>
      <span className="subbar__slash">/</span>
      <span className="subbar__crumb-active">Current roster</span>
    </Subbar>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/App.roster.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole suite and commit**

Run: `pnpm test && pnpm run type-check && pnpm run lint`
Expected: PASS.

```bash
git add src/App.tsx src/App.roster.test.tsx
git commit -m "feat: serve the current roster at /roster/:teamId"
```

---

### Task 6: Entry point from the team page

**Files:**

- Modify: `src/components/views/team/TeamDetailContent.tsx` (the `TeamHero` component's `fab-link` block, around line 286)
- Test: `src/components/views/team/TeamDetailContent.test.tsx`

**Interfaces:**

- Consumes: the `/roster/:teamId` route (Task 5).
- Produces: a "Current roster" link in the team hero.

- [ ] **Step 1: Write the failing test**

Add to `src/components/views/team/TeamDetailContent.test.tsx`. That file already
has a `renderView(overrides?)` helper and a `const TEAM = 'KC'`, so the test
reuses both:

```tsx
it('links the team hero to the current roster', () => {
  renderView();
  const link = screen.getByRole('link', { name: /Current roster/ });
  expect(link.getAttribute('href')).toBe(`/roster/${TEAM}`);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/views/team/TeamDetailContent.test.tsx`
Expected: FAIL — no such link.

- [ ] **Step 3: Implement**

In `TeamHero`, immediately after the existing "← Back to rankings" button:

```tsx
<Link className="fab-link" to={`/roster/${selectedTeam}`}>
  Current roster →
</Link>
```

Add `import { Link } from 'react-router-dom';` if the file does not already import it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/views/team/TeamDetailContent.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/team/TeamDetailContent.tsx src/components/views/team/TeamDetailContent.test.tsx
git commit -m "feat: link the team page to its current roster"
```

---

### Task 7: SEO metadata and indexable routes

**Files:**

- Modify: `src/seo/routeMeta.ts`
- Test: `src/seo/routeMeta.test.ts`
- Modify: `src/seo/siteRoutes.ts`
- Test: `src/seo/siteRoutes.test.ts`

**Interfaces:**

- Produces: `resolveRouteMeta('/roster/BUF')` returning roster-specific title/description with `canonicalPath: '/roster/BUF'`; `buildSiteRoutes` emitting one `/roster/<team>` per team.

Both consumers — `scripts/seo/prerender-routes.ts` and `scripts/seo/generate-sitemap.ts` — read `buildSiteRoutes`, and `siteRoutes.test.ts` already asserts that every advertised route resolves to its own metadata (not the default). So the two files must land together.

- [ ] **Step 1: Write the failing tests**

Add to `src/seo/routeMeta.test.ts`:

```ts
it('describes a team roster route', () => {
  const meta = resolveRouteMeta('/roster/BUF');
  expect(meta.canonicalPath).toBe('/roster/BUF');
  expect(meta.title).toContain('Buffalo Bills');
  expect(meta.title).toContain('Roster');
  expect(meta).not.toEqual(DEFAULT_ROUTE_META);
});

it('falls back to the defaults for an unknown roster team', () => {
  expect(resolveRouteMeta('/roster/ZZZ')).toEqual(DEFAULT_ROUTE_META);
});
```

Add to `src/seo/siteRoutes.test.ts`:

```ts
it('publishes a roster route for every team', () => {
  const paths = buildSiteRoutes(['QB']).map((r) => r.path);
  for (const team of TEAMS) {
    expect(paths).toContain(`/roster/${team.id}`);
  }
});
```

Import `DEFAULT_ROUTE_META` / `TEAMS` if the test files do not already.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/seo/routeMeta.test.ts src/seo/siteRoutes.test.ts`
Expected: FAIL — `/roster/BUF` resolves to `DEFAULT_ROUTE_META`; no roster paths.

- [ ] **Step 3: Implement**

In `src/seo/routeMeta.ts`, add beside `teamMeta`:

```ts
function rosterMeta(teamId: string): RouteMeta | null {
  const team = teamsById.get(teamId);
  if (!team) return null;
  return {
    title: `${team.name} Current Roster | ${SITE_NAME}`,
    description: `Every ${team.name} player drafted since ${YEAR_MIN} who is on the roster now, with his career average draft success score, role and seasons played.`,
    canonicalPath: `/roster/${team.id}`,
  };
}
```

and in `resolveRouteMeta`'s two-segment branch:

```ts
if (prefix === 'roster') return rosterMeta(value) ?? DEFAULT_ROUTE_META;
```

In `src/seo/siteRoutes.ts`, inside the existing team loop:

```ts
for (const team of TEAMS) {
  routes.push({ path: `/${encodeURIComponent(team.id)}`, priority: '0.9' });
  routes.push({
    path: `/roster/${encodeURIComponent(team.id)}`,
    priority: '0.8',
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/seo/`
Expected: PASS, including the pre-existing "only advertises routes that resolve to their own metadata" test.

- [ ] **Step 5: Regenerate the sitemap and commit**

Run: `pnpm run generate-sitemap`
Expected: writes `public/sitemap.xml` with 32 more URLs.

```bash
git add src/seo/routeMeta.ts src/seo/routeMeta.test.ts src/seo/siteRoutes.ts src/seo/siteRoutes.test.ts public/sitemap.xml
git commit -m "feat: publish roster routes to the sitemap and prerender"
```

---

### Task 8: End-to-end coverage, full validation, visual verification

**Files:**

- Create: `e2e/roster.spec.ts`
- Modify: whatever the visual pass turns up

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Write the e2e spec**

Read an existing spec in `e2e/` first and copy its `test`/`expect` import style, base-URL handling and any `@smoke` tagging convention. Then create `e2e/roster.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('a team roster deep link renders and links back to the team page', async ({
  page,
}) => {
  await page.goto('/roster/BUF');
  await expect(
    page.getByRole('heading', { name: /Current roster/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Quarterbacks' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/BUF$/);
});

test('the team page opens its current roster', async ({ page }) => {
  await page.goto('/BUF');
  await page.getByRole('link', { name: /Current roster/ }).click();
  await expect(page).toHaveURL(/\/roster\/BUF$/);
});
```

- [ ] **Step 2: Run the e2e specs**

Run: `pnpm exec playwright test e2e/roster.spec.ts`
Expected: PASS. If the run hangs on startup, check for a stale dev server holding port 4173 (`lsof -i:4173`) before debugging the test.

- [ ] **Step 3: Run full validation**

Run: `pnpm run validate`
Expected: format, type-check, lint, duplication, unit tests and build all PASS. `lint:duplication` (jscpd) may flag `RosterView.tsx` against `PlayerList.tsx`; if it does, extract the shared row markup rather than adding an ignore.

- [ ] **Step 4: Visual verification**

Invoke `/visual-verify`. Zero tolerance: every visual, layout or UX issue it surfaces gets fixed in this task. Check at least: the roster page at desktop and mobile widths, light and dark themes, a team with many tracked players (PHI, ARI, HOU — 68-69) and one with few (MIN — 44), and the Team ↔ Roster tab toggle.

- [ ] **Step 5: Commit**

```bash
git add e2e/roster.spec.ts
git add -A
git commit -m "test: cover the current roster route end to end"
```

---

## Verification Checklist

Before calling the feature done:

- [ ] `pnpm run validate` passes.
- [ ] `pnpm exec playwright test` passes.
- [ ] `/visual-verify` passes with no outstanding issues.
- [ ] `/roster/BUF` deep-links correctly from a cold load (prerendered HTML present in `dist/roster/BUF/index.html` after `pnpm run build`).
- [ ] The roster page shows the same player count regardless of the year range chosen before navigating to it.
