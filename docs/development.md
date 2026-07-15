# Development Guide

## Setup

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+ (version pinned in `package.json` / `.tool-versions`; run `corepack enable pnpm` or install via your version manager)

### Create Project

```bash
pnpm create vite@latest . --template react-ts
pnpm install
```

### Install Dependencies

See [architecture.md](architecture.md) for full dev dependency list. Key additions:

- ESLint, Prettier, Husky, lint-staged
- Vitest, @testing-library/react, jsdom
- tsx (for update-data script)

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `pnpm dev`          | Start dev server             |
| `pnpm build`        | Production build             |
| `pnpm preview`      | Preview production build     |
| `pnpm lint`         | ESLint (zero warnings)       |
| `pnpm lint:fix`     | Fix ESLint issues            |
| `pnpm format`       | Format with Prettier         |
| `pnpm format:check` | Check formatting             |
| `pnpm type-check`   | TypeScript check             |
| `pnpm test`         | Run Vitest                   |
| `pnpm test:watch`   | Vitest watch mode            |
| `pnpm validate`     | Format + lint + test + build |
| `pnpm update-data`  | Update JSON from nflverse    |

## Data Updates

Run `pnpm update-data` to fetch nflverse data and regenerate `public/data/draft-{year}.json`. See [data model](datamodel.md) and plan for schema.

## Git Hooks

- **Pre-commit:** lint-staged, type-check, test, build
- **Pre-push:** Rebase-on-main check

Run `pnpm install` to install Husky hooks.

## Debugging

- Dev server: `http://localhost:3273`
- Vitest: `pnpm test:watch` for TDD
