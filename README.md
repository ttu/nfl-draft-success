# NFL Draft Success

A static site that evaluates NFL draft success by team using snap share, games played, and retention. Team-centric view with draft class metrics and 5-year rolling scores.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **32 NFL teams** – Select any team to view their draft performance
- **Configurable year range** – Default 2018–2025
- **Role classification** – Core Starter, Starter When Healthy, Significant Contributor, Depth, Non Contributor (from snap share + availability)
- **Draft class metrics** – Picks, core starters, contributors, retention per year
- **5-year rolling score** – Aggregated score with Core Starter % and Retention %
- **Player list** – Retained draft picks with draft year, position, and role

## Scripts

| Script                | Description                         |
| --------------------- | ----------------------------------- |
| `npm run dev`         | Start dev server                    |
| `npm run build`       | Production build                    |
| `npm test`            | Run unit tests                      |
| `npm run lint`        | Lint with ESLint                    |
| `npm run validate`    | Lint, type-check, test, build       |
| `npm run update-data` | Regenerate draft JSON from nflverse |

## Data

Draft data lives in `public/data/draft-{year}.json`. Regenerate from [nflverse](https://github.com/nflverse/nflverse-data):

```bash
npm run update-data
```

## Deploy

### GitHub Pages

1. Push to GitHub; ensure repo has Pages enabled (Settings → Pages → Source: GitHub Actions)
2. The deploy workflow builds and deploys on push to `main`
3. Site will be at `https://<owner>.github.io/<repo-name>/`

### Local preview

```bash
npm run build
npm run preview
```

## Acceptance

- [x] 32 teams supported
- [x] 6+ draft years (2018–2025)
- [x] Metrics compute correctly
- [x] Static build, no backend
- [x] Ongoing seasons handled (teamGames from data)
