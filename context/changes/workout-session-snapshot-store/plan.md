# Workout-Session Snapshot Store (Normalized) — Implementation Plan

## Overview

Build the foundation slice **F-01**: a per-account-isolated, plan-decoupled persistence store
for logged workout sessions. It consists of three normalized tables (`workout_sessions` →
`workout_session_exercises` → `workout_session_sets`), a Drizzle migration, a Zod write-contract,
a `userId`-scoped data-access module exposing full CRUD, and integration tests that prove the
two load-bearing invariants: **per-account isolation** and **plan-decoupled durability**
(a saved session survives plan regeneration/deletion untouched).

This slice has **no user-visible surface**. It exists so that S-01 can write a saved session,
S-02 can read the list back, and S-03 can get/update/delete.

## Current State Analysis

- **Only the `plans` table exists** (`src/db/schema.ts:13-25`). The workout-session store is absent.
- **Per-account isolation is app-layer**: RLS is off; every query filters by `userId`
  (`src/db/plans.ts:11-18`). This is the only isolation mechanism and must be replicated.
- **DB conventions are fixed and easy to mirror** (`src/db/schema.ts`, `src/db/plans.ts`):
  - snake_case DB columns, camelCase TS; types via `$inferInsert` / `$inferSelect`.
  - index naming `{table}_{cols}_idx` (e.g. `plans_user_active_idx`).
  - multi-step writes wrapped in `db.transaction(async (tx) => …)`.
  - data-access functions + types exported in a single barrel block at end of file.
- **The plan shape** (`src/lib/validation/plan-schema.ts`) is the pre-fill source for S-01:
  `weeklySchedule[]` of `{ day, focus, isRest, exercises?[] }`; an exercise is
  `{ name, muscleGroup?, sets: number, reps: string, note? }`. There is **no first-class
  "session" object** — a session is one non-rest day's exercises. Critically, the plan has
  `sets: number` + `reps: string` at the exercise level and **no weight**, while FR-012 requires
  per-set actual reps and weight — so the snapshot's exercise/set shape is necessarily richer.
- **Validation pattern** (`src/app/api/plan/generate/route.ts:54-91`): inputs are Zod-validated
  (`planInputSchema.safeParse`) before any persist; the generated output is re-validated
  (`planOutputSchema.safeParse`) before `saveActivePlan`. The new store mirrors this — `createSession`/
  `updateSession` validate their input contract before the transactional write.
- **DB client** (`src/db/index.ts`): lazily-initialized Drizzle Proxy over the Supabase
  transaction pooler (`DATABASE_URL`, `prepare: false`); migrations use `DIRECT_URL`
  (`drizzle.config.ts`). The `db` Proxy supports `db.transaction` and `db.query`.
- **Test pattern** (`src/tests/db/plans.test.ts`): Vitest, `describe.skipIf(!hasDb)`, env loaded via
  `loadEnv("development", …)`, per-test `crypto.randomUUID()` `userId`, `afterEach` deletes that
  user's rows. Real-DB integration tests; skip cleanly when `DATABASE_URL` is unset.

### Key Discoveries:

- **No weight, no per-set granularity in the plan** (`src/lib/validation/plan-schema.ts:28-35`) —
  the snapshot must add a `sets[]` array of `{ reps, weight?, note? }` per exercise. Pre-fill (S-01)
  expands the plan's `sets: number` into N seeded set rows and seeds each `reps` from the plan's
  `reps` string (hence `reps` is stored as **text**, not integer — a `"8-12"` range seeds directly).
- **Isolation = `user_id` on the aggregate root only** (`src/db/plans.ts:11-18`). Children
  (`exercises`, `sets`) are reached via the session; all reads/writes scope by joining/filtering
  on `workout_sessions.user_id`.
- **The decoupling invariant is a no-FK rule** (FR-024 / Business Logic rule 2): internal FKs link
  the three tables with `ON DELETE CASCADE`, but **no FK points at `plans`**. `source_plan_id` is a
  plain nullable `uuid` (advisory provenance only).

## Desired End State

After this plan:

- Three migrated tables exist with internal cascade FKs and a `(user_id, performed_at desc)` index.
- `src/lib/validation/workout-session-schema.ts` exports a Zod write-contract for a logged session
  (nested exercises → sets) and inferred types.
