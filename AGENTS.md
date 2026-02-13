# AI Agents & Workflows

Guide for AI-assisted development on NFL Draft Retention & Role Tracker. All relevant info below; see `docs/` for full specs.

---

## Project Context

**NFL Draft Retention & Role Tracker** – Front-end-only static site evaluating NFL draft success using snap share, games played, retention. React + TypeScript + Vite, JSON data, no backend. Team-centric view, role classification, 5-year rolling score. Reference: [docs/SPEC_CLARIFICATIONS.md](docs/SPEC_CLARIFICATIONS.md), [docs/datamodel.md](docs/datamodel.md), [docs/architecture.md](docs/architecture.md), [docs/plans/](docs/plans/).

---

## Common Workflows

**1. New component** – In `src/components/`. TypeScript props, integration tests (React Testing Library), CSS Modules. Follow implementation plan in `docs/plans/`.

**2. Business logic** – Pure utils in `src/lib/`, full types, unit tests. Reference [docs/SPEC_CLARIFICATIONS.md](docs/SPEC_CLARIFICATIONS.md) for formulas.

**3. Data script** – `scripts/update-data.ts` fetches from nflverse, transforms, writes JSON. See plan Data Update Script section.

**4. Refactor** – Keep behavior and coverage; run tests. Describe current issues and goal.

**5. Debug** – Provide: current vs expected behavior, steps to reproduce, relevant files, error message.

---

## Code Review Checklist

- TypeScript types correct and complete
- Test coverage for new logic
- Accessible, responsive
- Error handling
- JSDoc for complex logic

---

## Conventions

- **Naming:** Components in `src/components/`, logic in `src/lib/`, data in `src/data/`, `public/data/`.
- **Tests:** Unit `[function].test.ts`, component `[Component].test.tsx`.
- **Commits:** Conventional (`feat`, `fix`, `docs`, etc.). Never `--no-verify`.

---

## Documentation

| Doc                                                        | Purpose                           |
| ---------------------------------------------------------- | --------------------------------- |
| [docs/SPEC_CLARIFICATIONS.md](docs/SPEC_CLARIFICATIONS.md) | Role weights, formulas, retention |
| [docs/datamodel.md](docs/datamodel.md)                     | Types, JSON schema                |
| [docs/architecture.md](docs/architecture.md)               | Tech stack, folder layout         |
| [docs/development.md](docs/development.md)                 | Setup, scripts                    |
| [docs/plans/](docs/plans/)                                 | Implementation plans              |

---

## Version Control & PR Workflow

**Commits:** `type: description` + optional bullet details. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `ci`. Never `--no-verify`.
