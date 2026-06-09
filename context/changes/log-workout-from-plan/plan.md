# Log a Workout from the Active Plan (S-01) — Implementation Plan

## Overview

Build the workout-logging page (`/log-workout`): the user picks which day/session of their
active plan they performed, gets an editor pre-filled with that day's prescribed exercises,
edits actual reps/weight, adds/removes sets and exercises, enters a manual duration and a
note, and saves the session as a standalone snapshot via the F-01 store — or discards
without any write. This is the roadmap's north star: it proves the closed loop
(generate plan → perform → log).

## Current State Analysis

- **Data layer is complete (F-01, archived 2026-06-09).** `src/db/schema.ts` has
  `workout_sessions` → `workout_session_exercises` → `workout_session_sets` (internal
  cascading FKs, advisory non-FK `source_plan_id`, `(user_id, performed_at DESC)` index).
  `src/db/workout-sessions.ts` ships `createSession`, `getSessionById`, `listSessions`,
  `updateSession`, `deleteSession`, all `user_id`-scoped (RLS off). The write contract is
  `workoutSessionInputSchema` in `src/lib/validation/workout-session-schema.ts:41` —
  per-set actuals (`reps: string`, `weight?: number`), `min(1)` exercise and `min(1)` set.
- **The plan shape** (`src/lib/validation/plan-schema.ts:50`): `weeklySchedule[]` of days
  `{ day: string, focus: string, isRest: boolean, exercises?: [{ name, reps: string,
  sets: number, muscleGroup?, note? }] }`. The plan is a *template* (one reps string + a
  set count); the session stores *per-set actuals*. `reps` is text in both shapes, so
  "8-12" seeds losslessly by design (see `src/db/schema.ts` comment at the sets table).
- **No logging UI exists.** Routes: `/plan`, `/plan/new` only. The shared navbar
  (`src/app/(app)/layout.tsx:14-54`) has plan / newPlan links, a disabled "Progress"
  placeholder (`<span className="opacity-40">`), locale toggle, sign-out.
- **Established patterns:** RHF + zodResolver with i18n *message keys* translated via the
  `Validation` namespace (`src/components/plan/parameter-form.tsx`); server actions
  returning `{ ok, code }` (`src/lib/auth/actions.ts`); sonner toasts with error-code →
  i18n mapping; next-intl JSON catalogs (`src/i18n/messages/{pl,en}.json`) with a
  catalog-parity test (`src/tests/i18n/catalog-parity.test.ts`); routes protected by
  default in `src/proxy.ts` (only `PUBLIC_ROUTES` are open — `/log-workout` needs no
  proxy change).
- **Mockup** (`context/foundation/design/rejestracja_treningu/`): exercise cards with a
  set table (Seria | Powtórzenia | Ciężar (kg) | Akcja), "Dodaj serię", per-exercise
  delete icon, dashed "Dodaj kolejne ćwiczenie" card, notes textarea, "Zapisz trening i
  zakończ" / "Odrzuć zmiany". It omits the day picker, duration field, and date field —
  those gaps are resolved by the decisions below. Its per-set "done" toggle is FR-013,
  explicitly dropped.
- **Test infra:** Vitest + RTL (`src/tests/**` mirrors `src/`), Stryker available. F-01
  already integration-tests the store (`src/tests/db/workout-sessions.test.ts`).

## Desired End State

A logged-in user with an active plan clicks "Log Workout" in the navbar, picks the day
they trained, edits actuals in a pre-filled editor, enters duration (+ optional note),
saves — and a snapshot row tree exists in the DB that survives plan regeneration. With no
active plan, the navbar entry is disabled and the page shows a blocked state pointing to
plan generation. Everything renders in PL and EN.

Verify: manual flow checklist in Phase 4 + all automated criteria green
(`npx tsc --noEmit`, `npm run lint`, `npx vitest run`).

### Key Discoveries:

- `createSession(input)` validates with `workoutSessionInputSchema` and returns the new
  session id (`src/db/workout-sessions.ts:71-92`) — the action only needs to compose the
  input and call it; no new DB code for saving.
