# Architecture

## Tech Stack

From [emergency-supply-tracker](https://github.com/ttu/emergency-supply-tracker). Omit: Storybook, Playwright, Stryker, i18n.

| Category   | Tools                                     |
| ---------- | ----------------------------------------- |
| Build      | Vite 7                                    |
| Framework  | React 19, @vitejs/plugin-react            |
| Language   | TypeScript 5.9                            |
| Testing    | Vitest 4, @testing-library/react, jsdom   |
| Linting    | ESLint 9 (flat config), typescript-eslint |
| Formatting | Prettier 3, eslint-config-prettier        |
| Git hooks  | Husky, lint-staged                        |

## Folder Layout

```
src/
  types.ts        # TypeScript interfaces (DraftPick, Season, Role, etc.)
  components/     # React components
  lib/            # Calculation logic (role classification, metrics)
  data/           # Team metadata, data loading helpers
public/
  data/           # JSON files (draft-2018.json, etc.)
scripts/
  update-data.ts      # Fetch nflverse, transform, write JSON
  generate-og-image.ts # Generate OG image for social sharing
```

## Build & Runtime

- **Build:** Static (Vite). No backend, no database.
- **Data:** Loaded at runtime from JSON files in `public/data/`.
- **Hosting:** Vercel, Netlify, GitHub Pages.

## Data Flow

1. App loads `public/data/draft-{year}.json` for selected year range.
2. Filters by team (client-side).
3. `src/lib` computes role classification, draft class metrics, 5-year score.
4. Components render.
