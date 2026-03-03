# Show Departed Players Toggle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle to the Current Roster section showing departed players with reduced opacity and their current team badge.

**Architecture:** Add `currentTeam` to season data (data script + types), add toggle state to App, modify PlayerList to render departed players distinctly with team badges.

**Tech Stack:** React, TypeScript, Vite, CSS (no modules — single App.css), Vitest + React Testing Library

---

### Task 1: Add `currentTeam` to Season type

**Files:**

- Modify: `src/types.ts:8-16`

**Step 1: Update the Season interface**

In `src/types.ts`, add `currentTeam` to the `Season` interface:

```typescript
export interface Season {
  year: number;
  gamesPlayed: number;
  teamGames: number;
  snapShare: number;
  retained: boolean;
  /** Weeks on official injury report (from nflverse injuries data) */
  injuryReportWeeks?: number;
  /** Team abbreviation the player played for (set when retained === false) */
  currentTeam?: string;
}
```

**Step 2: Run existing tests to verify no breakage**

Run: `npx vitest run`
Expected: All tests pass (currentTeam is optional, no breakage)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add currentTeam field to Season type"
```

---

### Task 2: Update data script to include `currentTeam`

**Files:**

- Modify: `scripts/update-data.ts:262-278` (season type in picks array)
- Modify: `scripts/update-data.ts:334-341` (season push block)

**Step 1: Update the inline season type in the picks array**

At line ~270, add `currentTeam` to the inline type:

```typescript
seasons: Array<{
  year: number;
  gamesPlayed: number;
  teamGames: number;
  snapShare: number;
  retained: boolean;
  injuryReportWeeks?: number;
  currentTeam?: string;
}>;
```

Also update the `seasons` variable declaration at line ~290 to match.

**Step 2: Modify the season push block**

At line ~334, after computing `retained`, compute `currentTeam`:

```typescript
// Determine currentTeam for departed players
const currentTeamId = !retained
  ? primaryTeam !== ''
    ? normalizeTeam(primaryTeam)
    : injuryTeam !== ''
      ? normalizeTeam(injuryTeam)
      : undefined
  : undefined;

seasons.push({
  year: s,
  gamesPlayed,
  teamGames,
  snapShare,
  retained,
  ...(injuryReportWeeks > 0 ? { injuryReportWeeks } : {}),
  ...(currentTeamId ? { currentTeam: currentTeamId } : {}),
});
```

**Step 3: Verify the script compiles**

Run: `npx tsx scripts/update-data.ts --help 2>&1 || echo "Script parses OK"`
(We won't run the full data fetch yet — just ensure no syntax errors.)

**Step 4: Commit**

```bash
git add scripts/update-data.ts
git commit -m "feat: include currentTeam in data script output for departed players"
```

---

### Task 3: Regenerate data files

**Step 1: Run the data script**

Run: `npx tsx scripts/update-data.ts`
Expected: Regenerates `public/data/draft-{2018..2025}.json` with `currentTeam` fields

**Step 2: Spot-check a data file**

Read `public/data/draft-2020.json` and find a player with `retained: false` in a recent season. Verify `currentTeam` is present.

**Step 3: Commit**

```bash
git add public/data/
git commit -m "chore: regenerate draft data with currentTeam field"
```

---

### Task 4: Add storage helpers for showDeparted toggle

**Files:**

- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

**Step 1: Write the failing tests**

Add to `src/lib/storage.test.ts`:

```typescript
import {
  loadRoleFilter,
  saveRoleFilter,
  loadShowDeparted,
  saveShowDeparted,
} from './storage';

// ... existing tests ...