- Pre-fill = expand the plan exercise's `sets: number` into N set rows, each seeded with
  the plan's `reps` string and empty weight (`src/db/schema.ts` sets-table comment
  documents this intent).
- Zod schemas in forms carry i18n keys, not strings — e.g. `{ message: "invalid_age" }`
  translated by `tValidation(...)` (`src/lib/validation/plan-schema.ts:13-26`).
- The navbar must become plan-state-aware (FR-017 "entry point disabled"); the layout is a
  server component, so a cheap `hasActivePlan` exists-query is needed — `getActivePlan`
  pulls the full jsonb row and is too heavy for every page render.
- `performedAt` is `z.coerce.date()` and `sourcePlanId` is `uuid().nullish()` in the write
  schema — both are stamped server-side, never sent by the client.

## What We're NOT Doing

- History page, list rendering (S-02) — this slice only *writes* sessions.
- Editing/deleting saved sessions (S-03) — but the editor's contract is designed for it.
- Dashboard or post-auth redirect changes (S-04/S-05).
- Per-set "done" toggles (FR-013, dropped), history pagination (FR-022, parked),
  search/filter (FR-019, dropped).
- Free-form logging without an active plan (out of scope per FR-017 resolution).
- Editable session date — `performedAt` is the save timestamp (decision; S-03 can add it).
- Replacing the disabled "Progress" navbar placeholder — that's S-02's job.
- No changes to `src/db/workout-sessions.ts`, the schema, or migrations.

## Implementation Approach

Bottom-up in four phases: (1) the pure contracts everything else consumes — form schema,
plan-day→form-values mapper, all i18n strings; (2) the save server action; (3) the shared
presentational editor; (4) the route page, day picker, and navbar wiring. Each phase is
independently type-checked, linted, and unit-tested; the full user flow is manually
verified at the end of Phase 4.

The load-bearing architectural decision (settled in planning, required by S-03): the
editor is a **presentational component with a normalized form contract** —
`WorkoutSessionFormValues` = `WorkoutSessionInput` minus `performedAt`/`sourcePlanId`. It
takes `defaultValues` + an `onSave` callback and never knows whether the data came from a
plan day (S-01) or a saved snapshot (S-03). S-03 adds only a mapper and a route.

## Critical Implementation Details

- **Server-side stamping:** the action must derive `sourcePlanId` from the user's active
  plan and `performedAt` from the server clock — neither is accepted from the client. The
  action re-checks an active plan exists (gating rule, defense in depth — the page guard
  alone is bypassable by a direct POST).
- **Nested field arrays:** RHF requires the sets-level `useFieldArray` to live in a child
  component instantiated per exercise (`name: \`exercises.${index}.sets\``) — a top-level
  component cannot call `useFieldArray` in a loop. Plan the component split accordingly
  (editor → exercise card → set rows).
- **Remove-affordance contract:** the remove-set button is disabled on an exercise's last
  remaining set (the write schema requires `min(1)` set; removing the exercise itself is
  how you drop it). Exercises may be removed down to zero, but save then fails client-side
  validation with a `min_one_exercise` message — don't silently disable the save button.
- **Navbar freshness & cost:** App Router *preserves* shared layouts on soft navigation —
  the layout's `hasActivePlan` check runs on full page loads, not on every `<Link>` click.
  Two consequences: (a) the plan-generation success path must call `router.refresh()`
  (precedent: `src/components/locale-toggle.tsx:18`) so a fresh user's "Log Workout" entry
  enables without a hard reload; (b) per-navigation cost is a non-issue, but still use a
  select-`id`-only `hasActivePlan` query (hits the `plans_user_active_idx` index), not
  `getActivePlan` (full jsonb row).
- **Pickable days:** a day is loggable only if `!isRest && exercises?.length > 0`
  (`exercises` is optional in the plan schema). If no day qualifies, the page shows the
  "nothing to log" state — same component family as the no-plan state, different message.

## Phase 1: Pre-fill Contract & i18n Foundation

