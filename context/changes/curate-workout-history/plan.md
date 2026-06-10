# Curate Workout History (S-03) Implementation Plan

## Overview

Add **edit** and **delete** to the workout-history page. A user reopens any logged session
in the existing logging editor, edits actuals/duration/note, and saves — or permanently
deletes a session behind a confirmation step. This closes Stream A (the generate → log →
review → curate loop) and satisfies FR-020 and FR-021.

The defining fact of this slice: **the data layer is already finished and integration-tested.**
`src/db/workout-sessions.ts` already exports the full owner-scoped CRUD — `getSessionById`,
`updateSession`, `deleteSession` — and the `WorkoutSessionEditor` was built by S-01
explicitly to be reused here. This plan is UI + two server actions + one mapper + wiring.
No schema, migration, or DB change.

## Current State Analysis

What exists today (all confirmed by exploration, with file references):

- **Data layer — done and tested** (`src/db/workout-sessions.ts`):
  - `getSessionById(userId, sessionId): Promise<SessionWithTree | null>` (lines 130-149) —
    fetches the full nested tree (exercises → sets, ordered by `position`), owner-scoped,
    returns `null` when missing or not owned.
  - `updateSession(userId, sessionId, input: WorkoutSessionInput): Promise<boolean>`
    (lines 158-193) — validates, verifies ownership in a transaction, replace-all children,
    returns `false` when not owned.
  - `deleteSession(userId, sessionId): Promise<boolean>` (lines 199-206) — owner-scoped,
    cascades to exercises → sets, returns `false` when missing/not owned.
  - All three integration-tested in `src/tests/db/workout-sessions.test.ts`, including a
    per-account isolation test.
- **Shared editor — reuse-ready by design** (`src/components/workout/workout-session-editor.tsx`):
  pure presentational; contract `{ defaultValues: WorkoutSessionFormInput, onSave, onDiscard, saving }`.
  Its own docstring says it "never knows whether the data came from a plan day (S-01) or a
  saved snapshot (S-03)."
- **Patterns with a built twin to mirror:**
  - `mapPlanDayToFormValues` (`src/lib/workout/map-plan-day-to-form-values.ts`) — pure
    plan-day → `WorkoutSessionFormInput`. S-03 adds `mapSessionToFormValues(SessionWithTree)`.
  - `saveWorkoutSession` (`src/lib/workout/actions.ts`) — `{ ok, code }` server action that
    stamps `performedAt`/`sourcePlanId` server-side and gates on an active plan. S-03 adds
    `updateWorkoutSession` and `deleteWorkoutSession` in the same file, same shape.
  - `DiscardDialog` (`src/components/workout/discard-dialog.tsx`) — dumb wrapper over shadcn
    `AlertDialog` with `{ open, onClose, onConfirm }`. S-03 mirrors it as `DeleteConfirmDialog`.
  - `LogWorkoutFlow` (`src/components/workout/log-workout-flow.tsx`) — orchestrates picker →
    mapper → editor → action → toast → navigate. S-03's edit flow is simpler (no picker).
- **History list — currently read-only** (`src/components/history/history-list.tsx`): a sync
  server component, three-column grid (Date | Session | Duration), no actions. The
  `/history` page (`src/app/(app)/history/page.tsx`) gates auth via `getUser()` and calls
  `listSessions(user.id)`.
- **i18n** (`src/i18n/messages/{en,pl}.json`): `History`, `LogWorkout`, `WorkoutErrors`
  namespaces exist. `WorkoutErrors` currently holds `unauthenticated`, `no_active_plan`,
  `invalid_input`, `save_failed`.
- **Proxy** (`src/proxy.ts`): deny-by-default — `/history/[id]/edit` is auto-protected,
  no proxy change needed.

### Key Discoveries:

- **`SessionListItem` (the list DTO) does not load sets** (`src/db/workout-sessions.ts:216-226`) —
  it derives `muscleGroups` only, for the ~1s p95 guardrail. The edit path therefore must
  fetch the full tree with `getSessionById`, never reuse the list row.
- **`updateSession` already exists and replace-all-children is already tested** — the new
  logic in this slice is not the DB write but the **action-layer preservation of
  `performedAt` + `sourcePlanId`**, which is exactly where a cheap hermetic test belongs.
