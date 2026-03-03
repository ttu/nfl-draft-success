# Show Departed Players Toggle — Design

## Summary

Add a toggle to the Current Roster section that allows showing players who have left the drafting team, along with their current team and role context. Off by default; when enabled, departed players appear in the same draft-year groups at reduced opacity with a team badge.

## Data Changes

### Types (`src/types.ts`)

Add optional `currentTeam` field to `Season`:

```typescript
export interface Season {
  // ... existing fields
  currentTeam?: string; // Team abbreviation when retained === false
}
```

### Data Script (`scripts/update-data.ts`)

- When `retained === false`, write `primaryTeam` (normalized) as `currentTeam` in the season JSON
- When `retained === true`, omit `currentTeam` (saves space, same team implied)
- When player has no snap/injury data and is not retained, `currentTeam` remains undefined → UI shows "FA"

### Data Regeneration

Regenerate all `public/data/draft-{year}.json` files with the updated script.

## UI Changes

### Toggle Switch

- Location: Current Roster section header, next to existing role filter
- Label: "Show departed"
- State: persisted to `localStorage` (key: `showDeparted`)
- Default: off (current behavior preserved)

### Roster Filtering Logic (`App.tsx`)

- Toggle OFF: filter to `retained === true` (current behavior)
- Toggle ON: include ALL draft picks for the team, both retained and departed

### Player Card Visual Treatment (`PlayerList.tsx`)

**Retained players:** No change.

**Departed players:**

- Card opacity: ~65%
- Team badge: small abbreviation in card corner showing current team (e.g., "NYG")
  - If `currentTeam` is undefined → show "FA" (free agent / out of NFL)
- Role badge: shows role **on the drafting team** (using `draftingTeamOnly: true`)
- If overall career role differs from drafting-team role, show subtle indicator

### Grouping

Departed players appear alongside retained players in their draft-year group. No separate section — they're integrated into the existing layout with visual distinction via opacity.

## Implementation Notes

- `currentTeam` is optional and additive — no breaking changes to existing data consumers
- Toggle state is independent of role filter — both can be active simultaneously
- Departed players respect the active role filter (filtered by their drafting-team role)