### Overview

Ship the pure logic and strings everything else consumes: the client form schema (with
i18n message keys), the plan-day→form-values mapper, and all PL/EN catalog entries.
No UI, no IO — fully unit-tested.

### Changes Required:

#### 1. Client form schema

**File**: `src/lib/validation/workout-session-form-schema.ts` (new)

**Intent**: The editor's form contract — what RHF validates on save. Mirrors the server
write schema's structure but carries i18n message keys (like `plan-schema.ts`) and omits
the server-stamped fields.

**Contract**: exports `workoutSessionFormSchema` and
`type WorkoutSessionFormValues = z.infer<...>` — shape: `{ durationMinutes, exercises:
[{ muscleGroup?, name, note?, sets: [{ note?, reps, weight? }] }], note?, sessionName,
sessionType? }` (i.e. `WorkoutSessionInput` minus `performedAt`/`sourcePlanId`).
Constraints with `Validation`-namespace keys: `reps` non-empty (`invalid_reps`), exercise
`name` non-empty (`invalid_exercise_name`), `durationMinutes` int ≥ 0
(`invalid_duration`), `exercises` min 1 (`min_one_exercise`), each exercise's `sets`
min 1 (`min_one_set`). Number inputs arrive as strings/NaN from the DOM — coerce
`durationMinutes` and `weight` (empty → `undefined` for weight).

#### 2. Plan-day → form-values mapper

**File**: `src/lib/workout/map-plan-day-to-form-values.ts` (new)

**Intent**: The FR-011 pre-fill rule as a pure function — expands the plan template into
editable per-set actuals.

