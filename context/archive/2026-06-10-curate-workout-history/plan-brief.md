# Curate Workout History (S-03) — Plan Brief

> Full plan: `context/changes/curate-workout-history/plan.md`

## What & Why

The closed loop (generate → log → review) has no way to fix or remove a logged session — a
mistaken or duplicate log degrades history permanently. This slice adds **edit** (reopen a
saved session in the logging editor and save changes) and **delete** (permanent, behind a
confirmation) to the history page, satisfying FR-020 and FR-021 and closing Stream A.

## Starting Point

The hard parts are already built. `src/db/workout-sessions.ts` exports the full
owner-scoped CRUD — `getSessionById`, `updateSession`, `deleteSession` — all
integration-tested in F-01. The `WorkoutSessionEditor` was written by S-01 to be reused
here (it "never knows whether the data came from a plan day or a saved snapshot"). The
`/history` list (S-02) is a sync server component with read-only rows and no actions. Every
new piece has a built twin to mirror (mapper, action, dialog, flow, page).

## Desired End State

Each history row has Edit and Delete controls. Edit opens `/history/[id]/edit`, loading the
saved session into the full-screen editor pre-filled; saving preserves the original date and
returns to `/history`. Delete asks to confirm, then permanently removes the session and
refreshes the list. Editing works even with no active plan / after plan regeneration. A
stale edit URL bounces to `/history`. Fully PL/EN.

## Key Decisions Made

| Decision              | Choice                                                  | Why (1 sentence)                                                                | Source |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| Edit surface          | Dedicated route `/history/[id]/edit`                    | Mirrors the `/log-workout` page anatomy; full-screen editor; proxy auto-protects it. | Plan   |
| Row actions           | `"use client"` leaf cell (edit link + delete trigger)   | Keeps `HistoryList` a sync server component (CLAUDE.md rule 10 / view-history lesson). | Plan   |
| Edit semantics        | Preserve original `performedAt` + `sourcePlanId`        | Editing reps must not reorder history; honors the snapshot rule (FR-024).        | Plan   |
| Active-plan gate      | None on edit (unlike save)                              | FR-020 requires edit to work after the plan changed/was removed.                 | PRD    |
| Post-delete           | `router.refresh()` after the action                     | Server stays the single source of truth; no client list-state to drift.          | Plan   |
| Missing/foreign edit  | Server `redirect("/history")` on `getSessionById` null  | Graceful; no probe surface for stale/forged ids.                                 | Plan   |
| Test depth            | Unit mapper + hermetic actions + RTL dialog/row         | Cheapest layer covering every new decision; DB CRUD already integration-tested.  | Plan   |

## Scope

**In scope:** `mapSessionToFormValues` mapper; `updateWorkoutSession` + `deleteWorkoutSession`
actions (`{ ok, code }`); `DeleteConfirmDialog`; `HistoryRowActions` client leaf wired into
`HistoryList`; `/history/[id]/edit` RSC page + `EditWorkoutFlow`; new PL/EN strings;
unit + hermetic + RTL tests.

**Out of scope:** schema/migration/DB functions (exist), editable date/backfill field,
undo/trash/recovery, search/filter (FR-019 dropped), pagination (FR-022 parked), analytics
(Non-Goal), e2e tests (Lesson 4), any change to save/picker/`/log-workout`.

## Architecture / Approach

Bottom-up: pure mapper + i18n → server actions → delete UI on the existing list → edit
route + flow. The update action is the only new behavior — it reads the original session for
`performedAt`/`sourcePlanId`, merges them onto the editor's form values, validates with the
existing write schema, and calls `updateSession`; the editor never sees those fields. The
edit page mirrors `/log-workout` (auth gate → fetch → flow); the flow is a picker-less
`LogWorkoutFlow`. Delete is an inline dialog + action + `router.refresh()`.

## Phases at a Glance

| Phase                              | What it delivers                                          | Key risk                                                      |
| ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Mapper & i18n                   | `mapSessionToFormValues` + PL/EN strings; unit tests      | Form-input shape mismatch (duration string, null coercions)   |
| 2. Update & delete actions         | Two `{ ok, code }` actions; hermetic tests                | Preserving `performedAt`/`sourcePlanId` (not re-stamping)     |
| 3. Delete dialog & row actions     | `DeleteConfirmDialog` + client leaf cell; RTL tests       | Adding interactivity without making the list a client tree    |
| 4. Edit route & flow               | `/history/[id]/edit` + `EditWorkoutFlow`; manual verify   | Next.js 16 async `params`; discard/redirect routing           |

**Prerequisites:** S-01 + S-02 shipped (both archived); local DB with logged sessions for manual verification.
**Estimated effort:** ~1 session across 4 phases; Phase 3 is the largest (new client boundary).

## Open Risks & Assumptions

- The update action must source date + provenance from the original session; a regression
  here silently reorders history — pinned by the Phase 2 preservation test.
- Adding an actions column to `HistoryList` must not disturb the existing date/session/
  duration grid or the view-history component tests.
- Next.js 16 dynamic `params` are async — confirm the awaited-params API before coding the
  edit page (AGENTS.md routing warning).

## Success Criteria (Summary)

- A user can reopen any logged session in the editor, edit it, and save — with the session's
  date unchanged and working regardless of active-plan state (US-02 / FR-020).
- A user can permanently delete a session only after confirming; the list refreshes without
  it (FR-021).
- All new UI renders in PL and EN; existing auth/plan/navbar/history-read behavior unchanged.
