# View Workout History (S-02) — Plan Brief

> Full plan: `context/changes/view-workout-history/plan.md`

## What & Why

The closed loop (generate plan → perform → log → review) is missing its last step:
sessions saved by S-01 are write-only today. This slice builds the history page — a
read-only, newest-first list of logged sessions — making logging worth doing and giving
S-03 (edit/delete) a surface to hang its actions on.

## Starting Point

The data layer needs zero work: `listSessions` (F-01, integration-tested) already returns
the exact list DTO — newest-first, user-scoped, muscle groups derived, sets never loaded.
S-01 writes sessions with server-stamped dates. The navbar carries a disabled "Progress"
placeholder reserved for this slice, and an approved mockup
(`historia_trening_w`) exists using the project's own design tokens.

## Desired End State

A "History" navbar entry (PL: "Historia") leads to `/history`, where the user sees each
logged session as a row: relative day label ("Today"/"Yesterday"/weekday) over the
absolute date, session name with a type badge, target muscle groups, and a compact
duration ("1h 15m"). No sessions yet → an empty state that points to logging (or to plan
generation when no plan exists). Fully PL/EN.

## Key Decisions Made

| Decision        | Choice                                              | Why (1 sentence)                                                                 | Source |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| Route & label   | `/history` + "History"/"Historia" (replaces "Progress") | Honest naming — analytics/progress charts are an explicit PRD Non-Goal.           | Plan   |
| Mockup fidelity | Row-grid layout minus search/filter/actions/load-more | Those controls map to dropped FR-019, parked FR-022, and S-03 — no dead UI shipped. | Plan   |
| Date & duration | Relative day label + locale date; compact "1h 15m"  | Matches the mockup; helper takes `now` as a parameter so boundaries are testable.  | Plan   |
| Empty state     | Plan-state-aware CTA (log-workout vs plan-new)      | `/log-workout` is gated without a plan — a static CTA would dead-end new users.    | Plan   |
| Rendering model | Fully server-rendered; sync presentational components | Nothing is interactive; sync components with `useTranslations` stay RTL-testable.  | Plan   |
| Test depth      | Helper unit tests + RTL component tests             | `listSessions` is already integration-tested (F-01); cheapest layer covers all new logic. | Plan   |

## Scope

**In scope:** `/history` RSC page, `HistoryList` + `HistoryEmptyState` presentational
components, `format-duration` + `relative-day` helpers, `History`/`Nav.history` PL+EN
strings, navbar swap (Progress → History), unit + component tests.

**Out of scope:** edit/delete (S-03), search/filter (FR-019 dropped), pagination (FR-022
parked), analytics/charts (Non-Goal), any data-layer or proxy change, loading skeletons.

## Architecture / Approach

Mirror the `/log-workout` page anatomy: RSC gates auth → `listSessions(user.id)` → empty
branch (with an id-only `hasActivePlan` check, empty path only) or header + list. The
list is a sync server component taking `sessions` + `now`, using `useTranslations`/
`useFormatter` without a client boundary. Pure calendar/duration math lives in
`src/lib/history/` helpers. `/history` is auto-protected by the deny-by-default proxy.

## Phases at a Glance

| Phase                            | What it delivers                                      | Key risk                                                            |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| 1. Formatting helpers & i18n     | `format-duration`, `relative-day` + tests; all strings | Calendar-boundary edge cases (day cutoffs, future timestamps)        |
| 2. List & empty-state components | `HistoryList`, `HistoryEmptyState` + RTL tests        | Keeping components sync (no async, no `"use client"`) for testability |
| 3. Route & navbar wiring         | `/history` page; Progress → History swap              | Removing `Nav.progress` key and its span in lockstep                  |

**Prerequisites:** F-01 + S-01 shipped (both archived); local DB with logged sessions for manual verification.
**Estimated effort:** ~1 session across 3 phases; Phase 2 is the largest.

## Open Risks & Assumptions

- Relative "today" is computed on the server's calendar (Vercel = UTC) — a late-evening
  workout may label as "Yesterday" for a PL user. Accepted for solo-first scale; noted in
  the plan as a deliberate non-goal (no timezone library).
- The type badge shows `sessionType` = plan day name (S-01's mapping), not the mockup's
  "STRENGTH"/"CARDIO" sample data — visual reviewers shouldn't expect category labels.
- Full-list rendering assumes solo-user volumes; FR-022 (load more) unparks only if
  history volume warrants it.

## Success Criteria (Summary)

- A user with logged sessions sees them newest-first on `/history` with date, name/type,
  muscle groups, and duration (US-02 / FR-018 acceptance).
- Empty-history users always get a live CTA (never a dead-end into the gated logging page).
- All strings render in PL and EN (FR-025); existing navbar controls and auth gating
  behave unchanged.