**Contract**: `mapPlanDayToFormValues(day: GeneratedPlan["weeklySchedule"][number]):
WorkoutSessionFormValues`. Per exercise: emit `max(sets, 1)` set rows each seeded
`{ reps: <plan reps string>, weight: undefined }`; copy `name`, `muscleGroup`, `note`.
Session fields: `sessionName ← day.focus || day.day` (the write schema requires
`sessionName` min(1) but the form renders no input for it — fall back so an empty `focus`
can't surface as an opaque server-side `invalid_input`), `sessionType ← day.day`
(planning decision), `durationMinutes` left empty for the user, `note` empty. Treat
missing `exercises` as `[]` (callers filter unloggable days, but the mapper must not
throw).

#### 3. i18n catalog entries

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: All user-facing strings for the slice (FR-025), added to both locales in one
step so the catalog-parity test pins them from day one.

**Contract**: `Nav.logWorkout`; new `LogWorkout` namespace — page title/subtitle, day-picker
heading + exercise-count label, set-table headers (set/reps/weight-kg/action), addSet,
addExercise, removeSet/removeExercise (aria-labels), exercise-name + duration + notes
labels/placeholders, save/discard buttons, discard-confirm dialog (title/body/confirm/
cancel), no-plan blocked state (title/body/CTA), no-loggable-days message, save-success
toast; new `WorkoutErrors` namespace — `unauthenticated`, `no_active_plan`,
`invalid_input`, `save_failed`; `Validation` additions — `invalid_reps`,
`invalid_exercise_name`, `invalid_duration`, `min_one_exercise`, `min_one_set`. Polish
copy follows the mockup (`Zarejestruj swój trening`, `Dodaj serię`, `Zapisz trening i
zakończ`, `Odrzuć zmiany`, …).

#### 4. Unit tests

**File**: `src/tests/lib/workout/map-plan-day-to-form-values.test.ts`,
`src/tests/lib/validation/workout-session-form-schema.test.ts` (new)

**Intent**: Pin the pre-fill oracle (FR-011: "pre-fills that day's exercises, sets, and
reps") and the form contract before any UI consumes them.

**Contract**: mapper — `sets: 3, reps: "8-12"` → exactly 3 rows each `reps: "8-12"`,
`weight: undefined`; name/muscleGroup copied; `sessionName`/`sessionType` mapping incl.
the empty-`focus` fallback (`focus: ""` → `sessionName = day.day`); day
without `exercises` → `exercises: []`. Schema — valid values pass; each constraint fails
with its exact i18n key; weight `""` → `undefined`; output type satisfies the
`WorkoutSessionInput` subset (compile-time check). The existing catalog-parity test covers
the locale files automatically.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- New unit tests + existing suite pass (incl. catalog parity): `npx vitest run`

#### Manual Verification:

- None — pure logic phase.

---

## Phase 2: Save Server Action

### Overview

The single mutation entry point: authenticate, enforce the gating rule, stamp the
server-side fields, validate against the write schema, persist via `createSession`.

### Changes Required:

#### 1. Server action

**File**: `src/lib/workout/actions.ts` (new)

**Intent**: FR-016's save path. Follows the auth-actions pattern (`"use server"`, Zod
guard, `{ ok, code }` result) rather than a route handler — there's nothing to stream.

**Contract**: `saveWorkoutSession(values: WorkoutSessionFormValues):
Promise<SaveWorkoutResult>` where `SaveWorkoutResult = { ok: true } | { ok: false, code:
WorkoutErrorCode }` and `WorkoutErrorCode = "unauthenticated" | "no_active_plan" |
"invalid_input" | "save_failed"`. Flow: `supabase.auth.getUser()` → `getActivePlan(user.id)`
(null → `no_active_plan`, no write — gating rule 3) → compose
`{ ...values, performedAt: new Date(), sourcePlanId: activePlan.id }` → `safeParse` with
`workoutSessionInputSchema` (fail → `invalid_input`) →
`createSession({ ...parsed.data, userId: user.id })` — `CreateSessionInput` requires
`userId` on top of the schema fields (`src/db/workout-sessions.ts:212-214`) — (throw →
`save_failed`, logged via the existing error-logging approach, no `console.log`). The
action returns the result; the client owns toast + redirect (matches the auth-card
pattern, `src/components/auth/auth-card.tsx:41-50`).

#### 2. Action tests (hermetic)

**File**: `src/tests/lib/workout/actions.test.ts` (new)

**Intent**: Pin the contract branches that real infra can't cheaply trigger — the store's
own persistence is already integration-tested in F-01.

**Contract**: stub the supabase client, `getActivePlan`, and `createSession` (follow the
mocking style of `src/tests/lib/auth/actions.test.ts`). Cases: unauthenticated →
`{ ok: false, code: "unauthenticated" }`, `createSession` not called; no active plan →
`no_active_plan`, not called; invalid payload (e.g. zero exercises) → `invalid_input`;
happy path → `createSession` receives `userId` = authenticated user's id, `sourcePlanId`
= active plan id, and a `performedAt` `Date`, returns `{ ok: true }`; `createSession`
rejects → `save_failed`.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Action tests + full suite pass: `npx vitest run`

#### Manual Verification:

- None — exercised end-to-end in Phase 4.

---

## Phase 3: Shared Workout-Session Editor

### Overview

The reusable presentational editor (the S-03 contract): nested field arrays per the
mockup, duration + notes, save / discard-with-confirm. Pure function of
`defaultValues` + callbacks — no data fetching, no knowledge of plan vs snapshot.

### Changes Required:

#### 1. shadcn alert-dialog

**File**: `src/components/ui/alert-dialog.tsx` (generated)

**Intent**: Confirm dialog for dirty-form discard. Install via
`npx shadcn@latest add alert-dialog`.

**Contract**: stock shadcn component; no customization beyond theme tokens already in place.

#### 2. Editor component

**File**: `src/components/workout/workout-session-editor.tsx` (new)

**Intent**: The single editor for new (S-01) and saved (S-03) sessions. Owns the RHF form
(`zodResolver(workoutSessionFormSchema)`), renders exercise cards, the add-exercise card,
duration input, notes textarea, and the save/discard footer per the mockup.

**Contract**: `Props = { defaultValues: WorkoutSessionFormValues, onDiscard: () => void,
onSave: (values: WorkoutSessionFormValues) => Promise<void> | void, saving?: boolean }` —
this signature is what S-03 reuses; document that in the component docblock. Top-level
`useFieldArray` for `exercises`; "Dodaj kolejne ćwiczenie" appends an exercise with an
empty name and one empty set; validation errors translated via `tValidation(message)`
(parameter-form pattern). Discard: if `formState.isDirty`, open the confirm dialog, else
call `onDiscard` directly (planning decision). `sessionName`/`sessionType` ride through
the form values without rendered inputs this slice. Duration is a required number input
(minutes); set-table "Akcja" column hosts the remove-set button (the mockup's done-toggle
is dropped FR-013).

#### 3. Exercise card (nested field array)

**File**: `src/components/workout/exercise-card.tsx` (new)

**Intent**: One exercise's card: name, muscle-group badge, set table (Seria |
Powtórzenia | Ciężar (kg) | Akcja), add-set button, remove-exercise icon. Required as a
separate component because the sets `useFieldArray` must be instantiated per exercise.

