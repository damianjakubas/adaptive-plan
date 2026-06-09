<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generation-flow integrity — Phase 2

- **Plan**: context/changes/testing-generation-flow-integrity/plan.md
- **Scope**: Phase 2 of 5
- **Date**: 2026-06-08
- **Verdict**: APPROVED (all findings triaged and fixed)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F2, F5 — both fixed) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F3 — fixed) |
| Architecture | PASS |
| Pattern Consistency | WARNING (F4, F6 — both fixed; F7 skipped) |
| Success Criteria | FAIL → FIXED (F1 — lint failure fixed) |

## Findings

### F1 — ESLint scans Stryker sandbox; lint currently fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: eslint.config.mjs (globalIgnores)
- **Detail**: After any Stryker run, `.stryker-tmp/sandbox-*` is left behind and ESLint scans it, producing 89 errors. ESLint flat config does not inherit `.gitignore` automatically. Lint was passing at commit time but breaks for any dev who runs Stryker.
- **Fix**: Added `.stryker-tmp/**` to `globalIgnores` in `eslint.config.mjs`.
- **Decision**: FIXED

### F2 — stryker.config.mjs: no mutate scope + stale ignorePatterns

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: stryker.config.mjs
- **Detail**: No `mutate` field — bare `npx stryker run` would mutate entire codebase instead of the planned `errors.ts` scope. Also `ignorePatterns: [".gemini"]` was a stale template artifact.
- **Fix**: Set `mutate: ["src/lib/plan/errors.ts"]`, removed `ignorePatterns`.
- **Decision**: FIXED

### F3 — Conditional if-guard makes inner assertion conditionally reachable

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/lib/validation/plan-schema.test.ts:75, 83, 93, 102
- **Detail**: Four `planInputSchema` rejection tests used `if (!result.success)` guard around the field-key assertion, making it structurally dead if the outer `expect` is ever removed.
- **Fix**: Replaced `if (!result.success)` with `assert(!result.success)` from vitest — type-narrows and throws, making the inner assertion unconditionally reachable.
- **Decision**: FIXED

### F4 — fieldErrors helper declared before the describe blocks it serves

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/tests/lib/validation/plan-schema.test.ts:11–23 (pre-fix)
- **Detail**: CLAUDE.md rule 1 (declarations after function body) — `fieldErrors` was at the top of the file, before the fixtures and describe blocks.
- **Fix**: Moved `fieldErrors` to the bottom of the file, after both `describe` blocks.
- **Decision**: FIXED

### F5 — Missing { statusCode: 500 } case in mapPlanError table

- **Severity**: ○ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/tests/lib/plan/errors.test.ts:6–15
- **Detail**: The "statusCode present but not 429" branch was untested. A mutant flipping `=== 429` to `!== 429` could have survived.
- **Fix**: Added `["statusCode 500 → generation_failed", { statusCode: 500 }, "generation_failed"]` row.
- **Decision**: FIXED

### F6 — it.each format string doesn't show the expected value in test titles

- **Severity**: ○ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/tests/lib/plan/errors.test.ts:17
- **Detail**: Format `"%s → %s"` on a 3-column table showed label + input but not the expected return value in test titles.
- **Fix**: Encoded outcome into label strings (e.g. `"statusCode 429 → rate_limited"`); changed format to `"%s"`.
- **Decision**: FIXED

### F7 — void variable; suppression pattern is non-standard

- **Severity**: ○ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/tests/lib/validation/plan-schema.test.ts:68, 90, 105
- **Detail**: `void variable;` is non-standard but it IS the working ESLint-compatible pattern for this project. `@typescript-eslint/no-unused-vars` is set to `'warn'` without a `varsIgnorePattern`, so `_`-prefixed renaming still triggers warnings. Revert attempted; keeping `void`.
- **Decision**: SKIPPED — `void variable;` is the established pattern for this ESLint config.
