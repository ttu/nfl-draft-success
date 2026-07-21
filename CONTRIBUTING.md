# Contributing to NFL Draft Success

Thanks for your interest in contributing. This guide explains how to get started and what to expect.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+ (`corepack enable pnpm`, or install via your version manager — the version is pinned in `package.json` / `.tool-versions`)

## Getting Started

1. **Fork and clone** the repository.
2. **Install dependencies:**
   ```bash
   pnpm install
   ```
3. **Run the validation suite** to confirm the environment works:
   ```bash
   pnpm validate
   ```
   This runs format check, type-check, lint, tests, and build.

## Development Workflow

### Start the dev server

```bash
pnpm dev
```

Open http://localhost:3273

### Useful commands

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `pnpm dev`              | Start dev server             |
| `pnpm build`            | Production build             |
| `pnpm test`             | Run unit tests               |
| `pnpm test:watch`       | Tests in watch mode (TDD)    |
| `pnpm lint`             | ESLint                       |
| `pnpm lint:fix`         | ESLint with auto-fix         |
| `pnpm lint:duplication` | jscpd copy-paste check       |
| `pnpm format`           | Format with Prettier         |
| `pnpm type-check`       | TypeScript check             |
| `pnpm validate`         | Format + lint + test + build |
| `pnpm update-data`      | Regenerate draft JSON        |

### Git hooks

Husky runs pre-commit checks (lint-staged, type-check, test, build). Run `pnpm install` to install hooks. **Do not use `--no-verify`** to skip them.

## Project Structure

| Path              | Purpose                       |
| ----------------- | ----------------------------- |
| `src/components/` | React components              |
| `src/lib/`        | Calculation logic, pure utils |
| `src/data/`       | Team metadata, data loading   |
| `public/data/`    | Draft JSON files              |
| `scripts/`        | Data fetch/transform scripts  |
| `docs/`           | Specs, plans, architecture    |

## Conventions

### New components

- Place in `src/components/`
- TypeScript props, CSS Modules
- Integration tests with React Testing Library

### Business logic

- Place in `src/lib/`
- Pure functions with full types
- Unit tests: `[function].test.ts` or `[Component].test.tsx`
- Reference [docs/SPEC_CLARIFICATIONS.md](docs/SPEC_CLARIFICATIONS.md) for formulas

### Code review expectations

- TypeScript types correct and complete
- Test coverage for new logic
- Accessible, responsive
- Error handling
- JSDoc for complex logic

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Type       | Use for                         |
| ---------- | ------------------------------- |
| `feat`     | New feature                     |
| `fix`      | Bug fix                         |
| `refactor` | Code change, no behavior change |
| `test`     | Test additions/updates          |
| `docs`     | Documentation only              |
| `style`    | Formatting, no code change      |
| `chore`    | Build, tooling, maintenance     |
| `ci`       | CI/CD changes                   |

Example: `feat: add role filter to player list`

## Pull Requests

1. Create a branch from `main`.
2. Make changes; run `pnpm validate` before pushing.
3. Open a PR with a clear title and description.
4. Address review feedback.

## Documentation

| Doc                                                        | Purpose                   |
| ---------------------------------------------------------- | ------------------------- |
| [docs/development.md](docs/development.md)                 | Setup, debugging          |
| [docs/architecture.md](docs/architecture.md)               | Tech stack, folder layout |
| [docs/calculations.md](docs/calculations.md)               | Calculation reference     |
| [docs/datamodel.md](docs/datamodel.md)                     | Types, JSON schema        |
| [docs/SPEC_CLARIFICATIONS.md](docs/SPEC_CLARIFICATIONS.md) | Formulas, edge cases      |
| [docs/plans/](docs/plans/)                                 | Implementation plans      |

## Updating Draft Data

To regenerate `public/data/draft-{year}.json` from [nflverse](https://github.com/nflverse/nflverse-data):

```bash
pnpm update-data
```

See [docs/datamodel.md](docs/datamodel.md) and [docs/calculations.md](docs/calculations.md) for schema and calculation details.