**Contract**: receives the exercise index + remove-exercise callback; runs
`useFieldArray({ name: \`exercises.${index}.sets\` })`; "Dodaj serię" appends
`{ reps: "", weight: undefined }`; remove-set disabled when only one set remains
(per Critical Implementation Details); exercise name is an editable text input; reps is a
text input (accepts "8-12" seeds and typed actuals), weight a number input.

#### 4. Discard confirm dialog

**File**: `src/components/workout/discard-dialog.tsx` (new)

**Intent**: The dirty-discard confirmation (planning decision: confirm on discard click
only, no router/beforeunload guard).

**Contract**: dumb wrapper over `alert-dialog` with `open`, `onCancel`, `onConfirm` props
and `LogWorkout` dialog strings.

#### 5. Editor component tests

**File**: `src/tests/components/workout/workout-session-editor.test.tsx` (new)

**Intent**: Pin the FR-012/FR-014 must-have behaviors at the component layer (the
decision: no page e2e this slice).

**Contract**: RTL, following `src/tests/components/plan/*.test.tsx` conventions
(next-intl test setup). Cases: renders pre-filled values from `defaultValues`; add set
appends a row, remove set removes one, remove-set disabled at one remaining; add/remove
exercise; submit with valid edits calls `onSave` with the edited values; submit with zero
exercises shows the `min_one_exercise` validation message and does not call `onSave`;
discard on a pristine form calls `onDiscard` without a dialog; discard on a dirty form
opens the dialog, confirm calls `onDiscard`, cancel does not.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Editor tests + full suite pass: `npx vitest run`

#### Manual Verification:

- None yet — the editor has no route until Phase 4; visual check happens there.

---

## Phase 4: Route, Day Picker & Navbar Wiring

### Overview

Make it reachable: the `/log-workout` page with server-side gating, the day-picker step,
the smart flow component wiring picker → mapper → editor → action, and the state-aware
navbar entry. Ends with the manual verification of the whole slice.

### Changes Required:

#### 1. Cheap active-plan existence query

**File**: `src/db/plans.ts`

**Intent**: The navbar's gating check without pulling the plan jsonb on every page render.

**Contract**: `hasActivePlan(userId: string): Promise<boolean>` — select `id` only,
`where (userId, isActive)`, `limit 1` (uses `plans_user_active_idx`). Add a test case
alongside the existing `src/tests/db/plans.test.ts` coverage following its style.

#### 2. Day picker

**File**: `src/components/workout/day-picker.tsx` (new)

**Intent**: FR-011's "pick which workout day/session" as selectable cards (planning
decision: a step on the logging page, not a URL param).

**Contract**: dumb component: `{ days: { day, exerciseCount, focus }[], onPick: (index:
number) => void }` where `index` refers to the *filtered loggable* list provided by the
flow. Card shows day label, focus, exercise count.

#### 3. Logging flow (smart client component)

**File**: `src/components/workout/log-workout-flow.tsx` (new)

**Intent**: The one stateful client piece: holds the picked day, maps it to form values,
hands them to the editor, calls the save action, handles toast + navigation.

