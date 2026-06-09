<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Workout-Session Snapshot Store

- **Plan**: context/changes/workout-session-snapshot-store/plan.md
- **Scope**: Phase 2 of 4 (Zod Write-Contract)
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Plan adherence is a full field-by-field match: every contract key present with correct
optionality/types, `.min(1)` on exercises + sets, `int().min(0)` on durationMinutes,
`coerce.date()` on performedAt, `reps:string` / `weight:number` aligned to the DB text/real
columns, and `userId` correctly excluded (Phase 3 carries it). The `.min(1)` tightenings on
`name`/`reps` and the dropped i18n message keys are documented, defensible deviations — not
drift. Automated success criteria all pass (`tsc --noEmit`, `npm run lint`, unit tests);
Phase 2 has no manual items.

## Findings

### F1 — No isolated rejection case for an uncoercible performedAt

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (test robustness)
- **Location**: src/tests/lib/validation/workout-session-schema.test.ts (rejectionCases)
- **Detail**: `performedAt: z.coerce.date()` is required, but no rejection row isolates it; the
  `null`/`{}` rows fail because other required fields are also absent. The schema is correct
  (`z.coerce.date()` rejects `"not-a-date"`), but a mutant weakening the coercion could survive
  the suite.
- **Fix**: Add rejectionCases row `["an uncoercible performedAt", { ...validSession, performedAt: "not-a-date" }]`.
- **Decision**: FIXED via Fix now

### F2 — sourcePlanId `.nullish()` null-acceptance branch untested

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (test completeness)
- **Location**: src/tests/lib/validation/workout-session-schema.test.ts:44 / schema:48
- **Detail**: The schema uses `.nullish()` so explicit `null` is valid, but tests only cover
  *absent* and *invalid-string*. The branch motivating `.nullish()` over `.optional()`
  (explicit `null`, e.g. cleared provenance) was unasserted.
- **Fix**: Add positive assertion `safeParse({ ...validSession, sourcePlanId: null }).success === true`.
- **Decision**: FIXED via Fix now

## Outcome

Both findings fixed during triage; suite re-run green at 19 tests (was 17).
