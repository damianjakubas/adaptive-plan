# Log a Workout from the Active Plan (S-01) — Plan Brief

> Full plan: `context/changes/log-workout-from-plan/plan.md`

## What & Why

The shipped MVP generates a training plan and stops — there is no way to record that a
prescribed workout was actually performed. This slice builds the workout-logging page:
pick which day of your active plan you trained, edit the actual reps/weight on a
pre-filled editor, add a duration and note, and save it as a standalone snapshot. It is
the roadmap's north star: it proves the closed loop (generate → perform → log) that the
rest of the roadmap depends on.

## Starting Point

The data layer is already done (F-01, archived): a normalized, plan-decoupled session
store with full CRUD (`src/db/workout-sessions.ts`) and a Zod write contract. This slice
is purely UI + one server action. No routes, components, or strings for logging exist yet;
the navbar has a disabled "Progress" placeholder that stays untouched (S-02's job).

## Desired End State

A logged-in user with an active plan clicks "Log Workout", picks the day they trained,
edits actuals in an editor seeded from the plan (a "sets: 3, reps: 8-12" exercise becomes
3 editable rows pre-filled with "8-12"), saves — and the snapshot survives any later plan
regeneration. With no active plan, the navbar entry is disabled and the page shows a
blocked state pointing at plan generation. Fully PL/EN.

## Key Decisions Made

| Decision              | Choice                                                            | Why (1 sentence)                                                                  | Source  |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| Editor reuse (S-03)   | Shared presentational editor + two entry routes                   | S-03 adds only a snapshot→form mapper and a route; the editor never knows its source. | Plan    |
| Day selection (FR-011)| Picker step on `/log-workout` itself                              | Keeps the route self-contained — navbar and future dashboard CTA just link to it.  | Plan    |
| Name mapping          | `sessionName ← focus`, `sessionType ← day`                        | History (S-02) shows what the workout *was*; both editable later via S-03.         | Plan    |
| Session date          | `performedAt` = save time, no UI field                            | Matches the after-the-fact flow and the mockup; backfilling can come with S-03.    | Plan    |
| Discard UX            | Navigate to `/plan`; confirm dialog only when the form is dirty   | Cheap protection against losing a long entry; no brittle router guards.            | Plan    |
| Save mechanism        | Server action (`{ ok, code }` pattern)                            | Matches auth actions; nothing to stream, unlike plan generation.                   | Plan    |
| Gating surface        | Disabled navbar entry + server-guarded page + action re-check     | FR-017 literally requires the entry point disabled; action check is defense in depth. | PRD   |
| Snapshot semantics    | `sourcePlanId`/`performedAt` stamped server-side only             | The snapshot rule (and tamper-safety) must not depend on client input.             | PRD     |
| Test depth            | Unit logic + contracts (mapper, action, editor); no page e2e      | Store already integration-tested in F-01; cheapest layer covers every new decision. | Plan   |

## Scope

**In scope:** `/log-workout` page (day picker → pre-filled editor), shared
`WorkoutSessionEditor` (nested field arrays, add/remove sets & exercises, duration, note,
save/discard+confirm), `saveWorkoutSession` server action, state-aware "Log Workout"
navbar entry, `hasActivePlan` query helper, all PL/EN strings, unit/component tests.

**Out of scope:** history list (S-02), edit/delete saved sessions (S-03), dashboard
(S-04/S-05), per-set done toggles (FR-013 dropped), pagination (FR-022 parked), free-form
logging without a plan, editable session date, any schema/migration change.

## Architecture / Approach

RSC page gates (auth + active plan) and passes `weeklySchedule` to a smart client flow:
picker state → `mapPlanDayToFormValues` (pure, unit-tested: expands the plan's
`sets`-count template into per-set actual rows) → presentational editor (RHF + Zod with
i18n message keys, per the existing wizard pattern) → server action that re-checks the
active plan, stamps `performedAt`/`sourcePlanId`, validates with the F-01 write schema,
and calls the existing `createSession`. The editor's props contract
(`defaultValues` + `onSave`) is the interface S-03 reuses.

## Phases at a Glance

| Phase                                | What it delivers                                            | Key risk                                                       |
| ------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Pre-fill contract & i18n          | Form schema, plan-day→form mapper, all PL/EN strings        | Getting the form↔write-schema shape mismatch wrong              |
| 2. Save server action                | `saveWorkoutSession` with gating + server-side stamping     | Trusting client input for `sourcePlanId`/`performedAt`          |
| 3. Shared editor component           | The reusable nested-field-array editor + discard dialog     | RHF nested `useFieldArray` requires a per-exercise child split  |
| 4. Route, picker & navbar wiring     | `/log-workout` end-to-end + state-aware navbar entry        | Touching the shared navbar without disturbing existing controls |

**Prerequisites:** F-01 shipped (it is — archived 2026-06-09); local Supabase/DB for manual verification.
**Estimated effort:** ~2-3 sessions across 4 phases; Phase 3 is the heaviest.

## Open Risks & Assumptions

- Assumes generated plans reliably have non-rest days with exercises; a plan with none
  hits the "nothing to log" state (handled, but it would signal a generation problem).
- Navbar plan-state is computed in the `(app)` layout, which App Router preserves across
  soft navigations — plan-generation success calls `router.refresh()` to enable the entry
  without a hard reload; the `hasActivePlan` query (index-only) runs on full loads only.
- Weight input uses a native number field; locale decimal-comma entry (PL) relies on
  browser behavior.

## Success Criteria (Summary)

- A user with an active plan can log a pre-filled workout, edit actuals, and save it; the
  snapshot persists and survives plan regeneration (US-01 acceptance criteria).
- With no active plan, logging is unreachable: disabled navbar entry + blocked page (FR-017).
- All new UI renders in both PL and EN with no hard-coded strings (FR-025); existing
  auth/plan/navbar behavior unchanged.