- **The write schema requires `performedAt` and `sourcePlanId`** (`workoutSessionInputSchema`,
  `src/lib/validation/workout-session-schema.ts:41-49`) — so the update action must source
  both from the original session, not from the editor (which surfaces neither).
- **`getSessionById` returning `null` covers the foreign/missing case** — no separate
  ownership branch is needed in the edit route; `null` → `redirect("/history")`.

## Desired End State

On `/history`, each session row carries an **Edit** link and a **Delete** trigger.

- **Edit** navigates to `/history/[id]/edit`: the saved session loads into the same
  full-screen editor used for new logs, pre-filled with its stored exercises/sets/duration/
  note. Saving persists the changes (preserving the original date and provenance) and
  returns to `/history` with the row updated in place. Editing works even when the user has
  no active plan or the plan has since changed.
- **Delete** opens an `AlertDialog` confirmation; confirming permanently removes the session
  (cascade to exercises/sets) and the list refreshes without it. Cancelling is a no-op.
- A stale or forged edit URL (`getSessionById` → `null`) bounces to `/history`.
- All new UI renders in PL and EN.

**Verification:** with seeded sessions, a user can edit a 3-day-old session's reps and the
row stays at its original date position; delete asks to confirm and removes the row; an
invented `/history/<random-uuid>/edit` redirects to `/history`; both locales show
translated labels. Existing auth/plan/navbar/history-read behavior is unchanged.

## What We're NOT Doing

- No schema, migration, or new DB function — the CRUD already exists.
- No editable `performedAt`/date-backfill field (considered and declined — out of FR-020's
  literal scope; the date is preserved, not exposed).
- No undo / trash / soft-delete / recovery — FR-021 specifies permanent delete.
- No active-plan gate on edit (deliberately omitted — FR-020 requires edit to work after
  the plan changed).
- No search/filter (FR-019 dropped), no load-more/pagination (FR-022 parked), no analytics
  (Non-Goal).
- No new integration or e2e tests — F-01 already integration-tested the CRUD; e2e is
  Lesson 4 scope.
- No change to `saveWorkoutSession`, the day picker, `LogWorkoutFlow`, or `/log-workout`.

## Implementation Approach

Build bottom-up so each layer is testable before its consumer exists:

1. **Pure logic + strings** (mapper, i18n) — no I/O, unit-tested in isolation.
2. **Server actions** (update, delete) — the `{ ok, code }` contract layer; hermetic tests
   with a mocked db prove the preservation rule and every error branch without a real DB.
3. **Delete UI on the existing list** — dialog + a client actions cell pushed to the leaf,
   keeping `HistoryList` a server component; `router.refresh()` reconciles after delete.
4. **Edit route + flow** — the RSC page mirrors `/log-workout`'s anatomy; the flow component
   is a thinner `LogWorkoutFlow` (no picker, straight to editor).

The update action is the one place with genuinely new behavior: it reads the original
session for `performedAt` + `sourcePlanId`, merges those onto the editor's form values,
validates against the existing write schema, and calls `updateSession`. The editor never
sees or sends those fields.

## Critical Implementation Details

**State sequencing (update action).** The update action MUST fetch the original session
(`getSessionById`) and carry its `performedAt` + `sourcePlanId` into the update payload.
Taking these from the client, or re-stamping `performedAt = new Date()`, silently reorders
history and breaks the snapshot rule (FR-024). Ownership is established by the same fetch:
`null` → `not_found`, no write attempted.

**Gating divergence from save.** `saveWorkoutSession` returns `no_active_plan` when there is
no plan; `updateWorkoutSession` must NOT — FR-020 requires edit to work after the plan has
changed or been removed. Do not copy the active-plan check across.

## Phase 1: Snapshot→form mapper & i18n strings

### Overview

Add the pure `SessionWithTree → WorkoutSessionFormInput` mapper and all new locale strings.
No I/O; foundation for phases 2-4.

### Changes Required:

#### 1. Snapshot→form mapper

**File**: `src/lib/workout/map-session-to-form-values.ts` (new)

**Intent**: Convert a saved session's nested tree into the editor's form-input shape, the
mirror image of `mapPlanDayToFormValues`. Lets the existing editor render a saved snapshot
with zero editor changes.

