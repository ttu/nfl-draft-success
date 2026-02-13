# NFL Draft MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a front-end-only static site that evaluates NFL draft success by team using snap share, games played, and retention. Team-centric view; data from version-controlled JSON; no backend.

**Architecture:** Vite + React + TypeScript. Data in `public/data/draft-{year}.json`. Client-side role classification and metrics. Script updates JSON from nflverse.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Vitest 4, ESLint 9, Prettier, Husky, tsx.

**Reference:** [docs/SPEC_CLARIFICATIONS.md](../SPEC_CLARIFICATIONS.md), [docs/datamodel.md](../datamodel.md), [docs/architecture.md](../architecture.md).

---

## Phase 1: Bootstrap

### Task 1: Create Vite + React + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

**Step 1:** Run `npm create vite@latest . -- --template react-ts`

**Step 2:** Run `npm install`

**Step 3:** Run `npm run dev` — verify app loads

**Step 4:** Commit: `chore: bootstrap Vite + React + TS project`

---

### Task 2: Add ESLint, Prettier, configs

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (scripts, lint-staged, devDependencies)

**Step 1:** Install: `npm install -D eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier prettier`

**Step 2:** Add `eslint.config.js` (see architecture plan — no Storybook)

**Step 3:** Add `.prettierrc.json`, `.prettierignore`

**Step 4:** Add scripts: lint, lint:fix, format, format:check, type-check

**Step 5:** Run `npm run lint`, `npm run format:check` — verify

**Step 6:** Commit: `chore: add ESLint and Prettier`

---

### Task 3: Add Vitest + React Testing Library

**Files:**
- Modify: `vite.config.ts`, `package.json`
- Create: `src/lib/example.test.ts` (smoke test)

**Step 1:** Install: `npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom`

**Step 2:** Configure Vitest in `vite.config.ts`

**Step 3:** Create minimal test, run `npm test`

**Step 4:** Commit: `chore: add Vitest and RTL`

---

### Task 4: Add Git hooks (Husky, lint-staged)

**Files:**
- Create: `.husky/pre-commit`, `.husky/pre-push`
- Modify: `package.json` (prepare, lint-staged)

**Step 1:** Install: `npm install -D husky lint-staged`

**Step 2:** Add `"prepare": "husky"`, run `npm run prepare`

**Step 3:** Create `.husky/pre-commit` (lint-staged, type-check, test, build)

**Step 4:** Create `.husky/pre-push` (rebase-on-main check, no i18n)

**Step 5:** Add lint-staged config to package.json

**Step 6:** Commit: `chore: add pre-commit and pre-push hooks`

---