**Contract**: `Props = { weeklySchedule: GeneratedPlan["weeklySchedule"] }`. Filters
loggable days (`!isRest && exercises?.length`); none → renders the no-loggable-days
message. No pick yet → `DayPicker`; picked → `WorkoutSessionEditor` with
`defaultValues = mapPlanDayToFormValues(day)`, `onSave` → `saveWorkoutSession`; on
`{ ok: true }` → success toast + `router.push("/plan")`; on error → `toast.error(tErrors(code))`
(auth-card pattern). `onDiscard` → `router.push("/plan")`. Day-filtering logic, if more
than an inline predicate, goes to a sibling helper file per repo rule 9.

#### 4. Blocked / empty state

**File**: `src/components/workout/log-workout-empty-state.tsx` (new)

**Intent**: FR-017's "page cannot be used" face: no active plan → explain + CTA to
`/plan/new` (mirrors `PlanEmptyState`).

**Contract**: dumb server-renderable component, `LogWorkout` namespace strings, `Link` to
`/plan/new`.

#### 5. Page (RSC)

**File**: `src/app/(app)/log-workout/page.tsx` (new)

**Intent**: Server gate + data load, minimal JSX (smart/dumb split, mirrors
`src/app/(app)/plan/page.tsx:18-35`).

**Contract**: `createClient` → `getUser` → no user: `redirect("/login")`;
`getActivePlan(user.id)` → null: render `LogWorkoutEmptyState`; else render page heading +
`LogWorkoutFlow` with `(activePlan.plan as GeneratedPlan).weeklySchedule`. No proxy change
needed (protected by default).

#### 6. Navbar entry

**File**: `src/app/(app)/layout.tsx`

**Intent**: Add the "Log Workout" entry (constraint: must not disturb existing
plan/newPlan links, Progress placeholder, locale toggle, sign-out). State-aware per
FR-017: a `Link` to `/log-workout` when an active plan exists, otherwise a disabled span
styled exactly like the Progress placeholder.

**Contract**: layout fetches the user (supabase) and calls `hasActivePlan(user.id)`;
entry labeled `t("logWorkout")` from `Nav`. Existing entries and controls unchanged.

#### 7. Barrel for the workout components

**File**: `src/components/workout/index.ts` (new)

**Intent**: Multi-file directory barrel per repo convention (rule 2).

**Contract**: re-export the editor, picker, flow, empty state, discard dialog.

#### 8. Layout refresh after plan generation

**File**: `src/components/plan/plan-generator.tsx`

**Intent**: The navbar's plan-state is computed in the `(app)` layout, which the App
Router preserves across soft navigations — without a refresh, a fresh user's newly
generated plan leaves "Log Workout" stale-disabled until a hard reload.

**Contract**: on generation success (where `finalPlan` is set), call
`startTransition(() => router.refresh())` (the `locale-toggle.tsx:18` pattern) to re-render
the layout and enable the navbar entry. Existing in-page final-plan rendering unchanged.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Full suite passes (incl. `hasActivePlan` test + catalog parity): `npx vitest run`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With an active plan: navbar "Log Workout" links to `/log-workout`; picker lists only
  non-rest days with exercises; picking a day shows the editor pre-filled with that day's
  exercises, N set rows per exercise seeded with the plan's reps, empty weights.
- Edit actuals, add a set, remove a set, remove an exercise, add a new exercise, enter
  duration + note, save → success toast, redirected to `/plan`, and the session tree is
  present in the DB (`workout_sessions` + children) with `source_plan_id` set and
  `performed_at` ≈ now.
- Regenerate the plan, confirm the saved session rows are untouched (FR-024 snapshot rule).
- Discard on a dirty form shows the confirm dialog; confirming navigates to `/plan` with
  no DB write; discard on a pristine form navigates directly.
- With no active plan (fresh user): navbar entry renders disabled; visiting
  `/log-workout` directly shows the blocked state with the generate-plan CTA.
- Fresh user generates their first plan: without a hard reload, the navbar "Log Workout"
  entry becomes an enabled link (the post-generation `router.refresh()` works).
