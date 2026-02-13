---
description: Validate documentation matches codebase (types, components, data schema)
allowed-tools: Glob, Grep, Read, Edit, Bash(git log:*), Bash(git diff:*)
---

# Documentation Sync Validation

Validate that documentation in `/docs` accurately reflects the current codebase. Prevents outdated documentation that misleads developers.

## Why This Matters

Documentation drift is a common problem. When code changes but docs don't get updated:

- Developers waste time following outdated patterns
- New team members learn incorrect information
- AI assistants make wrong assumptions about the codebase

## Validation Checks

Run each check below and report discrepancies.

### 1. Type Definitions Sync

**Source of Truth:** `src/lib/types.ts` or `src/types.ts` (or wherever types are defined)
**Documentation:** `docs/datamodel.md`

Verify these match:

- [ ] All TypeScript interfaces documented (`DraftPick`, `Season`, `Team`, `DraftClass`)
- [ ] Role classification types if present (`Role`, `RoleWeight`, etc.)
- [ ] Property names and types match exactly
- [ ] Optional vs required fields match (`?` in code vs "optional" in docs)
- [ ] JSON layout description matches actual `public/data/draft-*.json` structure

### 2. Data Schema Sync

**Source of Truth:** `public/data/draft-*.json` (or `scripts/update-data.ts` output schema)
**Documentation:** `docs/datamodel.md`

Verify these match:

- [ ] JSON file layout (year, picks, nested structure) matches docs
- [ ] DraftPick fields (playerId, playerName, position, round, overallPick, teamId, seasons) match
- [ ] Season fields (year, gamesPlayed, teamGames, snapShare, retained) match
- [ ] Team metadata structure if documented
- [ ] Any new fields in JSON are documented
- [ ] Any removed fields are removed from docs

### 3. Architecture Sync

**Source of Truth:** `src/components/`, `src/lib/`, `src/data/`
**Documentation:** `docs/architecture.md`

Verify these match:

- [ ] Folder layout in docs matches actual structure
- [ ] Components listed in docs exist in codebase
- [ ] Lib modules (role classification, metrics) exist as documented
- [ ] Data loading helpers match docs
- [ ] Tech stack table is accurate (Vite, React, TypeScript versions)
- [ ] No phantom components (documented but don't exist)
- [ ] No undocumented major modules

### 4. Spec & Plan Sync

**Source of Truth:** Implementation in `src/`, `scripts/`
**Documentation:** `docs/MVP_SPEC.md`, `docs/SPEC_CLARIFICATIONS.md`, `docs/plans/`

Verify these match:

- [ ] MVP_SPEC.md features are implemented or accurately scoped
- [ ] SPEC_CLARIFICATIONS.md rules match implementation (role weights, retention logic)
- [ ] Implementation plan tasks reflect current state (completed vs pending)
- [ ] References between docs (e.g., plan → SPEC_CLARIFICATIONS) are valid
- [ ] Scripts mentioned (e.g., `scripts/update-data.ts`) exist and match docs

### 5. File References Validation

Check that documentation links point to existing files:

- [ ] `docs/datamodel.md` paths in headers are correct
- [ ] `docs/architecture.md` source paths are correct
- [ ] Cross-references between docs (e.g., `../SPEC_CLARIFICATIONS.md`) resolve
- [ ] Any `src/` or `scripts/` paths in docs point to existing files
- [ ] Import paths in code examples would resolve

### 6. Code Examples Validation

For code examples in documentation:

- [ ] TypeScript interfaces in `docs/datamodel.md` compile (match actual types)
- [ ] Import paths would resolve
- [ ] Function signatures match actual functions
- [ ] JSON examples in docs match schema

### 7. Git History Analysis

Check git history for documentation drift signals:

**Source vs Docs modification dates:**

```bash
# Check when source files were last modified vs their docs
git log -1 --format="%ci" -- src/lib/types.ts 2>/dev/null || git log -1 --format="%ci" -- src/lib/*.ts 2>/dev/null
git log -1 --format="%ci" -- docs/datamodel.md
```

Verify:

- [ ] Types file not modified more recently than `docs/datamodel.md` (or within same commit)
- [ ] `scripts/update-data.ts` not modified more recently than docs describing data schema
- [ ] `src/` structure changes reflected in `docs/architecture.md`

**Recent commits touching source without docs:**

```bash
git log --oneline --since="3 months ago" -- src/lib/
git log --oneline --since="3 months ago" -- docs/datamodel.md
```

Flag commits where:

- [ ] Types or schema changed but datamodel.md didn't change in same or following commit
- [ ] New modules added without architecture doc updates

**Staleness thresholds:**

- ⚠️ Warning: Doc not updated in 30+ days while source changed
- ❌ Critical: Doc not updated in 90+ days while source changed multiple times

## Output Format

Report results in this format:

```text
Documentation Sync Validation Results
=====================================

1. Type Definitions Sync
   - datamodel.md → src/lib/types.ts (or src/types.ts)
   - Status: ✅ In Sync / ⚠️ Discrepancies Found
   - Issues: [list any mismatches]

2. Data Schema Sync
   - datamodel.md → public/data/*.json, scripts/update-data.ts
   - Status: ✅ In Sync / ⚠️ Discrepancies Found
   - Issues: [list any mismatches]

3. Architecture Sync
   - Status: ✅ In Sync / ⚠️ Discrepancies Found
   - Missing from docs: [modules in code but not docs]
   - Phantom in docs: [modules in docs but not code]

4. Spec & Plan Sync
   - Status: ✅ In Sync / ⚠️ Discrepancies Found
   - Issues: [list any gaps]

5. File References
   - Status: ✅ All Valid / ⚠️ Broken Links Found
   - Broken: [list broken paths]

6. Code Examples
   - Status: ✅ Valid / ⚠️ Issues Found
   - Issues: [list invalid examples]

7. Git History Analysis
   - Status: ✅ In Sync / ⚠️ Drift Detected / ❌ Stale Docs
   - Source files modified after docs:
     - [file]: last source change [date], last doc change [date]

Summary
-------
- Total checks: X
- Passed: X
- Issues: X

Recommended Actions:
1. [Most critical fix]
2. [Second priority]
...
```

## Arguments

- No arguments: Run all checks and report discrepancies
- `quick`: Only run checks 1–3 (types, data schema, architecture)
- `types`: Only check type definitions sync
- `schema`: Only check data schema sync
- `architecture`: Only check architecture sync
- `spec`: Only check spec and plan sync
- `git`: Only check git history for drift signals
- `fix`: **Run checks AND automatically fix discrepancies** in documentation files

## Fix Mode Behavior

When `fix` argument is provided, after identifying discrepancies:

1. **Automatically update documentation files** using the Edit tool to match the source code
2. **Fix source paths** – Update incorrect Source of Truth paths in doc headers
3. **Sync type definitions** – Update interfaces and types in docs/datamodel.md
4. **Sync data schema** – Update JSON layout and field descriptions in datamodel.md
5. **Update architecture docs** – Add missing modules, fix directory structure
6. **Report all changes made** with before/after summary

**What fix mode will NOT do:**

- Change source code (only documentation is updated)
- Delete documentation sections (only updates existing content)
- Modify implementation plans (these are historical records)

## Tips

1. **Start with quick mode** for regular validation during development
2. **Run full validation** before major releases or documentation updates
3. **Use fix mode** to automatically correct documentation drift
4. **Check spec/plan sync** when implementing features to ensure alignment
