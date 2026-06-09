---
change_id: workout-session-snapshot-store
title: "Workout-session snapshot store (normalized)"
status: implemented
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

Roadmap foundation **F-01** (from `context/foundation/roadmap.md`).

- **Outcome:** (foundation) a per-account-isolated, plan-decoupled persistence store for
  logged workout sessions exists — schema, migration, and `user_id`-scoped data access —
  ready for logging to write and history to read. No user-visible surface on its own.
- **PRD refs:** FR-024 (snapshot decoupling / durability), Business Logic rule 2 (snapshot
  rule), Access Control Changes (per-account isolation).
- **Unlocks:** S-01 (log-workout-from-plan — writes a session), S-02 (view-workout-history —
  reads the list), S-03 (curate-workout-history — get/update/delete).

## Key decision

The roadmap's single open Unknown (normalized tables vs single JSONB snapshot) was resolved
in planning as **fully normalized** (session → exercise → set), chosen deliberately to
invest the foundation for future MVPs (planned-vs-actual analytics, AI plan adaptation) that
want set-level SQL. The snapshot stays plan-decoupled via a nullable, non-FK `source_plan_id`
(internal FKs cascade among the three tables; no FK ever points at `plans`).