**Contract**: `mapSessionToFormValues(session: SessionWithTree): WorkoutSessionFormInput`.
Maps `exercises[].{name, muscleGroup, note}` and `exercises[].sets[].{reps, weight, note}`
through; coerces the numeric `durationMinutes` to the form's string input
(`String(session.durationMinutes)`); maps `weight: number | null` → `number | undefined`;
carries `sessionName` and the nullable `sessionType` (→ `undefined` when null); ignores
`performedAt`/`sourcePlanId` (the editor doesn't surface them — they are preserved in the
action, Phase 2). Follow the file-per-helper and export conventions of
`map-plan-day-to-form-values.ts`.

#### 2. Locale strings (PL + EN)

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Add the strings the row actions, delete-confirm dialog, and edit page need, plus
new action result codes. Keep both files key-for-key identical (alphabetical per ESLint).

**Contract**: In `History` — `edit`, `delete`, `editPageTitle` (e.g. "Edit workout"),
`deleteDialogTitle`, `deleteDialogBody`, `deleteDialogConfirm`, `deleteDialogCancel`.
In `WorkoutErrors` — `not_found`, `delete_failed`, plus success strings consumed by the
flow/cell toasts (`updateSuccess`, `deleteSuccess` — placed in `History` or `LogWorkout`
alongside the existing `saveSuccess`, matching where success copy already lives). Reuse the
existing `unauthenticated`, `invalid_input`, `save_failed` codes for update.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes (alphabetical keys, interface-after): `npm run lint`
- Mapper unit tests pass: `npm test -- map-session-to-form-values`

#### Manual Verification:

- Spot-check that every new key exists in both `en.json` and `pl.json` with no leftover
  placeholder text.

**Implementation Note**: After automated verification passes, pause for manual confirmation
before Phase 2.

---

## Phase 2: Update & delete server actions

### Overview

Add `updateWorkoutSession` and `deleteWorkoutSession` to the existing
`src/lib/workout/actions.ts`, following the `saveWorkoutSession` `{ ok, code }` pattern.
This is the only layer with new behavior (date/provenance preservation); cover it with
hermetic tests.

### Changes Required:

#### 1. Update action

**File**: `src/lib/workout/actions.ts`

**Intent**: Persist edits to an existing session while preserving its original
`performedAt` and `sourcePlanId`, scoped to the current user, without gating on an active
plan.

**Contract**: `updateWorkoutSession(sessionId: string, values: WorkoutSessionFormValues):
Promise<UpdateWorkoutResult>` where `UpdateWorkoutResult = { ok: true } | { ok: false; code:
UpdateErrorCode }` and `UpdateErrorCode = "unauthenticated" | "not_found" | "invalid_input"
| "save_failed"`. Flow: resolve user (`null` → `unauthenticated`); `getSessionById(user.id,
sessionId)` (`null` → `not_found`); build the write input as `{ ...values, performedAt:
original.performedAt, sourcePlanId: original.sourcePlanId }`; `workoutSessionInputSchema.safeParse`
(fail → `invalid_input`); `updateSession(user.id, sessionId, parsed.data)` (`false` →
`not_found`; throw → log via `logWorkoutError` + `save_failed`). No active-plan check.

#### 2. Delete action

**File**: `src/lib/workout/actions.ts`

**Intent**: Permanently delete a session owned by the current user.

**Contract**: `deleteWorkoutSession(sessionId: string): Promise<DeleteWorkoutResult>` where
`DeleteWorkoutResult = { ok: true } | { ok: false; code: DeleteErrorCode }` and
`DeleteErrorCode = "unauthenticated" | "not_found" | "delete_failed"`. Flow: resolve user
(`null` → `unauthenticated`); `deleteSession(user.id, sessionId)` (`false` → `not_found`;
throw → log + `delete_failed`); else `{ ok: true }`.

#### 3. Hermetic action tests

**File**: `src/tests/lib/workout/actions.test.ts` (extend existing)

**Intent**: Prove every branch of both actions against a mocked db (mirroring the existing
`saveWorkoutSession` test setup with `vi.hoisted`/`vi.mock`), without a real database.

**Setup extension**: The existing `@/db/workout-sessions` mock factory returns only
`{ createSession }` and the `vi.hoisted` block declares only
`createSession`/`getActivePlan`/`getUser`/`logWorkoutError`. Add `getSessionById`,
`updateSession`, and `deleteSession` to BOTH the `vi.hoisted` mocks object and the
`vi.mock("@/db/workout-sessions", …)` factory before writing the new cases.

