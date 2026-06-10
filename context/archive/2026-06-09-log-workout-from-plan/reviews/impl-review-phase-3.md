<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log a Workout from the Active Plan (S-01)

- **Plan**: context/changes/log-workout-from-plan/plan.md
- **Scope**: Phase 3 of 4 (Shared Workout-Session Editor)
- **Date**: 2026-06-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Plan adherence: all 5 planned items MATCH, all 9 planned test cases present (+2 extras). The unplanned `as-emptyable-numeric-value.ts` is a 14-line helper mandated by repo rule 9 — justified, not scope creep. Automated criteria: tsc clean, lint clean, vitest 199/199.

## Findings

### F1 — Rejected `onSave` becomes an unhandled promise rejection

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/workout/workout-session-editor.tsx:67
- **Detail**: `Props.onSave` is `(values) => Promise<void> | void`; RHF's `handleSubmit` re-throws callback errors into a promise React never awaits. A rejecting `onSave` (e.g. network error from the phase-2 action call) surfaces as a global `unhandledrejection` with no user feedback. Nothing forces parents to catch; affects the S-03 reuse contract.
- **Fix**: Wrap the submit callback in try/catch — swallow the rejection so the form stays editable; document on `Props.onSave` that error display is parent-owned. Add a rejecting-onSave test.
  - Strength: Makes the shared contract safe for any parent; phase 4 and S-03 inherit the guarantee.
  - Tradeoff: A swallowed error relies on the parent for feedback — must be documented.
  - Confidence: HIGH — RHF v7 re-throw behavior is well established.
  - Blind spot: Phase 4's planned `onSave` resolves `{ ok, code }` and rarely rejects, so the window is narrow in practice.
- **Decision**: FIXED — try/catch in submit handler, Props docblock note, rejecting-onSave test added

### F2 — Double-submit window: `saving` prop is the only guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/workout/workout-session-editor.tsx:144
- **Detail**: Save button disabled only by the external `saving` prop. Between click and the parent's re-render (or with a parent omitting the prop), a rapid double-click fires `onSave` twice — the phase-2 save is a non-idempotent insert, so this is a duplicate-workout bug.
- **Fix**: `disabled={saving || formState.isSubmitting}` on the save button (read `isSubmitting` during render — Proxy caveat already documented in-file for `isDirty`). Add a two-rapid-clicks test asserting `onSave` fires once.
- **Decision**: FIXED — isSubmitting added to save + discard disabled guards, double-click test added

### F3 — Form contract typed with schema *output*, forcing the NaN empty-face

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/components/workout/workout-session-editor.tsx:167, src/components/workout/exercise-card.tsx:30
- **Detail**: `Props.defaultValues` and `useFormContext` use the schema *output* type (`durationMinutes: number`), so (a) the phase-1 mapper seeds `Number.NaN` as "empty" (hence `asEmptyableNumericValue`), and since `NaN !== NaN`, RHF's `isDirty` can never revert to false after any edit — the discard dialog appears for factually-pristine forms; (b) `useFormContext<Output>` is an unchecked cast — `weight`'s `field.value` is typed `number | undefined` but holds a raw DOM string while typing. This is the S-03 shared contract, so the choice propagates.
- **Fix A ⭐ Recommended**: Export `WorkoutSessionFormInput` from workout-session-form-schema.ts; use it for `Props.defaultValues` and the `useFormContext` generic; retire the NaN seed in the mapper.
  - Strength: Removes the NaN hack, the isDirty quirk, and the lying cast in one move, before S-03 builds on the contract.
  - Tradeoff: Touches phase-1 files (mapper + its tests) — a small cross-phase refactor.
  - Confidence: HIGH — the three-generic form is already in place; this completes it.
  - Blind spot: Haven't verified every mapper test that pins the NaN face.
- **Fix B**: Keep the output-typed contract; document the NaN empty-face convention and apply `asEmptyableNumericValue` to weight for symmetry.
  - Strength: No cross-phase churn; phase 4 can proceed immediately.
  - Tradeoff: The isDirty-never-reverts quirk and the unchecked cast remain, inherited by S-03.
  - Confidence: MEDIUM — works, but the trap stays armed.
  - Blind spot: S-03's snapshot mapper isn't written yet; its empty-face needs the same care.
- **Decision**: FIXED via Fix A — `WorkoutSessionFormInput` exported from the schema file; mapper seeds `""` and returns the input type; Props/useFormContext retyped; weight input uses `asEmptyableNumericValue`; mapper + editor tests updated

### F4 — Discard dialog fires `onCancel` after a confirm too

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/workout/discard-dialog.tsx:25
- **Detail**: `onOpenChange` routes every close to `onCancel`, including the close Radix performs right after `onConfirm`. Harmless with the current parent, but a semantic trap for parents attaching real cancel side effects.
- **Fix**: Rename the prop to `onClose`, or guard `onOpenChange` so it doesn't re-fire after confirm.
- **Decision**: FIXED — prop renamed to `onClose` with semantics documented; editor call site updated

### F5 — Weight input lacks the NaN guard duration has

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/workout/exercise-card.tsx:130
- **Detail**: Duration renders through `asEmptyableNumericValue` (NaN → ""), weight uses bare `field.value ?? ""`. Safe today, but an S-03 snapshot mapper reusing the NaN convention would display literal "NaN". Subsumed by F3 Fix A if chosen.
- **Fix**: Use `asEmptyableNumericValue(field.value)` for weight too.
- **Decision**: FIXED — subsumed by F3 Fix A (weight input now uses `asEmptyableNumericValue`)

### F6 — No size caps on exercises/sets/notes payloads

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation/workout-session-schema.ts (pre-existing)
- **Detail**: Neither the form schema nor the server write schema caps array or string lengths — add-exercise/add-set plus the save action allow arbitrarily large payloads. Outside phase 3's scope (plan forbids schema changes).
- **Fix**: Add `.max()` bounds to the server write schema in a later change.
- **Decision**: QUEUED — recorded in follow-ups/review-fixes.md (out of this change's scope per the plan's no-schema-changes rule)

### F7 — Pre-existing: parameter-form likely renders raw i18n keys on error

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/plan/parameter-form.tsx (pre-existing)
- **Detail**: shadcn's `FormMessage` prefers raw `error.message` over children when an error exists, so parameter-form's `<FormMessage>{cond && tValidation(...)}` pattern likely displays the untranslated i18n key. The editor's documented deviation (manual error rendering) was the right call; this is a latent bug in pre-existing code.
- **Fix**: Follow-up: verify in the browser, then render translated text via `FormMessage`'s children-only path or replicate the editor's manual approach in parameter-form.
- **Decision**: QUEUED — recorded in follow-ups/review-fixes.md (pre-existing code, outside this change)
