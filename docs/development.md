# Development Guide

## Setup

### Prerequisites

- Node.js 20+
- npm

### Create Project

```bash
npm create vite@latest . -- --template react-ts
npm install
```

### Install Dependencies

See [architecture.md](architecture.md) for full dev dependency list. Key additions:

- ESLint, Prettier, Husky, lint-staged
- Vitest, @testing-library/react, jsdom
- tsx (for update-data script)

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start dev server               |
| `npm run build`   | Production build               |
| `npm run preview` | Preview production build       |
| `npm run lint`    | ESLint (zero warnings)         |
| `npm run lint:fix`| Fix ESLint issues              |
| `npm run format`  | Format with Prettier           |
| `npm run format:check` | Check formatting           |
| `npm run type-check` | TypeScript check           |
| `npm test`        | Run Vitest                     |
| `npm run test:watch` | Vitest watch mode           |
| `npm run validate` | Format + lint + test + build |
| `npm run update-data` | Update JSON from nflverse |

## Data Updates

Run `npm run update-data` to fetch nflverse data and regenerate `public/data/draft-{year}.json`. See [data model](datamodel.md) and plan for schema.

## Git Hooks

- **Pre-commit:** lint-staged, type-check, test, build
- **Pre-push:** Rebase-on-main check

Run `npm install` to install Husky hooks.

## Debugging

- Dev server: `http://localhost:5173`
- Vitest: `npm run test:watch` for TDD
