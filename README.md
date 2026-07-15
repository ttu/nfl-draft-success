# NFL Draft Success

A static site that evaluates NFL draft success by team using snap share, games played, and retention. Team-centric view with draft class metrics and a rolling draft score over the years you select.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3273

## Features

- **32 NFL teams** – Select any team to view their draft performance
- **Configurable year range** – Select any span within 2018–2025 (default 2021–2025)
- **Role classification** – Core Starter, Starter When Healthy, Significant Contributor, Depth, Non Contributor (from snap share + availability)
- **Draft class metrics** – Picks, core starters, contributors, retention per year
- **Rolling draft score** – Aggregated score across your chosen year range, with Core Starter % and Retention %
- **Player list** – Retained draft picks with draft year, position, and role

## Scripts

| Script             | Description                         |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Start dev server                    |
| `pnpm build`       | Production build                    |
| `pnpm test`        | Run unit tests                      |
| `pnpm lint`        | Lint with ESLint                    |
| `pnpm validate`    | Lint, type-check, test, build       |
| `pnpm update-data` | Regenerate draft JSON from nflverse |

## Data

Draft data lives in `public/data/draft-{year}.json`. Regenerate from [nflverse](https://github.com/nflverse/nflverse-data):

```bash
pnpm update-data
```

## Deploy

### GitHub Pages

1. Push to GitHub; ensure repo has Pages enabled (Settings → Pages → Source: GitHub Actions)
2. The deploy workflow builds and deploys on push to `main`
3. Site will be at `https://<owner>.github.io/<repo-name>/`

### Local preview

```bash
pnpm build
pnpm preview
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and PR workflow.

## Acceptance

- [x] 32 teams supported
- [x] 6+ draft years (2018–2025)
- [x] Metrics compute correctly
- [x] Static build, no backend
- [x] Ongoing seasons handled (teamGames from data)
