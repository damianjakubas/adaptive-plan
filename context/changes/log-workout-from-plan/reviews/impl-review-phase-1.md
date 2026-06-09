<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log a Workout from the Active Plan (S-01)

- **Plan**: context/changes/log-workout-from-plan/plan.md
- **Scope**: Phase 1 of 4
- **Date**: 2026-06-09
- **Verdict**: APPROVED (with 2 minor warnings)
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Drift check: 0 MISSING, 0 DRIFT across all four planned change groups (form schema, mapper, i18n catalogs, tests). Form schema is compile-time-proven compatible with `workoutSessionInputSchema` minus `performedAt`/`sourcePlanId`. Automated criteria: `npx tsc --noEmit` PASS, `npm run lint` PASS, `npx vitest run` 175/175 PASS.

## Findings

### F1 — Empty sessionName hole: fallback isn't airtight

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/workout/map-plan-day-to-form-values.ts:31 + src/lib/validation/workout-session-form-schema.ts:56
- **Detail**: plan-schema.ts declares both `focus` and `day` as z.string() with no min(1), so an LLM plan can carry both empty. `day.focus || day.day` then yields `sessionName: ""`, failing the keyless `z.string().min(1)` on a field with no rendered input — save blocked by an invisible, untranslated error. The planned fallback was incomplete (partly a plan flaw).
- **Fix**: Extend the mapper fallback with a literal terminal value (e.g. `day.focus || day.day || "Workout"`) and add one test row.
- **Decision**: FIXED — literal `"Workout"` fallback added in the mapper + test row; mapper suite 8/8 green.

### F2 — Unbounded set-row expansion from LLM-controlled `sets`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/lib/workout/map-plan-day-to-form-values.ts:25
- **Detail**: `Array.from({ length: Math.max(exercise.sets, 1) })` has no upper clamp; plan-schema.ts validates `sets` as bare z.number() (unbounded, non-integer allowed, LLM-generated). `sets: 1e5` renders 100k RHF rows (frozen tab); `2.5` silently truncates to 2.
- **Fix A ⭐ Recommended**: Clamp in the mapper — `Math.min(Math.max(Math.trunc(exercise.sets), 1), 20)`
  - Strength: Local pure-function change inside this slice's scope; one line + one test row.
  - Tradeoff: Treats the symptom — other future consumers of the plan shape stay exposed.
  - Confidence: HIGH — mapper already clamps the lower bound the same way.
  - Blind spot: The cap value (20) is a judgment call.
- **Fix B**: Constrain at the source — plan-schema.ts `sets: z.number().int().min(1).max(20)`
  - Strength: Fixes the class for every consumer; out-of-range LLM plans fail generation validation.
  - Tradeoff: Touches plan-generation validation, outside this phase's planned file set; too-strict cap could reject fine plans.
  - Confidence: MEDIUM — haven't audited generation retry behavior on schema failure.
  - Blind spot: Persisted plans validated under the old schema; re-parse paths not checked.
- **Decision**: FIXED via Fix A — mapper clamps to [1, 20] with Math.trunc; clamp/truncation test added; 9/9 green, tsc clean.

### F3 — Defensive `invalid_weight` branch reuses wrong copy, untested

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Test quality
- **Location**: src/lib/validation/workout-session-form-schema.ts:31
- **Detail**: Unplanned extra: weight coercion carries message key "invalid_weight", which exists in Validation with body-weight copy ("Enter weight (30-300 kg)") — wrong text for a set weight if it ever rendered. Defensive-only branch, no test; a Stryker mutant deleting it survives.
- **Fix**: Add one `it.each` row (weight: "abc" → "invalid_weight"); optionally a set-weight-specific key when the UI phase lands.
- **Decision**: FIXED — rejection row added to `keyedRejections`; suite 19/19 green. Set-weight-specific copy deferred to the UI phase.

### F4 — No upper bound on durationMinutes; negative weight persists

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Validation)
- **Location**: src/lib/validation/workout-session-form-schema.ts:47-53, 29-32
- **Detail**: durationMinutes has no .max() in form or server schema; values > int4 max die at the DB → generic save_failed. weight accepts negatives in both schemas (consistent, but persists silently). Marginal in practice.
- **Fix**: Add `.max(1440, { message: "invalid_duration" })` and `.min(0)` on weight in the form schema (mirror server-side).
- **Decision**: FIXED — duration `.max(1440)` and weight `.min(0)` added in both form and server schemas + 2 rejection test rows; full suite 180/180, tsc clean.

### F5 — Polish plural for exerciseCount omits `many` category

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (i18n)
- **Location**: src/i18n/messages/pl.json (LogWorkout.exerciseCount)
- **Detail**: ICU plural defines one/few/other only; Polish needs `many`. Falls back to `other` whose text happens to be the correct many-form — right output by accident.
- **Fix**: Add explicit `many {# ćwiczeń}` branch.
- **Decision**: FIXED — `many` branch added to pl.json; catalog tests 5/5 green.

### F6 — New i18n keys break the catalog's alphabetical ordering

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/{en,pl}.json (Validation namespace)
- **Detail**: The 5 new Validation keys are appended after invalid_work_mode instead of alphabetically inserted; the section was previously sorted. ESLint doesn't lint JSON, so nothing fails. Side note (pre-existing): eslint.config.mjs lacks the sort-keys-fix/import-order/sort-vars rules AGENTS.md §3 claims are enforced.
- **Fix**: Re-sort the Validation namespace keys in both locales.
- **Decision**: FIXED — Validation namespace alphabetically sorted in en.json and pl.json (also fixed a pre-existing out-of-order trio); lint + full suite green.

## Triage outcome (2026-06-09)

All 6 findings FIXED on top of 94e2b3e, committed together with this report as `fix(log-workout-from-plan): impl-review fixes for phase 1`:

- F1: mapper terminal fallback `|| "Workout"` + test row
- F2: set expansion clamped to [1, 20] with `Math.trunc` + test (Fix A)
- F3: `invalid_weight` defensive branch pinned by a rejection test row
- F4: duration `.max(1440)` + weight `.min(0)` in form AND server schemas + 2 test rows
- F5: explicit `many` plural branch in pl.json `exerciseCount`
- F6: Validation namespace re-sorted in both catalogs

Final verification: `npx tsc --noEmit` PASS, `npm run lint` PASS, `npx vitest run` 180/180 PASS.
