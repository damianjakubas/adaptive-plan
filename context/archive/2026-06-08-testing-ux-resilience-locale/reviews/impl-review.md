<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Resilience & Locale Output Correctness

- **Plan**: context/changes/testing-ux-resilience-locale/plan.md
- **Scope**: All Phases (1–5 of 5)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (post-triage — all findings resolved or accepted)
- **Findings**: 0 critical  4 warnings  5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS (post-fix: linear-tasks.md status corrected) |
| Safety & Quality | PASS (post-fix: all 4 warnings fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS (post-fix: PlanEmptyState moved) |
| Success Criteria | PASS |

## Findings

### F1 — LocaleToggle: only en→pl direction tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/locale-toggle.test.tsx:37–47
- **Detail**: `useLocale` mock hardcoded to "en"; pl→en direction untested.
- **Fix**: Added hoisted `mockUseLocale` fn + second `it(...)` for pl→en direction.
- **Decision**: FIXED

### F2 — LocaleToggle: cookie/refresh call order not asserted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/locale-toggle.test.tsx:37–47
- **Detail**: Both calls verified but not that cookie precedes refresh.
- **Fix**: Added `invocationCallOrder` assertion to both direction tests.
- **Decision**: FIXED

### F3 — plan-generator: isLoading=true + error set simultaneously not tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/plan/plan-generator.test.tsx
- **Detail**: Combined state (loader visible AND toast fires) was untested.
- **Fix**: Added test asserting loader visible + toastError called when both are set.
- **Decision**: FIXED

### F4 — plan-view: all-rest-day schedule fallback not tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/components/plan/plan-view.test.tsx
- **Detail**: `firstTrainingDay === -1 ? 0 : firstTrainingDay` fallback unexercised.
- **Fix**: Added `allRestFixture` (7 rest days) test asserting restDayTitle renders.
- **Decision**: FIXED

### F5 — Unplanned change: linear-tasks.md

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/linear-tasks.md
- **Detail**: ADA-10 added (not in plan); `Status: Todo` stale vs github-issues.md `Closed`.
- **Fix**: Updated ADA-10 Status to Done.
- **Decision**: FIXED

### F6 — catalog-parity: collectPaths does not recurse into arrays

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/i18n/catalog-parity.test.ts:8–25
- **Detail**: Latent brittleness if array-of-objects keys are added to catalog.
- **Fix**: Added comment near `collectPaths` documenting the limitation.
- **Decision**: FIXED

### F7 — build-prompt: whitespace-only healthIssues branch not covered

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/lib/plan/build-prompt.test.ts
- **Detail**: `.trim()` guard tested for `undefined` but not `"   "`.
- **Fix**: Added `it("renders 'none reported' for whitespace-only healthIssues", ...)`.
- **Decision**: FIXED

### F8 — build-prompt: threading test proves inequality, not the specific language word

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/lib/plan/build-prompt.test.ts:57–62
- **Detail**: `not.toBe` proves difference but not which language word was threaded.
- **Fix**: Added `toContain("Polish")` and `toContain("English")` assertions.
- **Decision**: FIXED

### F9 — plan-view: PlanEmptyState test in the wrong file

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/tests/components/plan/plan-view.test.tsx:106–117
- **Detail**: PlanEmptyState is a sibling component; its test was in plan-view.test.tsx.
- **Fix**: Moved to src/tests/components/plan/plan-empty-state.test.tsx.
- **Decision**: FIXED
