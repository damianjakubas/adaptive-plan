<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generation-flow integrity — Phase 3

- **Plan**: context/changes/testing-generation-flow-integrity/plan.md
- **Scope**: Phase 3 of 5
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION (resolved via triage)
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — onError transport face wired in production but untested

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/tests/app/api/plan/generate/route.test.ts (missing test)
- **Detail**: The plan requires "(e) each failure face fires logGenerationError exactly once." The onError transport face was wired in route.ts:65-67 and capturedOnError was exported from the stub helper, but no test exercised it.
- **Fix**: Added test "fires logGenerationError once via onError on a stream transport error" calling `ctrl.capturedOnError?.({error: ...})` and asserting stage "stream". Also added `ctrl.streamText.mockReset()` to beforeEach to fix a mock implementation leak from the preceding setup-throw tests.
- **Decision**: FIXED

### F2 — Phase 2 files modified retroactively in the Phase 3 commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/tests/lib/plan/errors.test.ts, stryker.config.mjs, src/tests/lib/validation/plan-schema.test.ts
- **Detail**: Phase 2 progress items 2.4-2.5 pointed to 6bfee88 as done, but the Phase 3 commit df03f97 re-touched all three Phase 2 artifacts. Notably, stryker.config.mjs lacked the `mutate` field until df03f97 (Phase 2's Stryker run relied on the CLI --mutate flag).
- **Fix**: Annotated plan.md progress items 2.4 and 2.5 with a note referencing df03f97 as the commit that finalized the stryker config and refined the test suite.
- **Decision**: FIXED

### F3 — Missing eslint-disable-next-line comment on console.error

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/plan/log-generation-error.ts:2
- **Detail**: The plan's Critical Implementation Details specified `console.error` behind `eslint-disable-next-line no-console`. The comment was absent and the no-console rule was not wired in eslint.config.mjs (rule was undefined, so linting passed without it).
- **Fix**: Added the `eslint-disable-next-line no-console` comment to log-generation-error.ts AND wired `"no-console": "error"` into eslint.config.mjs so the comment is meaningful and AGENTS.md's claim ("ESLint enforces no-console") is accurate. Lint clean with no unused-directive warning.
- **Decision**: FIXED

### F4 — output-rejection logs with stage "persist" instead of "output"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/plan/generate/route.ts (onFinish handler)
- **Detail**: A single try/catch in onFinish caught both `await result.output` rejection (LLM/SDK failure) and `saveActivePlan` throw under stage: "persist" — misleading for on-call debugging.
- **Fix**: Split into two try/catch blocks: inner for `await result.output` logs stage: "output"; outer for `saveActivePlan` logs stage: "persist". All 13 route tests pass.
- **Decision**: FIXED
