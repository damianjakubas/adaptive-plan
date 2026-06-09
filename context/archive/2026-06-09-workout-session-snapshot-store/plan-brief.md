# Workout-Session Snapshot Store (Normalized) — Plan Brief

> Full plan: `context/changes/workout-session-snapshot-store/plan.md`

## What & Why

Build the foundation store for logged workouts: a per-account-isolated, **plan-decoupled**
persistence layer (schema + migration + data access) so a saved session holds no live reference to
the active plan, and plan regeneration never alters or orphans history (FR-024). No user-visible
surface — it exists to unblock S-01 (log), S-02 (history), and S-03 (curate).

## Starting Point

Only the `plans` table exists (`src/db/schema.ts:13-25`). Isolation is app-layer `userId` scoping
(RLS off, `src/db/plans.ts`). The plan shape (`plan-schema.ts`) carries `sets: number` + `reps:
string` and **no weight** — less than a logged session needs to record actuals.

## Desired End State

Three normalized tables (`workout_sessions` → `workout_session_exercises` → `workout_session_sets`)
with a migration, a Zod write-contract, and a `userId`-scoped data-access module exposing full CRUD
(`createSession`, `listSessions`, `getSessionById`, `updateSession`, `deleteSession`). Integration
tests prove isolation, newest-first listing, cascade delete, and that a session survives its source
plan's deletion.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage shape | Fully normalized (3 tables) | User chose to invest the foundation for future analytics / AI-adaptation MVPs that want set-level SQL. | Plan |
| Set modeling | `sets[]` array of `{ reps, weight?, note? }` | FR-012 needs per-set actual reps and weight, which the plan's flat shape can't hold. | Plan |
| Data-access surface | Full CRUD now | One cohesive, tested module; S-01/S-02/S-03 wire UI without re-opening `db/`. | Plan |
| Snapshot validation | Typed + Zod-validated on write | The store *is* the durability guarantee — validating before insert makes "no corruption" real and testable. | Plan |
| Plan provenance | Nullable `source_plan_id`, **not** a FK | Keeps cheap provenance while honoring FR-024 — no live reference, no cascade from `plans`. | Plan |
| `reps` storage type | `text` | Lets pre-fill seed the plan's `"8-12"` range strings directly (lossless). | Plan |
| Muscle groups | Derived at read (no column) | Consistent with the normalized choice; `listSessions` aggregates from child exercises. | Plan |

## Scope

**In scope:** three tables + migration; Drizzle relations + internal cascade FKs; Zod write-contract;
`userId`-scoped CRUD data-access module; integration tests for CRUD + isolation + decoupling.

**Out of scope:** any UI / API / server action; pre-fill (plan→snapshot) mapping (S-01); analytics /
aggregation views; AI-adaptation reads; RLS; weight units; i18n.

## Architecture / Approach

`workout_sessions` is the aggregate root carrying `user_id` (the only isolation key) and the
session-level metadata the history list reads. Exercises and sets hang off it via `ON DELETE CASCADE`
FKs — the cascade lives strictly inside the aggregate; **no FK points at `plans`**. Writes are single
transactions across all three tables (atomic, no partial-write window), with Zod validation *before*
the transaction. `listSessions` stays light (joins exercises only, derives muscle groups, skips sets);
`getSessionById` loads the full tree via a Drizzle relational query.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema, relations & migration | Three tables + cascade FKs + index, migrated | Accidentally adding a FK to `plans` (breaks FR-024) |
| 2. Zod write-contract | `workout-session-schema.ts` + inferred types | Contract drifting from what S-01's editor will send |
| 3. Data-access CRUD | `workout-sessions.ts`, `userId`-scoped, transactional | Missing `userId` scope on a read/write path (isolation leak) |
| 4. Integration tests | CRUD + isolation + cascade + decoupling proofs | DB-dependent; skips without `DATABASE_URL` |

**Prerequisites:** Drizzle + Supabase Postgres already wired; `DIRECT_URL` set to apply the migration
and `DATABASE_URL` to run integration tests locally.
**Estimated effort:** ~1–2 sessions across 4 phases (small, convention-driven).

## Open Risks & Assumptions

- Normalization tempts a `source_plan_id → plans.id` FK; the plan forbids it and Phase 4 has a test
  that fails if it's ever added.
- The set-level analytics that justify normalization are explicit Non-Goals this iteration — the
  shape is an investment whose payoff is deferred.
- Integration tests require a reachable dev DB; they skip (not fail) without one, so the integration
  gate is ad-hoc, not per-commit.

## Success Criteria (Summary)

- A logged session can be created, listed newest-first, fetched whole, updated, and deleted — all
  strictly scoped to its owner.
- A saved session survives deletion/replacement of its source plan with its full exercise/set tree
  intact (FR-024).
- Malformed session input is rejected before any row is written.
