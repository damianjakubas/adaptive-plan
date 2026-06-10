---
change_id: view-workout-history
title: "View workout history"
status: archived
archived_at: 2026-06-10T08:13:52Z
created: 2026-06-10
updated: 2026-06-10
---

## Notes

Roadmap slice **S-02** (from `context/foundation/roadmap.md`).

- **Outcome:** user can view a list of their past logged sessions, newest first, each
  showing date, session name/type, target muscle groups, and duration.
- **PRD refs:** US-02, FR-018 (history list), FR-025 (locale parity).
- **Prerequisites:** F-01 (done — store + `listSessions`), S-01 (done — sessions get written).
- **Unlocks:** S-03 (edit/delete actions hang off this list).

## Key decisions

- **Route `/history`, navbar label "History"/"Historia"** — replaces the disabled
  "Progress" placeholder (`Nav.progress` key retired); honest naming since analytics are
  a PRD Non-Goal.
- **Mockup layout minus out-of-scope controls** — keep the `historia_trening_w` row grid
  (date / session / duration); omit search + filter (FR-019 dropped), edit/delete icons
  (S-03), and load-more (FR-022 parked). No disabled stubs.
- **Date column:** relative day label (Today / Yesterday / weekday within 7 days) over a
  locale-formatted absolute date; duration rendered compact ("1h 15m").
- **Empty state is plan-state-aware** — active plan → CTA to `/log-workout`; no plan →
  CTA to `/plan/new` (avoids a dead-end CTA into the gated logging page).
- **Fully server-rendered** — no `"use client"`; the list is a sync presentational
  component (RTL-testable via `NextIntlClientProvider`).
- **Tests:** unit tests for formatting helpers + one RTL component suite; `listSessions`
  behavior already integration-tested in F-01.
