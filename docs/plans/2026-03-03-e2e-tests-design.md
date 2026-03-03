# E2E Test Suite Design

**Date:** 2026-03-03
**Status:** Approved

## Goal

Comprehensive E2E test coverage for all major user flows using Playwright, integrated into CI.

## Setup

- **Framework:** Playwright Test (`@playwright/test` ^1.58.2, already installed)
- **Data:** Real static JSON from `public/data/`
- **Server:** `vite preview` via Playwright `webServer` config
- **Browser:** Chromium only (CI speed; expand later if needed)
- **Retries:** 0 locally, 2 in CI
- **Screenshots:** On failure only

## File Structure

```
e2e/
  landing-page.spec.ts
  team-detail.spec.ts
  year-range-filter.spec.ts
  role-filter.spec.ts
  departed-players.spec.ts
  url-state.spec.ts
  copy-link.spec.ts
playwright.config.ts
```

## npm Scripts

- `test:e2e` — `npx playwright test`
- `test:e2e:ui` — `npx playwright test --ui`

## CI Integration

Add Playwright E2E step to `.github/workflows/ci.yml` after the build step.

## Test Coverage (~33 tests)

### landing-page.spec.ts (~6 tests)

- Rankings table renders with all 32 teams
- Default year range applied (2020–2024)
- Teams sorted by score descending
- Team row shows score, rank, team name/logo
- Clicking team row navigates to team detail
- Info button opens info modal

### team-detail.spec.ts (~8 tests)

- `/:teamId` shows team header with logo
- Draft class cards render for each year in range
- Player list shows players with headshots
- Player cards show role badges with correct colors
- Back navigation returns to rankings
- Team selector dropdown changes team
- Five-year score card displays correctly
- Empty draft class shows appropriate message

### year-range-filter.spec.ts (~5 tests)

- Year range changes update URL params
- Filtered data reflects selected range
- Invalid range handled gracefully
- Year range persists on team navigation
- Direct URL with params loads correct range

### role-filter.spec.ts (~4 tests)

- Role filter toggles show/hide players by role
- Filter state persists in localStorage
- "All" state shows all players
- Filtering updates player count

### departed-players.spec.ts (~4 tests)

- Toggle unchecked by default
- Enabling shows departed players with distinct styling
- Departed cards show current team info
- Toggle state persists in localStorage

### url-state.spec.ts (~4 tests)

- Deep link to team + year range loads correctly
- Browser back/forward navigates between teams
- Changing filters updates URL without reload
- Shared URL reproduces exact view state

### copy-link.spec.ts (~2 tests)

- Copy link button copies URL to clipboard
- Copied URL includes current filters
