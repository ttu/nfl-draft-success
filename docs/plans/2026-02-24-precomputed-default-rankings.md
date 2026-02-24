# Pre-computed Default Rankings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate JSON data fetching on the default landing page (2021-2025) by serving pre-computed rankings from a tiny JSON file, making the initial render nearly instant.

**Architecture:** A build-time script reads the existing `draft-{year}.json` files (2021-2025), computes all 32 team rankings using the same scoring logic, and writes a ~2KB `default-rankings.json` to `public/data/`. The app loads this file first for the default view, then lazy-loads full draft data only when the user changes years or navigates to a team detail page.

**Tech Stack:** TypeScript (tsx script), existing scoring functions, Vite static serving

---

### Task 1: Create the generate-default-rankings script

**Files:**

- Create: `scripts/generate-default-rankings.ts`

**Step 1: Write the script**

The script imports scoring logic and team data, reads the 5 default-year JSON files from disk, computes rankings for all 32 teams, and writes the result to `public/data/default-rankings.json`.

```typescript
#!/usr/bin/env npx tsx
/**
 * Pre-compute default rankings (2021-2025) so the landing page
 * can render instantly without downloading ~1MB of draft data.
 *
 * Run: npx tsx scripts/generate-default-rankings.ts
 * Also runs automatically as part of `npm run update-data`.
 */
import * as fs from 'fs';
import * as path from 'path';

// We can't import from src/ (TSX/Vite aliases), so inline the minimal logic.
// This duplicates classifyRole, getPlayerRole, getFiveYearScore — but keeps
// the script self-contained and runnable outside Vite.

type Role =
  | 'core_starter'
  | 'starter_when_healthy'
  | 'significant_contributor'
  | 'depth'
  | 'non_contributor';

interface Season {
  year: number;
  gamesPlayed: number;
  teamGames: number;
  snapShare: number;
  retained: boolean;
}

interface DraftPick {
  playerId: string;
  playerName: string;
  position: string;
  round: number;
  overallPick: number;
  teamId: string;
  seasons: Season[];
}

interface DraftClass {
  year: number;
  picks: DraftPick[];
}

// --- Scoring logic (mirrors src/lib/) ---

function classifyRole(snapShare: number, gamesPlayedShare: number): Role {
  if (snapShare >= 0.65) {
    if (gamesPlayedShare >= 0.5) return 'core_starter';
    return 'starter_when_healthy';
  }
  if (snapShare >= 0.35) return 'significant_contributor';
  if (snapShare >= 0.1) return 'depth';
  return 'non_contributor';
}

const ROLE_ORDER: Role[] = [
  'non_contributor',
  'depth',
  'significant_contributor',
  'starter_when_healthy',
  'core_starter',
];

function roleWeight(r: Role): number {
  return ROLE_ORDER.indexOf(r);
}

function getPlayerRole(pick: DraftPick): Role {
  const seasons = pick.seasons.filter((s) => s.retained);
  if (seasons.length === 0) return 'non_contributor';

  const sortedByYear = [...seasons].sort((a, b) => b.year - a.year);
  if (sortedByYear[0].gamesPlayed === 0) return 'non_contributor';

  let best: Role = 'non_contributor';
  for (const s of seasons) {
    const gamesPlayedShare = s.teamGames > 0 ? s.gamesPlayed / s.teamGames : 0;
    const role = classifyRole(s.snapShare, gamesPlayedShare);
    if (roleWeight(role) > roleWeight(best)) best = role;
  }
  return best;
}

const ROLE_WEIGHTS: Record<string, number> = {
  core_starter: 3,
  starter_when_healthy: 3,
  significant_contributor: 2,
  depth: 1,
  non_contributor: 0,
};

function getFiveYearScore(draftClasses: DraftClass[], teamId: string) {
  let totalPicks = 0;
  let weightSum = 0;
  let coreStarterCount = 0;
  let retentionCount = 0;

  for (const draft of draftClasses) {
    const picks = draft.picks.filter((p) => p.teamId === teamId);
    for (const pick of picks) {
      totalPicks += 1;
      const role = getPlayerRole(pick);
      weightSum += ROLE_WEIGHTS[role] ?? 0;
      if (role === 'core_starter') coreStarterCount += 1;

      const latestSeason = [...pick.seasons].sort((a, b) => b.year - a.year)[0];
      if (latestSeason?.retained) retentionCount += 1;
    }
  }

  return {
    score: totalPicks > 0 ? weightSum / totalPicks : 0,
    totalPicks,
    coreStarterRate: totalPicks > 0 ? coreStarterCount / totalPicks : 0,
    retentionRate: totalPicks > 0 ? retentionCount / totalPicks : 0,
  };
}

// --- Team list (mirrors src/data/teams.ts) ---
const TEAMS = [
  { id: 'ARI', name: 'Arizona Cardinals' },
  { id: 'ATL', name: 'Atlanta Falcons' },
  { id: 'BAL', name: 'Baltimore Ravens' },
  { id: 'BUF', name: 'Buffalo Bills' },
  { id: 'CAR', name: 'Carolina Panthers' },
  { id: 'CHI', name: 'Chicago Bears' },
  { id: 'CIN', name: 'Cincinnati Bengals' },
  { id: 'CLE', name: 'Cleveland Browns' },
  { id: 'DAL', name: 'Dallas Cowboys' },
  { id: 'DEN', name: 'Denver Broncos' },
  { id: 'DET', name: 'Detroit Lions' },
  { id: 'GB', name: 'Green Bay Packers' },
  { id: 'HOU', name: 'Houston Texans' },
  { id: 'IND', name: 'Indianapolis Colts' },
  { id: 'JAX', name: 'Jacksonville Jaguars' },
  { id: 'KC', name: 'Kansas City Chiefs' },
  { id: 'LAC', name: 'Los Angeles Chargers' },
  { id: 'LAR', name: 'Los Angeles Rams' },
  { id: 'LV', name: 'Las Vegas Raiders' },
  { id: 'MIA', name: 'Miami Dolphins' },
  { id: 'MIN', name: 'Minnesota Vikings' },
  { id: 'NE', name: 'New England Patriots' },
  { id: 'NO', name: 'New Orleans Saints' },
  { id: 'NYG', name: 'New York Giants' },
  { id: 'NYJ', name: 'New York Jets' },
  { id: 'PHI', name: 'Philadelphia Eagles' },
  { id: 'PIT', name: 'Pittsburgh Steelers' },
  { id: 'SEA', name: 'Seattle Seahawks' },
  { id: 'SF', name: 'San Francisco 49ers' },
  { id: 'TB', name: 'Tampa Bay Buccaneers' },
  { id: 'TEN', name: 'Tennessee Titans' },
  { id: 'WAS', name: 'Washington Commanders' },
];

// --- Main ---

const DEFAULT_FROM = 2021;
const DEFAULT_TO = 2025;

function main() {
  const dataDir = path.join(process.cwd(), 'public', 'data');
  const years = Array.from(
    { length: DEFAULT_TO - DEFAULT_FROM + 1 },
    (_, i) => DEFAULT_FROM + i,
  );

  const draftClasses: DraftClass[] = years.map((year) => {
    const filePath = path.join(dataDir, `draft-${year}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  });

  const teamScores = TEAMS.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    ...getFiveYearScore(draftClasses, t.id),
  }));

  teamScores.sort((a, b) => b.score - a.score);

  const rankings = [];
  let rank = 1;
  let prevScore = Infinity;
  for (let i = 0; i < teamScores.length; i++) {
    if (teamScores[i].score < prevScore) rank = i + 1;
    prevScore = teamScores[i].score;
    rankings.push({ ...teamScores[i], rank });
  }

  const output = { from: DEFAULT_FROM, to: DEFAULT_TO, rankings };
  const outPath = path.join(dataDir, 'default-rankings.json');
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(
    `Wrote default rankings to ${outPath} (${rankings.length} teams)`,
  );
}