**Contract**: For update — unauthenticated short-circuits (no `updateSession` call);
`getSessionById` → `null` yields `not_found`; **preservation**: assert `updateSession` is
called with the original session's `performedAt` and `sourcePlanId`, not values from the
editor input and not `now`; invalid input yields `invalid_input` with no write; thrown db
error yields `save_failed`. For delete — unauthenticated short-circuits; `deleteSession` →
`false` yields `not_found`; `true` yields `{ ok: true }`; thrown error yields `delete_failed`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Action tests pass: `npm test -- actions`

#### Manual Verification:

- (Optional, after Phase 4 wiring) edit a session in dev and confirm via DB/UI that its
  date does not move.

**Implementation Note**: After automated verification passes, pause for manual confirmation
before Phase 3.

---

## Phase 3: Delete-confirm dialog & history-row actions cell

### Overview

Add the delete confirmation dialog and a leaf client component that holds the per-row
Edit link and Delete trigger, wired into the otherwise-server `HistoryList`. Refresh the
list with `router.refresh()` after a successful delete.

### Changes Required:

#### 1. Delete-confirm dialog

**File**: `src/components/history/delete-confirm-dialog.tsx` (new)

**Intent**: A dumb confirmation dialog for permanent delete — the only safeguard FR-021
provides. Mirror of `discard-dialog.tsx`.

**Contract**: `"use client"` wrapper over shadcn `AlertDialog` with
`{ open: boolean, onClose: () => void, onConfirm: () => void }`; titles/body/buttons from
the `History` namespace (`deleteDialog*`). Confirm action styled as destructive.

#### 2. Row actions cell

**File**: `src/components/history/history-row-actions.tsx` (new)

**Intent**: The single client leaf in the history tree — holds the Edit link and the Delete
trigger + dialog state, so `HistoryList` stays a sync server component (CLAUDE.md rule 10;
view-history lesson on keeping the list server-rendered).