- `src/db/workout-sessions.ts` exports `createSession`, `listSessions`, `getSessionById`,
  `updateSession`, `deleteSession` — all `userId`-scoped, transactional where multi-table.
- Integration tests prove CRUD, per-account isolation, newest-first ordering, cascade delete, the
  FR-024 decoupling/durability invariant, and Zod rejection of malformed input.

**Verification**: `npm run db:generate` produces one new migration; `npx tsc --noEmit` and
`npm run lint` pass; `npm test` passes (DB tests skip without `DATABASE_URL`, run green with it).

## What We're NOT Doing

- **No UI, no API route, no server action** — this is data layer only. S-01/S-02/S-03 own surfaces.
- **No auth / route-gating changes** — S-05 owns the post-auth redirect.
- **No pre-fill / plan-to-snapshot mapping logic** — that transformation belongs to S-01 (this slice
  only defines the contract it will write into).
- **No analytics, aggregation views, or AI-adaptation reads** — explicit PRD Non-Goals; the
  normalized shape merely *enables* them later.
- **No denormalized `muscle_groups` column** — target muscle groups are derived from child exercises
  at read time, consistent with the normalized choice.
- **No RLS / database-level policies** — isolation stays app-layer (`userId` scoping), matching `plans`.
- **No weight-unit modeling** — a single implicit unit; `weight` is a nullable number.
- **No i18n work** — FR-025 (locale parity) applies to the user-facing slices, not this foundation.

## Implementation Approach

Mirror the existing `plans` table + `plans.ts` conventions exactly, extended to a three-table
aggregate. The `workout_sessions` row is the aggregate root carrying `user_id` (the isolation key)
and the session-level metadata the history list reads (`performed_at`, `session_name`,
`session_type`, `duration_minutes`, `note`). Exercises and sets hang off it via cascade FKs.

Writes (`createSession`, `updateSession`) are **single transactions** spanning all three tables, so
a logged session is atomic — there is no partial-write window. Inputs are Zod-validated *before* the
transaction opens, so malformed data never reaches the DB (matching the plan-generation pattern).
`updateSession` uses **replace-all** semantics (delete child exercises — cascade clears sets — then
re-insert from the validated input) because the S-03 editor loads and saves the whole tree; diffing
would add complexity for no behavioral gain.

Note on CRUD scope: `getSessionById`/`updateSession`/`deleteSession` serve S-03 (curate), which is
not built in this slice — F-01's own unblock targets need only `createSession` (S-01) and
`listSessions` (S-02). Building them now is a deliberate choice (one cohesive, tested module), but it
means **Phase 4's integration tests are the load-bearing spec** for update/delete — no real UI shakes
them out first. The replace-all contract in particular must be pinned firmly there, since a mismatch
with S-03's editor wouldn't otherwise surface until S-03 is implemented.

Reads split by need: `listSessions` (S-02) joins exercises only to aggregate muscle groups and never
loads sets — keeping the list query light for the ~1s p95 guardrail; `getSessionById` (S-03 editor)
loads the full nested tree via Drizzle relational query (`with: { exercises: { with: { sets } } }`).

## Critical Implementation Details

- **Decoupling discipline** — normalization tempts a FK from `workout_sessions.source_plan_id` to
  `plans.id`. Do **not** add it. `source_plan_id` is a plain nullable `uuid` with no reference and no
  cascade; this is what keeps FR-024 true (plan replacement/deletion can never touch history). Phase 4
  has a dedicated test that fails if this rule is ever violated.
- **`reps` is `text`, not `integer`** — the plan's prescribed reps is a string (`"8-12"`), so seeding
  an actual set from the plan is lossless only if `reps` accepts strings. Actuals like `"8"` are also
  valid text. `weight` is a nullable `real` (bodyweight exercises and not-yet-entered weights are null);
  `real` is chosen over `numeric` so the column round-trips as a TS `number`, matching the Zod contract.
