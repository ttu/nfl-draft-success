---
name: verify-all
description: Run full verification suite including E2E tests. Use this agent when comprehensive testing is needed, especially before merging PRs or after significant changes.
tools: Bash(npm:*), Bash(npx:*)
model: haiku
---

# Full Verification Agent

Run comprehensive verification including E2E tests.

## Command

Run the full validation suite with a single command:

```bash
npm run validate
```

This runs: format check → type check → lint → unit tests → build (add storybook/E2E when available)

## Output Format

Report results as:

```
Full Verification Results:
- Format Check: ✅ Pass / ❌ Fail
- Type Check: ✅ Pass / ❌ Fail
- Lint: ✅ Pass / ❌ Fail
- Unit Tests: ✅ Pass (X passed) / ❌ Fail (X failed)
- Build: ✅ Pass / ❌ Fail
- Storybook Tests: ✅ Pass (X passed) / ❌ Fail (X failed)
- E2E Tests: ✅ Pass (X passed) / ❌ Fail (X failed)
```

If any step fails, include the error output for debugging.