describe('showDeparted storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when localStorage is empty', () => {
    expect(loadShowDeparted()).toBe(false);
  });

  it('loads and persists true', () => {
    saveShowDeparted(true);
    expect(loadShowDeparted()).toBe(true);
  });

  it('loads and persists false', () => {
    saveShowDeparted(false);
    expect(loadShowDeparted()).toBe(false);
  });

  it('returns false for non-boolean stored value', () => {
    localStorage.setItem('nfl-draft-success-show-departed', '"yes"');
    expect(loadShowDeparted()).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `loadShowDeparted` and `saveShowDeparted` not exported

**Step 3: Implement storage helpers**

Add to `src/lib/storage.ts`:

```typescript
const SHOW_DEPARTED_KEY = 'nfl-draft-success-show-departed';

/**
 * Load persisted showDeparted toggle. Returns false if not stored or invalid.
 */
export function loadShowDeparted(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DEPARTED_KEY);
    if (raw === null) return false;
    const parsed = JSON.parse(raw) as unknown;
    return parsed === true;
  } catch {
    return false;
  }
}

/**
 * Persist showDeparted toggle.
 */
export function saveShowDeparted(value: boolean): void {
  try {
    localStorage.setItem(SHOW_DEPARTED_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / private mode errors
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: All pass

**Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add showDeparted localStorage helpers"
```

---

### Task 5: Update App.tsx roster logic for departed players

**Files:**

- Modify: `src/App.tsx`

**Step 1: Add showDeparted state and persist it**

After the `roleFilter` state (line ~83), add:

```typescript
const [showDeparted, setShowDeparted] = useState(() => loadShowDeparted());
```

Add import for `loadShowDeparted` and `saveShowDeparted` from `'./lib/storage'`.

Add effect to persist (after the roleFilter effect at line ~95):

```typescript
useEffect(() => {
  saveShowDeparted(showDeparted);
}, [showDeparted]);
```

**Step 2: Modify roster filtering to include departed players**

Replace the `retainedPicks` and `filteredRetainedPicks` logic (lines 221-228) with:

```typescript
const rosterPicks = showDeparted
  ? allTeamPicks
  : allTeamPicks.filter(({ pick }) => {
      const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
      return latestSeason?.retained === true;
    });

const filteredRosterPicks = rosterPicks.filter(({ pick }) =>
  roleFilterAllows(roleFilter, getPlayerRole(pick, { draftingTeamOnly })),
);
```

**Step 3: Update rosterByDraftYear to use new variable**

Replace `filteredRetainedPicks` with `filteredRosterPicks` in the `rosterByDraftYear` computation (lines 230-240).

**Step 4: Pass showDeparted and setShowDeparted to TeamDetailContent**

Add to the `<TeamDetailContent>` props:

```typescript
showDeparted = { showDeparted };
setShowDeparted = { setShowDeparted };
```

**Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: Will fail until TeamDetailContent accepts the new props (Task 6)

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add showDeparted state and roster filtering logic"
```

---

### Task 6: Add toggle to TeamDetailContent

**Files:**

- Modify: `src/components/TeamDetailContent.tsx`

**Step 1: Update props interface**

Add to `TeamDetailContentProps`:

```typescript
showDeparted: boolean;
setShowDeparted: (value: boolean) => void;
```

**Step 2: Destructure new props**

Add `showDeparted` and `setShowDeparted` to the destructured props.

**Step 3: Add toggle in the roster header**

In the `app-players__header` div, add the toggle switch after the `<h2>` and before `<RoleFilter>`:

```tsx
<label className="app-players__departed-toggle">
  <input
    type="checkbox"
    checked={showDeparted}
    onChange={(e) => setShowDeparted(e.target.checked)}
    aria-label="Show departed players"
  />
  <span>Show departed</span>
</label>
```

**Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: Pass

**Step 5: Commit**

```bash
git add src/components/TeamDetailContent.tsx
git commit -m "feat: add show departed toggle to roster section header"
```

---

### Task 7: Update PlayerList to render departed players distinctly

**Files:**

- Modify: `src/components/PlayerList.tsx`
- Modify: `src/components/PlayerList.test.tsx`

**Step 1: Write the failing test**

Add a test for departed player rendering in `PlayerList.test.tsx`:

```typescript
it('renders departed players with current team badge and departed class', () => {
  const departedPicks = [
    {
      pick: {
        playerId: 'p3',
        playerName: 'Traded Away',
        position: 'WR',
        round: 2,
        overallPick: 40,
        teamId: 'KC',
        seasons: [
          {
            year: 2022,
            gamesPlayed: 16,
            teamGames: 17,
            snapShare: 0.7,
            retained: true,
          },
          {
            year: 2023,
            gamesPlayed: 17,
            teamGames: 17,
            snapShare: 0.8,
            retained: false,
            currentTeam: 'NYG',
          },
        ],
      } as DraftPick,
      draftYear: 2022,
    },
  ];
  render(<PlayerList picks={departedPicks} teamId="KC" draftingTeamOnly />);
  expect(screen.getByText('Traded Away')).toBeInTheDocument();
  expect(screen.getByText('NYG')).toBeInTheDocument();
  const card = screen.getByRole('listitem');
  expect(card.className).toContain('player-card--departed');
});

it('shows FA for departed players with no currentTeam', () => {
  const faPicks = [
    {
      pick: {
        playerId: 'p4',
        playerName: 'Free Agent Guy',
        position: 'RB',
        round: 5,
        overallPick: 150,
        teamId: 'KC',
        seasons: [
          {
            year: 2022,
            gamesPlayed: 10,
            teamGames: 17,
            snapShare: 0.4,
            retained: true,
          },
          {
            year: 2023,
            gamesPlayed: 0,
            teamGames: 17,
            snapShare: 0,
            retained: false,
          },
        ],
      } as DraftPick,
      draftYear: 2022,
    },
  ];
  render(<PlayerList picks={faPicks} teamId="KC" draftingTeamOnly />);
  expect(screen.getByText('FA')).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/PlayerList.test.tsx`
Expected: FAIL

**Step 3: Implement departed player rendering**

In `PlayerList.tsx`, modify the component:

1. Add a helper to determine if a player has departed:

```typescript
function isDeparted(pick: DraftPick): boolean {
  const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
  return latestSeason?.retained === false;
}

function getCurrentTeam(pick: DraftPick): string | undefined {
  const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
  return latestSeason?.currentTeam;
}
```

2. In the `li` element, add a conditional class:

```tsx
className={`player-card${isDeparted(pick) ? ' player-card--departed' : ''}`}
```

3. For departed players, replace the team logo in the accent bar with the current team's logo and add a team badge. Add after the badge div, inside the `li`:

```tsx
{
  isDeparted(pick) && (
    <div
      className="player-card__current-team"
      aria-label={`Now on ${getCurrentTeam(pick) ?? 'FA'}`}
    >
      {getCurrentTeam(pick) ?? 'FA'}
    </div>
  );
}
```

4. Update the grid to accommodate. For departed players, show the current team's logo instead of the drafting team's logo in the accent bar:

```tsx
const departed = isDeparted(pick);
const displayTeamId = departed ? (getCurrentTeam(pick) ?? teamId) : teamId;
const displayLogoUrl = departed
  ? getTeamLogoUrl(getCurrentTeam(pick) ?? '')
  : logoUrl;
const displayAccentColor = departed
  ? (TEAM_COLORS[getCurrentTeam(pick) ?? ''] ?? '#4a5568')
  : accentColor;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/PlayerList.test.tsx`
Expected: All pass

**Step 5: Commit**

```bash
git add src/components/PlayerList.tsx src/components/PlayerList.test.tsx
git commit -m "feat: render departed players with current team badge"
```

---

### Task 8: Add CSS for departed players and toggle

**Files:**

- Modify: `src/App.css`

**Step 1: Add departed player styles**

Add to `src/App.css`:

```css
/* Departed player toggle */
.app-players__departed-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: #888;
  -webkit-tap-highlight-color: transparent;
}

.app-players__departed-toggle input {
  width: 18px;
  height: 18px;
  accent-color: #4a5568;
  cursor: pointer;
}

/* Departed player card */
.player-card--departed {
  opacity: 0.55;
}

.player-card--departed:hover {
  opacity: 0.75;
}

.player-card__current-team {
  grid-area: badge;
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.2rem 0.4rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  letter-spacing: 0.03em;
}
```

Wait — the current-team badge should NOT overlap the role badge area. Let me reconsider the layout.

Better approach: add the current team text inline in the meta line:

Instead of a separate div, modify PlayerList to show current team in the meta text:
`QB · Pick 40 · → NYG` for departed players.

This is simpler and doesn't require grid changes.

**Revised approach for the current team display:**

In `PlayerList.tsx`, modify the meta span for departed players:

```tsx
<span className="player-card__meta">
  {pick.position} · Pick {pick.overallPick}
  {departed && (
    <span className="player-card__departed-team">
      {' → '}
      {getCurrentTeam(pick) ?? 'FA'}
    </span>
  )}
</span>
```

CSS:

```css
.player-card__departed-team {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}
```

And for light mode:

```css
@media (prefers-color-scheme: light) {
  .player-card__departed-team {
    color: rgba(0, 0, 0, 0.6);
  }
}
```

**Step 2: Verify styles visually**

Run: `npm run dev` and check the UI

**Step 3: Commit**

```bash
git add src/App.css
git commit -m "style: add departed player and toggle styles"
```

---

### Task 9: Run full test suite and verify

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npx eslint src/ --ext .ts,.tsx`
Expected: No errors

**Step 4: Run visual verification**

Invoke `/visual-verify` to confirm the UI looks correct.

---

### Task 10: Final commit

**Step 1: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: show departed players toggle with current team display"
```