- **`position` columns** — `workout_session_exercises.position` and `workout_session_sets.position`
  preserve order (the plan's exercise/set order is meaningful and must round-trip). Reads order by it.
- **Cascade on internal FKs only** — deleting a session cascades to its exercises and their sets, which
  is what makes `deleteSession` a single scoped delete. The cascade lives strictly inside the aggregate.

## Phase 1: Schema, Relations & Migration

### Overview

Add the three tables, their Drizzle relations, and cascade FKs to `schema.ts`; generate and apply the
migration; export inferred row types.

### Changes Required:

#### 1. Schema definition

**File**: `src/db/schema.ts`

**Intent**: Add `workoutSessions`, `workoutSessionExercises`, `workoutSessionSets` tables plus the
Drizzle `relations()` wiring so `getSessionById` can load the nested tree. Follow the existing `plans`
conventions (snake_case columns, `$inferInsert`/`$inferSelect` exports, `{table}_{cols}_idx` index).

**Contract**:
- `workout_sessions`: `id` uuid pk default random · `user_id` uuid not null · `source_plan_id` uuid
  **nullable, no FK/reference** · `performed_at` timestamptz not null · `session_name` text not null ·
  `session_type` text **nullable** · `duration_minutes` integer not null · `note` text nullable ·
  `created_at` timestamptz not null default now(). Index `workout_sessions_user_performed_idx` on
  `(user_id, performed_at desc)`.
- `workout_session_exercises`: `id` uuid pk · `session_id` uuid not null **FK → workout_sessions.id,
  onDelete: "cascade"** · `position` integer not null · `name` text not null · `muscle_group` text
  nullable · `note` text nullable. Index on `(session_id)`.
- `workout_session_sets`: `id` uuid pk · `exercise_id` uuid not null **FK →
  workout_session_exercises.id, onDelete: "cascade"** · `position` integer not null · `reps` text not
  null · `weight` **`real()` nullable** (Drizzle `real` → TS `number`, matching the Zod
  `weight?: number` contract; do **not** use `numeric` — it maps to a TS `string` on both insert and
  `$inferSelect`, breaking the contract) · `note` text nullable. Index on `(exercise_id)`.
- `relations()`: session → many exercises; exercise → (one session, many sets); set → one exercise.
- Exported types: `WorkoutSession`/`NewWorkoutSession`, `WorkoutSessionExercise`/`New…`,
  `WorkoutSessionSet`/`New…` via `$inferSelect`/`$inferInsert`.

#### 2. Generated migration

**File**: `src/db/migrations/0001_*.sql` (+ `meta` snapshot) — produced by `npm run db:generate`.

**Intent**: Create the three tables, FKs with cascade, and the index. Do not hand-edit; generate, then
review that the SQL matches the contract above (cascade present, no FK to `plans`).

### Success Criteria:

#### Automated Verification:

- [ ] Migration generates: `npm run db:generate` creates exactly one new `00xx_*.sql` + updated `meta`.
- [ ] Generated SQL has internal cascade FKs and **no** foreign key referencing `plans`.
- [ ] Type-check passes: `npx tsc --noEmit`.
- [ ] Lint passes: `npm run lint`.
- [ ] Migration applies cleanly against the dev DB: `npm run db:migrate` (requires `DIRECT_URL`).

#### Manual Verification:

- [ ] In the DB, the three tables exist with the expected columns/types; deleting a `workout_sessions`
      row cascades to its exercises and sets.

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual
DB inspection before Phase 2.

---

## Phase 2: Zod Write-Contract

### Overview

Define the Zod schema describing a logged session as written by S-01/S-03, plus inferred types,
mirroring the structure and file location of `plan-schema.ts`.

### Changes Required:

#### 1. Workout-session schema

**File**: `src/lib/validation/workout-session-schema.ts`

**Intent**: Provide the single source of truth for a logged session's *write* shape — the nested
input that `createSession`/`updateSession` validate before persisting. Mirror `plan-schema.ts` style
(named exported schema, inferred types at the bottom).

**Contract**: `workoutSessionInputSchema` = object:
- `sourcePlanId` uuid **optional/nullable**
- `performedAt` — a date/ISO datetime (coerced/validated)
- `sessionName` string (non-empty)
- `sessionType` string **optional**
- `durationMinutes` integer ≥ 0
- `note` string optional
- `exercises`: **non-empty** array (`.min(1)`) of `{ name: string, muscleGroup?: string, note?: string,
  sets: Array<{ reps: string, weight?: number, note?: string }> }` where each `sets` is also
  **non-empty** (`.min(1)`). A logged session must have at least one exercise, and an exercise at least
  one set (FR-012 / roadmap session definition); empty drafts are out of scope for this slice.

Exported: `workoutSessionInputSchema`, `type WorkoutSessionInput = z.infer<…>` (and any nested
`ExerciseInput`/`SetInput` types worth reusing). The DB-row read type stays in `schema.ts` (inferred);
this file owns the *write/validation* contract only.

### Success Criteria:

#### Automated Verification:

- [ ] Type-check passes: `npx tsc --noEmit`.
- [ ] Lint passes: `npm run lint`.
- [ ] Unit tests for the schema pass: valid nested session parses; missing `sessionName`, negative
      `durationMinutes`, a set without `reps`, an empty `exercises` array, and an exercise with an empty
      `sets` array are all rejected (`npm test`).

#### Manual Verification:

- [ ] None (pure validation logic, fully covered by the unit tests above).

---

## Phase 3: Data-Access CRUD

### Overview

Implement the `userId`-scoped data-access module exposing full CRUD over the aggregate, transactional
for multi-table writes, Zod-validated on create/update.

### Changes Required:

#### 1. Data-access module

**File**: `src/db/workout-sessions.ts`

**Intent**: Mirror `src/db/plans.ts` (barrel export, `userId` scoping, `db.transaction` for multi-step
writes) to provide every operation S-01/S-02/S-03 need against the three-table aggregate.

**Contract** — all functions scope by `userId` on `workout_sessions`:
- `createSession(input)` — validate `input` against `workoutSessionInputSchema`; in one transaction
  insert the session row (with `userId`, `sourcePlanId`), then its exercises (with `position`), then
  each exercise's sets (with `position`). Returns **the new session id** (string); a caller needing the
  full tree re-fetches via `getSessionById`. Input carries `userId`.
- `listSessions(userId)` — sessions newest-first by `performed_at`, scoped by `userId`; returns a
  list DTO with session metadata + **derived** `muscleGroups` (aggregated from child exercises via a
  join); **does not load sets**. `muscleGroups` is the set of **distinct, non-null** `muscle_group`
  values across the session's exercises, in a **stable order** (exercise `position`).
- `getSessionById(userId, sessionId)` — full nested tree via relational query, scoped by `userId`;
  returns `null` if not owned/found. The relational query **must** order each nested collection
  explicitly — `with: { exercises: { orderBy: position, with: { sets: { orderBy: position } } } }` —
  because Drizzle does not order nested relations by default (without this the `position`-order
  round-trip is undefined and the Phase 4 ordering assertion flakes).
- `updateSession(userId, sessionId, input)` — validate input; in one transaction verify ownership
  (scoped), update session metadata, **replace-all** children (delete exercises → cascade clears sets,
  re-insert from input). No-op/`null` if the session isn't owned by `userId`.
- `deleteSession(userId, sessionId)` — single delete `where id = sessionId AND user_id = userId`;
  cascade removes children. Returns whether a row was deleted.
- Export functions + the input interface(s) in a single barrel block (per convention).

### Success Criteria:

#### Automated Verification:

- [ ] Type-check passes: `npx tsc --noEmit`.
- [ ] Lint passes: `npm run lint`.

#### Manual Verification:

- [ ] None at this phase — behavior is exercised by Phase 4's integration tests.

---

## Phase 4: Integration Tests

### Overview

Real-DB integration tests proving CRUD correctness and the two load-bearing invariants (isolation,
decoupled durability), following the `plans.test.ts` skip/cleanup pattern.

### Changes Required:

#### 1. Integration test suite

**File**: `src/tests/db/workout-sessions.test.ts`

**Intent**: Assert behavior against a real DB; skip when `DATABASE_URL` is unset; isolate via per-test
`crypto.randomUUID()` `userId` and `afterEach` cleanup (cascade clears children when the session is
deleted). Oracle is the PRD/roadmap, not the implementation.

**Contract** — cover at minimum:
- **create + read round-trip**: `createSession` then `getSessionById` returns the full tree with
  exercises/sets in `position` order, metadata intact.
- **per-account isolation**: user B's `getSessionById`/`updateSession`/`deleteSession` on user A's
  session returns null / deletes nothing; `listSessions(B)` never shows A's sessions.
- **newest-first ordering**: `listSessions` orders by `performed_at` desc; derived `muscleGroups`
  reflects the session's exercises.
- **cascade delete**: `deleteSession` removes the session and its exercises + sets (no orphans).
- **FR-024 decoupling/durability** (the load-bearing test): insert a `plans` row, `createSession`
  with `sourcePlanId` = that plan's id, then delete/replace the plan — the session and its full tree
  remain intact and readable (proves no FK/cascade from `plans`).
- **Zod rejection**: `createSession` with malformed input (missing `sessionName` / negative duration /
  set without `reps` / **empty `exercises` array** / an exercise with an **empty `sets` array**)
  throws/rejects and writes **no** partial rows (validation precedes the transaction).

### Success Criteria:

#### Automated Verification:

- [ ] `npm test` passes; the suite runs green with `DATABASE_URL`/`DIRECT_URL` set and skips cleanly
      without them.
- [ ] Type-check passes: `npx tsc --noEmit`.
- [ ] Lint passes: `npm run lint`.

#### Manual Verification:

- [ ] Run the suite once locally against the real dev DB and confirm all assertions pass (the
      integration gate is ad-hoc per the project's testing strategy, not a per-commit CI gate).

**Implementation Note**: After this phase, the foundation is complete and S-01 is unblocked.

---

## Testing Strategy

### Unit Tests:

- `workout-session-schema.ts`: valid nested session parses; each required-field violation
  (missing `sessionName`, negative `durationMinutes`, set without `reps`) is rejected. (Phase 2.)

### Integration Tests:

- Full CRUD, per-account isolation, newest-first ordering, cascade delete, FR-024 decoupling, and
  Zod-before-write rejection — against a real DB. (Phase 4.)

### Manual Testing Steps:

1. Apply the migration to the dev DB; confirm the three tables and the cascade exist.
2. (Optional) Insert a session via a REPL/script and confirm `getSessionById` returns the tree.

## Performance Considerations

`listSessions` deliberately avoids loading sets and aggregates muscle groups via a single exercises
join, keeping the history list query light against the PRD's ~1s p95 guardrail. The
`(user_id, performed_at desc)` index serves the newest-first read directly.

## Migration Notes

Additive only — three new tables, no change to `plans` or existing data. `npm run db:generate` then
`npm run db:migrate` (the latter needs `DIRECT_URL`). The change can be withdrawn by dropping the three
tables without touching plan/account data.

## References

- Roadmap foundation: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd.md` (FR-024, Business Logic rule 2, Access Control Changes)
- Existing table + data-access pattern to mirror: `src/db/schema.ts:13-25`, `src/db/plans.ts`
- Plan/pre-fill source shape: `src/lib/validation/plan-schema.ts:28-72`
- Validation-before-persist pattern: `src/app/api/plan/generate/route.ts:54-91`
- Test pattern to mirror: `src/tests/db/plans.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema, Relations & Migration

#### Automated

- [x] 1.1 Migration generates: one new `00xx_*.sql` + updated `meta` via `npm run db:generate` — e3429ff
- [x] 1.2 Generated SQL has internal cascade FKs and no foreign key referencing `plans` — e3429ff
- [x] 1.3 Type-check passes: `npx tsc --noEmit` — e3429ff
- [x] 1.4 Lint passes: `npm run lint` — e3429ff
- [x] 1.5 Migration applies cleanly: `npm run db:migrate` — e3429ff

#### Manual

- [x] 1.6 Tables exist with expected columns; deleting a session cascades to exercises and sets — e3429ff

### Phase 2: Zod Write-Contract

#### Automated

- [x] 2.1 Type-check passes: `npx tsc --noEmit` — bbfa952
- [x] 2.2 Lint passes: `npm run lint` — bbfa952
- [x] 2.3 Schema unit tests pass: valid parses; missing `sessionName` / negative duration / set without `reps` / empty `exercises` / empty `sets` rejected — bbfa952

### Phase 3: Data-Access CRUD

#### Automated

- [x] 3.1 Type-check passes: `npx tsc --noEmit`
- [x] 3.2 Lint passes: `npm run lint`

### Phase 4: Integration Tests

#### Automated

- [ ] 4.1 `npm test` passes (green with DB env, skips cleanly without it)
- [ ] 4.2 Type-check passes: `npx tsc --noEmit`
- [ ] 4.3 Lint passes: `npm run lint`

#### Manual

- [ ] 4.4 Suite run locally against the real dev DB; all assertions pass