main();
```

**Step 2: Run the script and verify output**

Run: `npx tsx scripts/generate-default-rankings.ts`
Expected: Creates `public/data/default-rankings.json` with 32 team rankings.

**Step 3: Add npm script and hook into update-data**

In `package.json`, add the script and chain it after `update-data`:

```json
"generate-rankings": "tsx scripts/generate-default-rankings.ts",
"update-data": "tsx scripts/update-data.ts && tsx scripts/generate-default-rankings.ts"
```

**Step 4: Commit**

```bash
git add scripts/generate-default-rankings.ts public/data/default-rankings.json package.json
git commit -m "feat: add script to pre-compute default rankings JSON"
```

---

### Task 2: Add loader for default rankings

**Files:**

- Modify: `src/lib/loadData.ts`

**Step 1: Write the failing test**

Add to `src/lib/loadData.test.ts` a test for the new `loadDefaultRankings` function:

```typescript
describe('loadDefaultRankings', () => {
  it('fetches and returns default rankings data', async () => {
    const mockRankings = {
      from: 2021,
      to: 2025,
      rankings: [
        {
          teamId: 'DET',
          teamName: 'Detroit Lions',
          score: 2.0,
          rank: 1,
          totalPicks: 40,
          coreStarterRate: 0.3,
          retentionRate: 0.6,
        },
      ],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRankings),
    });

    const result = await loadDefaultRankings();
    expect(result).toEqual(mockRankings);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/loadData.test.ts`
Expected: FAIL — `loadDefaultRankings` is not exported.

**Step 3: Add the type and loader function to `src/lib/loadData.ts`**

```typescript
export interface DefaultRankingsData {
  from: number;
  to: number;
  rankings: Array<{
    teamId: string;
    teamName: string;
    score: number;
    rank: number;
    totalPicks: number;
    coreStarterRate: number;
    retentionRate: number;
  }>;
}

export async function loadDefaultRankings(): Promise<DefaultRankingsData> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/default-rankings.json`);
  if (!res.ok) {
    throw new Error(`Failed to load default rankings: ${res.status}`);
  }
  return res.json();
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/loadData.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/loadData.ts src/lib/loadData.test.ts
git commit -m "feat: add loadDefaultRankings function"
```

---

### Task 3: Use pre-computed rankings in App.tsx for default view

**Files:**

- Modify: `src/App.tsx`

This is the core change. The idea:

1. On mount, if the year range is the default (2021-2025) and we're on the rankings page, load `default-rankings.json` (~2KB) instead of the full draft data.
2. Show rankings immediately from this data.
3. Lazy-load full draft data in the background so that clicking a team doesn't require a second load delay.
4. When the user changes years away from default, load full data as before.

**Step 1: Add state for default rankings and modify the data loading effect**

Key changes to `AppContent`:

```typescript
import { loadDefaultRankings, type DefaultRankingsData } from './lib/loadData';

// New constant
const DEFAULT_YEAR_RANGE: [number, number] = [DEFAULT_YEAR_MIN, YEAR_MAX];

function isDefaultYearRange(range: [number, number]): boolean {
  return (
    range[0] === DEFAULT_YEAR_RANGE[0] && range[1] === DEFAULT_YEAR_RANGE[1]
  );
}

// Inside AppContent:
const [defaultRankings, setDefaultRankings] =
  useState<DefaultRankingsData | null>(null);

// New effect: load default rankings on mount (fast path)
useEffect(() => {
  loadDefaultRankings()
    .then(setDefaultRankings)
    .catch(() => {
      // Silently fail — will fall back to full data load
    });
}, []);

// Modify the existing data loading effect:
// Skip loading full data on initial mount when showing default rankings view,
// BUT still load it in the background for team detail navigation.
// The key insight: when we have defaultRankings and are on rankings view with
// default years, we can show rankings immediately. The full data load still
// proceeds in background for when user clicks a team.
```

**Step 2: Modify the rendering logic**

In the JSX, when we have `defaultRankings` and are showing the default year range on rankings view, use the pre-computed data instead of waiting for full data to load:

```typescript
// Before the return, compute what to show:
const useDefaultRankings =
  showRankingsView &&
  isDefaultYearRange(yearRange) &&
  defaultRankings !== null;

// In JSX, replace the loading/rankings conditional:
{loading && !useDefaultRankings ? (
  <LoadingSpinner message="Loading draft data…" />
) : (showRankingsView || !selectedTeam) && (useDefaultRankings || teamRank?.rankings) ? (
  <Suspense fallback={<LoadingSpinner />}>
    <TeamRankingsView
      rankings={useDefaultRankings ? defaultRankings!.rankings : teamRank!.rankings}
      yearCount={yearRange[1] - yearRange[0] + 1}
      onTeamSelect={handleTeamSelect}
      onBack={selectedTeam ? handleShowRankings : undefined}
    />
  </Suspense>
) : /* ... rest unchanged */}
```

**Step 3: Verify manually**

Run: `npm run dev`

- Open http://localhost:3000 — should see rankings almost instantly (no spinner)
- Change year range — should still work (loads full data)
- Click a team — should work (full data loaded in background)

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use pre-computed rankings for instant default landing page"
```

---

### Task 4: Hook into build pipeline

**Files:**

- Modify: `package.json`

**Step 1: Ensure generate-rankings runs during build**

Update the build script so rankings are always fresh:

```json
"build": "npm run generate-og-image && npm run generate-rankings && tsc -b && vite build"
```

This ensures that if draft data is updated, the default rankings are regenerated before building.

**Step 2: Run full validation**

Run: `npm run validate`
Expected: All checks pass (format, types, lint, test, build).

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add generate-rankings to build pipeline"
```

---

### Task 5: Verify end-to-end

**Step 1: Build and preview**

Run: `npm run build && npm run preview`

**Step 2: Test in browser**

- Open the preview URL with default params — should render instantly
- Change years — should still work
- Click a team — should show team detail
- Refresh on a team page — should work

**Step 3: Check file size**

Run: `ls -la public/data/default-rankings.json`
Expected: ~2-3KB file
