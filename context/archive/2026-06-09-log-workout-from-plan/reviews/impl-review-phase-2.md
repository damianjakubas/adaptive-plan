<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log a Workout from the Active Plan (S-01)

- **Plan**: context/changes/log-workout-from-plan/plan.md
- **Scope**: Phase 2 of 4 (Save Server Action)
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Context

- `src/lib/workout/actions.ts` matches the planned contract point for point: auth →
  active-plan gate → server-side stamping → write-schema guard → `createSession`, with
  the exact `{ ok, code }` result and all four error codes. Spread order guarantees
  client-supplied `performedAt`/`sourcePlanId` are overwritten; the happy-path test pins it.
- `src/lib/workout/log-workout-error.ts` was not named in the plan but is the plan's
  "existing error-logging approach" — a clone of `src/lib/plan/log-generation-error.ts`,
  forced into its own file by repo rules 6 (no-console) and 9 (helpers in separate files).
  Judged justified scope, not creep.
- All 5 planned hermetic test cases exist; mocking style matches
  `src/tests/lib/auth/actions.test.ts`.
- Automated criteria at review time: `npx tsc --noEmit` clean, `npm run lint` clean,
  `npx vitest run` 185/185 passed. No manual criteria for this phase.

## Findings

### F1 — Unguarded getActivePlan can bypass the error contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/workout/actions.ts:31
- **Detail**: The gating read `await getActivePlan(user.id)` sat outside any try/catch. A DB fault there threw an unhandled 500 instead of the action's `{ ok: false, code }` contract — while the same fault inside `createSession` was caught and returned `save_failed`. The branch was also untested.
- **Fix**: Wrap the call in try/catch → `{ ok: false, code: "save_failed" }` with `logWorkoutError({ error, stage: "active-plan-check" })`; add a hermetic test pinning the branch.
- **Decision**: FIXED — try/catch added in `actions.ts`, new test "returns save_failed and logs the error when the active-plan gating read throws" added (suite now 6 action tests, all green).

### F2 — Duplicated 4-line error-log helper

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (DRY)
- **Location**: src/lib/workout/log-workout-error.ts:1-4
- **Detail**: Verbatim copy of `src/lib/plan/log-generation-error.ts` with only the log prefix changed. Two identical helpers now exist; the next feature will create a third. Deliberately mirrors the established precedent.
- **Fix**: Leave as-is; extract a shared `logServerError(scope, context)` into `src/helpers/` when a third copy would appear.
- **Decision**: SKIPPED — accepted duplication for now; extract at the third copy.

### F3 — Untyped mock weakens the stamping assertions

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/tests/lib/workout/actions.test.ts:111
- **Detail**: `mocks.createSession.mock.calls[0][0]` was implicitly `any`, so the happy-path stamping assertions (userId, sourcePlanId, performedAt) were unchecked by TypeScript.
- **Fix**: Type the mock: `createSession: vi.fn<(input: CreateSessionInput) => Promise<string>>()`.
- **Decision**: FIXED — mock typed, `CreateSessionInput` type import added; tsc + lint + tests green.