**Contract**: `"use client"`. Props `{ sessionId: string }`. Renders an Edit link
(`next/link` to `/history/${sessionId}/edit`, labelled from `History.edit`) and a Delete
button that opens `DeleteConfirmDialog`. On confirm: call `deleteWorkoutSession(sessionId)`;
on `{ ok: true }` → `toast.success(History.deleteSuccess)` + `router.refresh()`; on
`{ ok: false }` → `toast.error(WorkoutErrors[code])`; wrap in try/catch → `delete_failed`
toast (mirror `LogWorkoutFlow`'s consumption). Use `sonner` `toast` and `useRouter`.

#### 3. Wire the cell into the list

**File**: `src/components/history/history-list.tsx`

**Intent**: Attach the actions cell to each row without converting the list to a client
component.

**Contract**: Add a per-row actions slot rendering `<HistoryRowActions sessionId={session.id} />`.
Adjust the existing grid (e.g. an added actions column / row-end cell) so date/session/
duration layout is preserved; keep the header row aligned. `HistoryList` stays sync, no
`"use client"`.

#### 4. Component tests

**File**: `src/tests/components/history/delete-confirm-dialog.test.tsx` (new),
`src/tests/components/history/history-row-actions.test.tsx` (new)

**Intent**: Cover the confirmation contract and the action-result handling at the RTL layer.

**Contract**: Dialog — renders translated title/body/buttons under `NextIntlClientProvider`;
confirm fires `onConfirm`, cancel fires `onClose`. Row actions — Edit link points to
`/history/<id>/edit`; clicking Delete opens the dialog; confirming calls a mocked
`deleteWorkoutSession` and triggers success toast + `router.refresh()` on `{ ok: true }`,
and an error toast on `{ ok: false }`. Use `userEvent.setup({ pointerEventsCheck: 0 })` for
the Radix dialog (per existing editor test).

#### 5. Repair the existing history-list test for the new client leaf

**File**: `src/tests/components/history/history-list.test.tsx`

**Intent**: Wiring `HistoryRowActions` (`"use client"`, calls `useRouter()` at the top
level) into every row means the existing test now mounts that client leaf when it renders
`HistoryList`. Today this test renders `HistoryList` under `NextIntlClientProvider` with **no
`next/navigation` mock** — so after Phase 3's wiring, `useRouter()` throws "invariant expected
app router to be mounted" and the test fails to render (gate 3.3 catches it). The
plan-brief's "must not disturb the view-history component tests" risk lives here.

**Contract**: Add a per-file `vi.mock("next/navigation")` exposing `useRouter` (return a stub
with `push`/`refresh` `vi.fn()`s) — mirror the pattern already used in
`src/tests/components/locale-toggle.test.tsx` and `src/tests/components/plan/plan-generator.test.tsx`
(there is no global mock in `src/tests/setup.ts`). Mock `deleteWorkoutSession` from
`@/lib/workout/actions` if the leaf pulls it in transitively at module load. Existing
assertions (date/session/duration layout, badges, muscle groups) must still pass unchanged —
the goal is render-survival, not new coverage.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Component tests pass: `npm test -- history`

#### Manual Verification:

- On `/history`, each row shows Edit and Delete; clicking Delete opens a confirmation;
  confirming removes the row (list refreshes); cancelling leaves it.
- Both PL and EN render translated controls and dialog copy.
- `HistoryList` ships no client JS beyond the leaf actions cell (the list itself is still
  server-rendered).

**Implementation Note**: After automated verification passes, pause for manual confirmation
before Phase 4.

---

## Phase 4: Edit route & flow

### Overview

Add the `/history/[id]/edit` RSC page and the `EditWorkoutFlow` client component that loads
a saved session into the shared editor and persists edits, making the row Edit links live.

### Changes Required:

#### 1. Edit route page

**File**: `src/app/(app)/history/[id]/edit/page.tsx` (new)

**Intent**: Server entry for editing — gate auth, fetch the owned session, redirect on miss,
and hand off to the flow. Mirror of `src/app/(app)/log-workout/page.tsx`.

**Contract**: Async RSC reading the dynamic `id` param (Next.js 16 async `params` — confirm
the awaited-params API before coding). `getUser()` → `redirect("/login")` when absent;
`getSessionById(user.id, id)` → `redirect("/history")` when `null`; otherwise render
`<EditWorkoutFlow sessionId={session.id} defaultValues={mapSessionToFormValues(session)} />`.
Page title/eyebrow from `History` via `getTranslations` (server-component i18n rule).

#### 2. Edit flow component

**File**: `src/components/history/edit-workout-flow.tsx` (new)

**Intent**: Thin orchestrator — render the shared editor on the mapped snapshot, persist via
the update action, route back to history. A picker-less `LogWorkoutFlow`.

**Contract**: `"use client"`. Props `{ sessionId: string, defaultValues: WorkoutSessionFormInput }`.
Renders `WorkoutSessionEditor` with `defaultValues`, `saving` state, `onDiscard` →
`router.push("/history")`, and `onSave(values)` → `updateWorkoutSession(sessionId, values)`;
on `{ ok: true }` → `toast.success` + `router.push("/history")`; on `{ ok: false }` →
`toast.error(WorkoutErrors[code])`; try/catch → `save_failed` toast. Mirror
`LogWorkoutFlow`'s save handler.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Full test suite passes: `npm test`

#### Manual Verification:

- Clicking Edit on a row opens the editor pre-filled with that session's saved data; saving
  returns to `/history` with changes reflected.
- Editing an old session's reps does NOT move its date/position in the list (preservation).
- Editing works with no active plan and after the plan has been regenerated.
- Navigating to `/history/<random-uuid>/edit` redirects to `/history`.
- Discard returns to `/history` (with the dirty-confirm dialog when the form has changes).
- Both PL and EN render the edit page and editor correctly; auth gating still applies.

**Implementation Note**: After automated verification passes, pause for final manual
confirmation. Then update §6 cookbook in `test-plan.md` if applicable and close the change.

---

## Testing Strategy

Per the project's two-layer (cost × signal) rule, every NEW decision is covered by the
cheapest test that gives a real signal; the DB CRUD is not re-tested (F-01 owns it).

### Unit Tests:
- `mapSessionToFormValues` — round-trips a `SessionWithTree` to form input: duration number→
  string, `weight` null→undefined, nullable `sessionType`, exercise/set ordering, empty note.

### Hermetic (mocked-db) Tests:
- `updateWorkoutSession` — auth miss, `not_found` (session null / update false), **date &
  provenance preservation** (the load-bearing assertion), `invalid_input` (no write),
  `save_failed`.
- `deleteWorkoutSession` — auth miss, `not_found`, success, `delete_failed`.

### Component (RTL) Tests:
- `DeleteConfirmDialog` — translated copy; confirm/cancel callbacks.
- `HistoryRowActions` — edit link href; delete opens dialog; confirm → mocked action →
  success toast + `router.refresh()`; failure → error toast.

### Manual Testing Steps:
1. Seed ≥2 sessions on different dates; edit the older one's reps; confirm it stays in place.
2. Delete a session; confirm the dialog appears and the row disappears after confirm.
3. Visit `/history/<bogus-uuid>/edit`; confirm redirect to `/history`.
4. Toggle locale; confirm all edit/delete/dialog strings translate.
5. Regenerate the plan, then edit an old session; confirm edit still succeeds.

## Performance Considerations

Negligible. Edit fetches one session by indexed PK + user scope; delete is a single
cascade. `router.refresh()` re-runs the existing `listSessions` query (already within the
~1s p95 guardrail). Solo-user list volumes; no pagination needed (FR-022 parked).

## Migration Notes

None — no schema or data migration. The existing `updateSession` replace-all-children
transaction handles the row rewrites; no backfill.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-03, lines 104-114)
- PRD: `context/foundation/prd.md` (US-02 lines 72-81, FR-020 line 113, FR-021 line 115)
- Reused data layer: `src/db/workout-sessions.ts:130-206`
- Reused editor: `src/components/workout/workout-session-editor.tsx`
- Mirrored mapper: `src/lib/workout/map-plan-day-to-form-values.ts`
- Mirrored action: `src/lib/workout/actions.ts` (`saveWorkoutSession`)
- Mirrored dialog: `src/components/workout/discard-dialog.tsx`
- Mirrored flow: `src/components/workout/log-workout-flow.tsx`
- Mirrored page: `src/app/(app)/log-workout/page.tsx`
- Prior slice (history read): `context/archive/2026-06-10-view-workout-history/plan.md`
- Lesson (sync server components / `getTranslations`): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Snapshot→form mapper & i18n strings

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — 2063600
- [x] 1.2 Linting passes: `npm run lint` — 2063600
- [x] 1.3 Mapper unit tests pass: `npm test -- map-session-to-form-values` — 2063600