- Toggle PL ↔ EN on the page: all strings switch, no hard-coded text (FR-025).
- Existing pages (`/plan`, `/plan/new`, login/logout) still work; navbar unchanged
  otherwise.

**Implementation Note**: After automated verification passes, pause for human manual
confirmation before considering the slice done.

---

## Testing Strategy

### Unit Tests:

- Mapper: set-count expansion, reps seeding, name/type mapping, missing-exercises day.
- Form schema: every constraint fails with its exact i18n key; coercion of number inputs;
  compile-time compatibility with `WorkoutSessionInput`.
- Server action (hermetic, stubbed supabase/DB): unauthenticated, no-active-plan,
  invalid-input, happy-path stamping, persistence failure — partial-failure branches real
  infra can't cheaply trigger.
- Editor (RTL): field-array add/remove at both levels, last-set guard, save/discard
  semantics, validation surfacing.
- `hasActivePlan` alongside the existing plans DB tests.

### Integration Tests:

- None new — `createSession`'s real-DB behavior is already covered by F-01's
  `src/tests/db/workout-sessions.test.ts` (two-layer strategy: don't re-test the store).

### Manual Testing Steps:

See Phase 4 Manual Verification — it is the slice-level acceptance checklist (US-01).

## Performance Considerations

- Save is one transaction via `createSession`; history-read p95 belongs to S-02. The
  guardrail here is the ~1s save: a single nested insert, well within budget.
- The navbar's per-navigation cost is bounded by `hasActivePlan` being an index-only,
  id-only, limit-1 query.

## Migration Notes

None — purely additive UI + one read-only query helper. No schema or data changes
(migrations shipped with F-01).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (US-01, FR-011..FR-017, FR-025, Business Logic 1-3)
- F-01 store plan: `context/archive/2026-06-09-workout-session-snapshot-store/plan.md`
- Write contract: `src/lib/validation/workout-session-schema.ts:41`
- Plan shape: `src/lib/validation/plan-schema.ts:29-75`
- Mockup: `context/foundation/design/rejestracja_treningu/screen.png`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.
> Do not rename step titles.

### Phase 1: Pre-fill Contract & i18n Foundation

#### Automated

- [x] 1.1 Type check passes: `npx tsc --noEmit` — 94e2b3e
- [x] 1.2 Lint passes: `npm run lint` — 94e2b3e
- [x] 1.3 New unit tests + existing suite pass (incl. catalog parity): `npx vitest run` — 94e2b3e

### Phase 2: Save Server Action

#### Automated

- [x] 2.1 Type check passes: `npx tsc --noEmit` — 68a7157
- [x] 2.2 Lint passes: `npm run lint` — 68a7157
- [x] 2.3 Action tests + full suite pass: `npx vitest run` — 68a7157

### Phase 3: Shared Workout-Session Editor

#### Automated

- [ ] 3.1 Type check passes: `npx tsc --noEmit`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Editor tests + full suite pass: `npx vitest run`

### Phase 4: Route, Day Picker & Navbar Wiring

#### Automated

- [ ] 4.1 Type check passes: `npx tsc --noEmit`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Full suite passes (incl. `hasActivePlan` test + catalog parity): `npx vitest run`
- [ ] 4.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 4.5 Picker → pre-filled editor flow correct (day filtering, seeded sets/reps)
- [ ] 4.6 Edit/add/remove + save persists the full session tree with stamped
      `source_plan_id`/`performed_at`; success toast + redirect to `/plan`
- [ ] 4.7 Saved session survives plan regeneration (FR-024)
- [ ] 4.8 Discard semantics: dirty → confirm dialog, pristine → direct navigation, no write
- [ ] 4.9 No-plan gating: disabled navbar entry + blocked page state with CTA (FR-017)
- [ ] 4.10 PL/EN parity on all new UI (FR-025)
- [ ] 4.11 No regressions: existing pages, navbar controls, auth flow
- [ ] 4.12 Navbar entry enables after first plan generation without a hard reload
