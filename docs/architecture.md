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
    layout/       # App chrome (header, intro, info, loading)
    draft/        # Shared draft/player UI (lists, cards, pickers)
    filters/      # Role and year-range controls
    views/        # Route-level views: team/, draft-year/, position/
    *.tsx         # e.g. TeamSelector used across views
  lib/            # Calculation logic (role classification, metrics)
  data/           # Team metadata, data loading helpers
  seo/            # Indexable routes: per-route metadata, runtime <head>
public/
  data/           # JSON files (draft-2013.json … draft-2026.json)
scripts/
  update-data.ts      # Fetch nflverse, transform, write JSON
  generate-og-image.ts # Generate OG image for social sharing
  seo/                # Sitemap + one pre-rendered page per route
```

`src/seo/` is the one folder that groups by feature rather than by kind: it owns
both a React component and build-time logic, because a crawler and a visitor
have to be shown the same metadata for a URL. See
[development.md](development.md#static-routes--seo).

## Build & Runtime

- **Build:** Static (Vite). No backend, no database.
- **Data:** Loaded at runtime from JSON files in `public/data/`.
- **Hosting:** Vercel, Netlify, GitHub Pages.

## Data Flow

1. App loads `public/data/draft-{year}.json` for selected year range.
2. Filters by team (client-side).
3. `src/lib` computes role classification, draft class metrics, 5-year score.
4. Components render.