#### Manual

- [x] 1.4 Every new key exists in both `en.json` and `pl.json` with no placeholder text

### Phase 2: Update & delete server actions

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — 631916e
- [x] 2.2 Linting passes: `npm run lint` — 631916e
- [x] 2.3 Action tests pass: `npm test -- actions` — 631916e

#### Manual

- [ ] 2.4 (After Phase 4) editing a session does not move its date — verified in dev

### Phase 3: Delete-confirm dialog & history-row actions cell

#### Automated

- [x] 3.1 Type checking passes: `npx tsc --noEmit` — 1a425f1
- [x] 3.2 Linting passes: `npm run lint` — 1a425f1
- [x] 3.3 Component tests pass: `npm test -- history` — 1a425f1
- [x] 3.4 Existing `history-list.test.tsx` repaired with `vi.mock("next/navigation")`; prior assertions still pass — 1a425f1

#### Manual

- [ ] 3.5 Each row shows Edit + Delete; Delete confirms, removes row on confirm, no-op on cancel
- [ ] 3.6 PL and EN render translated controls and dialog copy
- [x] 3.7 `HistoryList` still server-rendered (client JS only in the leaf actions cell) — statically confirmed (no `"use client"` in history-list.tsx) during impl-review

### Phase 4: Edit route & flow

#### Automated

- [x] 4.1 Type checking passes: `npx tsc --noEmit`
- [x] 4.2 Linting passes: `npm run lint`
- [x] 4.3 Full test suite passes: `npm test`

#### Manual

- [ ] 4.4 Edit opens the pre-filled editor; saving returns to `/history` with changes shown
- [ ] 4.5 Editing an old session's reps does not move its date/position (preservation)
- [ ] 4.6 Edit works with no active plan and after plan regeneration
- [ ] 4.7 `/history/<random-uuid>/edit` redirects to `/history`
- [ ] 4.8 Discard returns to `/history` (with dirty-confirm dialog when changed)
- [ ] 4.9 PL and EN render the edit page/editor; auth gating still applies