### Task 5: Add TypeScript types for DraftPick, Season, Team

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/types.test.ts`

**Step 1:** Write failing test: `expect(typeof pick.playerId).toBe('string')` (or type guard test)

**Step 2:** Run test — fail

**Step 3:** Add types from [datamodel.md](../datamodel.md): `Season`, `DraftPick`, `Team`, `DraftClass`

**Step 4:** Run test — pass

**Step 5:** Commit: `feat: add DraftPick, Season, Team types`

---

### Task 6: Add 32-team metadata

**Files:**
- Create: `src/data/teams.ts` (TEAMS constant)
- Create: `src/data/teams.test.ts`

**Step 1:** Write test: load TEAMS, assert length 32, assert KC exists

**Step 2:** Implement TEAMS with id, name, abbreviation for all 32 teams

**Step 3:** Commit: `feat: add 32-team metadata`

---

### Task 7: Add mock JSON and data loader

**Files:**
- Create: `public/data/draft-2023.json` (minimal, 1–2 picks)
- Create: `src/lib/loadData.ts` (fetch and parse)
- Create: `src/lib/loadData.test.ts`

**Step 1:** Create mock JSON per [datamodel.md](../datamodel.md)

**Step 2:** Write test: loadData('2023') returns DraftClass with picks

**Step 3:** Implement loadData using fetch

**Step 4:** Commit: `feat: add mock data and loader`

---

## Phase 2: Core Logic + Data Script

### Task 8: Implement classifyRole with tests

**Files:**
- Create: `src/lib/classifyRole.ts`
- Create: `src/lib/classifyRole.test.ts`

**Step 1:** Write failing tests per [SPEC_CLARIFICATIONS](../SPEC_CLARIFICATIONS.md): core_starter, starter_when_healthy, significant_contributor, depth, non_contributor

**Step 2:** Implement classifyRole(snapShare, gamesPlayedShare)

**Step 3:** All tests pass

**Step 4:** Commit: `feat: add role classification`

---

### Task 9: Implement getPlayerRole (max across seasons)

**Files:**
- Create: `src/lib/getPlayerRole.ts`
- Create: `src/lib/getPlayerRole.test.ts`

**Step 1:** Write test: player with seasons → highest role wins

**Step 2:** Implement using classifyRole per season, return max

**Step 3:** Commit: `feat: add getPlayerRole`

---

### Task 10: Implement getDraftClassMetrics

**Files:**
- Create: `src/lib/getDraftClassMetrics.ts`
- Create: `src/lib/getDraftClassMetrics.test.ts`

**Step 1:** Write tests: total picks, core starter count, contributor count, retention count, rates

**Step 2:** Implement per [SPEC_CLARIFICATIONS](../SPEC_CLARIFICATIONS.md)

**Step 3:** Commit: `feat: add draft class metrics`

---

### Task 11: Implement getFiveYearScore

**Files:**
- Create: `src/lib/getFiveYearScore.ts`
- Create: `src/lib/getFiveYearScore.test.ts`

**Step 1:** Write test: score = sum(weights)/picks

**Step 2:** Implement with Core Starter %, Retention %

**Step 3:** Commit: `feat: add 5-year rolling score`

---

### Task 12: Implement update-data script

**Files:**
- Create: `scripts/update-data.ts`
- Modify: `package.json` (update-data script, tsx dep)

**Step 1:** Install: `npm install -D tsx`; add `csv-parse` or use built-in fetch + manual parse

**Step 2:** Implement: fetch draft_picks.csv, snap_counts_{year}.csv, roster_{year}.csv from nflverse

**Step 3:** Transform: join, aggregate snap share, games played, retention

**Step 4:** Write `public/data/draft-{year}.json` per year

**Step 5:** Run `npm run update-data`, verify output

**Step 6:** Commit: `feat: add update-data script`

---

## Phase 3: UI

### Task 13: Team selector component

**Files:**
- Create: `src/components/TeamSelector.tsx`
- Create: `src/components/TeamSelector.test.tsx`

**Step 1:** Write test: renders dropdown, onChange fires

**Step 2:** Implement dropdown using TEAMS

**Step 3:** Commit: `feat: add TeamSelector`

---

### Task 14: Year range filter

**Files:**
- Create: `src/components/YearRangeFilter.tsx`
- Create: `src/components/YearRangeFilter.test.tsx`

**Step 1:** Write test: default 2018–2024, onChange fires

**Step 2:** Implement

**Step 3:** Commit: `feat: add YearRangeFilter`

---

### Task 15: Draft class metrics card

**Files:**
- Create: `src/components/DraftClassCard.tsx`
- Create: `src/components/DraftClassCard.test.tsx`

**Step 1:** Write test: displays picks, core starters, contributors, retention

**Step 2:** Implement using getDraftClassMetrics

**Step 3:** Commit: `feat: add DraftClassCard`

---

### Task 16: 5-year score card

**Files:**
- Create: `src/components/FiveYearScoreCard.tsx`
- Create: `src/components/FiveYearScoreCard.test.tsx`

**Step 1:** Write test: displays score, Core Starter %, Retention %

**Step 2:** Implement using getFiveYearScore

**Step 3:** Commit: `feat: add FiveYearScoreCard`

---

### Task 17: Player list with role badges

**Files:**
- Create: `src/components/PlayerList.tsx`
- Create: `src/components/PlayerList.test.tsx`

**Step 1:** Write test: renders players with role labels

**Step 2:** Implement list with role badge per player

**Step 3:** Commit: `feat: add PlayerList`

---

### Task 18: Wire up App

**Files:**
- Modify: `src/App.tsx`

**Step 1:** Integrate: TeamSelector, YearRangeFilter, load data, DraftClassCard(s), FiveYearScoreCard, PlayerList

**Step 2:** Add state: selectedTeam, yearRange, draftData

**Step 3:** Run `npm run dev`, manual test

**Step 4:** Commit: `feat: wire up App with all components`

---

## Phase 4: Polish

### Task 19: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1:** Add ci.yml from plan (lint, type-check, test, build)

**Step 2:** Commit: `ci: add CI workflow`

---

### Task 20: GitHub Actions Deploy

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1:** Add deploy.yml (build, deploy-pages)

**Step 2:** Configure repo: Settings → Pages → Source: GitHub Actions

**Step 3:** Commit: `ci: add deploy to GitHub Pages`

---

### Task 21: Ongoing season handling

**Files:**
- Modify: `src/lib/` (ensure partial teamGames handled)
- Modify: `scripts/update-data.ts` (partial seasons)

**Step 1:** Verify metrics work when teamGames < 17

**Step 2:** Update script for in-progress seasons

**Step 3:** Commit: `fix: handle ongoing seasons`

---

### Task 22: README and acceptance check

**Files:**
- Create/Modify: `README.md`

**Step 1:** Add: quick start, features, scripts, deploy

**Step 2:** Run `npm run validate`, `npm run build`

**Step 3:** Verify: 32 teams, 6+ years, static build works

**Step 4:** Commit: `docs: add README, validate acceptance`

---

## Execution Options

After saving the plan:

**1. Subagent-Driven (this session)** — Fresh subagent per task, review between tasks.

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints.
