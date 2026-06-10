---
change_id: curate-workout-history
title: "Edit & delete sessions from workout history"
status: implemented
created: 2026-06-10
updated: 2026-06-10
---

## Notes

Roadmap slice **S-03** (from `context/foundation/roadmap.md`).

- **Outcome:** user can reopen any logged session from history in the logging editor and
  save changes (works even after the active plan has changed — the log is a standalone
  snapshot), and can permanently delete a session behind a confirmation step.
- **PRD refs:** US-02, FR-020 (edit reopens the logging editor on saved data),
  FR-021 (permanent delete behind confirmation), FR-025 (locale parity).
- **Prerequisites:** S-01 (done — shared editor + actions pattern), S-02 (done — history list).
- **Unlocks:** — (closes Stream A, the closed-loop path).

## Key decisions

- **Edit surface:** dedicated route `/history/[id]/edit` — mirrors the `/log-workout`
  page anatomy (auth gate → fetch → flow component); editor stays full-screen.
- **Row actions:** a `"use client"` per-row actions cell (edit link + delete trigger)
  pushed as far down the tree as possible; `HistoryList` stays a sync server component.
- **Edit semantics:** update preserves the original `performedAt` and `sourcePlanId`
  (server-side, never from client) — editing reps never reorders history; honors the
  snapshot rule (FR-024). Edit is **not** gated on an active plan (FR-020).
- **Post-delete:** server action returns `{ ok }`, client calls `router.refresh()` —
  single server source of truth, no client list-state to drift.
- **Missing/foreign session on edit route:** server-side `redirect("/history")`
  (graceful, no probe surface).
- **Tests:** unit mapper + hermetic `{ ok, code }` action tests (update & delete) +
  RTL for the delete-confirm dialog and row actions cell. Data-layer CRUD already
  integration-tested in F-01.
