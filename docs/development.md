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

| Command                 | Description                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`              | Start dev server                                                                     |
| `pnpm build`            | Production build                                                                     |
| `pnpm preview`          | Preview production build                                                             |
| `pnpm lint`             | ESLint (zero warnings)                                                               |
| `pnpm lint:fix`         | Fix ESLint issues                                                                    |
| `pnpm lint:duplication` | jscpd copy-paste check                                                               |
| `pnpm format`           | Format with Prettier                                                                 |
| `pnpm format:check`     | Check formatting                                                                     |
| `pnpm type-check`       | TypeScript check                                                                     |
| `pnpm test`             | Run Vitest                                                                           |
| `pnpm test:watch`       | Vitest watch mode                                                                    |
| `pnpm validate`         | Format + lint + test + build                                                         |
| `pnpm update-data`      | Update JSON from nflverse                                                            |
| `pnpm prerender-routes` | Emit a page per indexable route into `dist/` (runs as the last step of `pnpm build`) |
| `pnpm check:generated`  | Fail if `pnpm build` rewrote a committed artifact that is not staged                 |

## Static Routes & SEO

`pnpm build` finishes by running `scripts/seo/prerender-routes.ts`, which writes a
real HTML file for every URL in `public/sitemap.xml` — teams, draft years,
positions and `/highlights` — plus the `404.html` SPA fallback.

Without it `dist/` holds only `index.html`, and a static host answers every deep
link with the fallback under an **HTTP 404**. A browser still renders the right
page, so the breakage is invisible in normal use; crawlers and link unfurlers
read the status and drop the URL.

Each route's `<title>`, description, canonical and Open Graph tags come from
`src/seo/routeMeta.ts`, which `src/seo/DocumentHead.tsx` re-applies
on client-side navigation. Add a route in `src/seo/siteRoutes.ts` and the
sitemap, the pre-rendered pages and the runtime head all follow.

## Data Updates

Run `pnpm update-data` to fetch nflverse data and regenerate `public/data/draft-{year}.json`. See [data model](datamodel.md) and plan for schema.

## Generated Artifacts

`pnpm build` rewrites five files that are committed to the repo:

- `public/data/default-rankings.json`
- `public/data/lagged-draft-rankings.json`
- `public/data/team-success.json`
- `public/sitemap.xml`
- `public/og-image.png`

They are derived from `src/` and `public/data/`, so any change to scoring or to
the data moves them, and they belong in the commit that moved them. Nothing in
the hook staged them: the build runs _after_ lint-staged, so a regenerated
artifact used to be left dirty in the working tree while the commit went
through without it.

`pnpm check:generated` (`scripts/check-generated.sh`) now runs straight after
the build and fails the commit, naming the files and the `git add` to run.
Stage them and commit again — the rerun's build produces the same bytes, so the
check passes. CI runs it too, for anything that reached `main` without the hook.

## Git Hooks

- **Pre-commit:** lint-staged, type-check, test, build, generated-artifact check, E2E
- **Pre-push:** Rebase-on-main check

Run `pnpm install` to install Husky hooks.

## Debugging

- Dev server: `http://localhost:3273`
- Vitest: `pnpm test:watch` for TDD
