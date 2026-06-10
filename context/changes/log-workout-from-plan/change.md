---
change_id: log-workout-from-plan
title: "Log a workout from the active plan"
status: impl_reviewed
created: 2026-06-09
updated: 2026-06-10
---

## Notes

Roadmap slice **S-01** — the north star (from `context/foundation/roadmap.md`).

- **Outcome:** user can open the logging page pre-filled from their active plan (picking
  which day/session they performed), edit actual reps/weight, add or remove sets and
  exercises, enter a duration and a free-text note, and save it as a snapshot — or discard
  without a partial write. The logging entry point is disabled when no active plan exists.
- **PRD refs:** US-01, FR-011 (pick day + pre-fill), FR-012 (edit reps/weight, add/remove
  sets), FR-014 (add/remove exercises), FR-015 (note), FR-016 (save with manual duration /
  discard), FR-017 (gated when no active plan), FR-025 (locale parity).
- **Prerequisites:** F-01 (done — store + CRUD shipped).
- **Unlocks:** S-02 (history reads what this writes), S-03 (reuses this editor), S-04
  (dashboard "log a workout" CTA targets this route).

## Key decisions

- **Shared editor, two entry routes** — a presentational `WorkoutSessionEditor` consumes a
  normalized form shape + `onSave` callback; S-01 maps plan-day → form values, S-03 will map
  snapshot → the same shape. The editor never knows where its data came from.
- **Day picker is a step on `/log-workout`** (selectable non-rest-day cards), keeping the
  route self-contained for navbar and future dashboard links.
- **Field mapping:** `sessionName` ← plan day's `focus`, `sessionType` ← plan day's `day`.
- **`performedAt` = save time**, no date field in the UI.
- **Discard** navigates to `/plan` behind a confirm dialog when the form is dirty.
- **Tests:** unit logic + contracts (mapper, server action, editor field arrays); no page
  e2e this slice.
