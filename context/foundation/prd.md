---
project: "AdaptivePlan"
version: 1
status: draft
created: 2026-06-09
context_type: brownfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 6
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

AdaptivePlan is a shipped MVP: a personalized fitness training plan generator. A user supplies body stats, lifestyle context, health constraints, equipment, frequency, available time, experience, and goals; the product generates a tailored training plan (routine with exercises/sets/reps/schedule, calorie target, progression, and timeline) and presents it to the user.

- **Architecture:** server-rendered web application (Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4) on a managed serverless platform (Vercel), with Supabase providing authentication and a Postgres database, Drizzle ORM for data access, Zod for validation, and the Vercel AI SDK for plan generation.
- **Current user base:** authenticated users on a flat role model (email + password, all users equal, no admin role). Solo-first — built for the owner, then potentially others. Health data is isolated per account. Rough scale: small-to-medium (single digits to ~100 users).
- **Core functionality today (delivered slices):**
  - Auth flow — register / log in / log out, with gated routes.
  - Plan generation — a 12-field parameter form produces an AI-generated training plan, streamed to the user. The latest plan replaces the previous one (one active plan per user).
  - Locale — a PL/EN toggle applied to both the UI and the generated plan output.

## Problem Statement & Motivation

The MVP generates a plan but leaves the user with an **open loop**: generate a plan, then nothing. After login there is no home surface to return to, no way to record that a prescribed workout was actually performed, and no record of past sessions to look back on. The user's current workaround is to keep the plan in their head or track workouts outside the product entirely, which defeats the point of a personalized plan.

This change is needed now because two of these capabilities ("training session mode", "progress tracking over time") were explicitly parked as MVP Non-Goals and the product has reached the point where the generated plan is useless without a way to act on it. The change closes the loop into **generate plan → perform workouts → log them → review history**, and gives the product a proper post-auth home, delivered as three dedicated pages: a welcome dashboard, a workout-logging page, and a workout-history page.

## User & Persona

### Primary persona

Unchanged from the MVP: the user themselves — a person who trains and carries health/lifestyle context that generic fitness apps ignore, building for themselves first and then potentially others. This change serves that same persona *after* a plan exists. Their experience changes at three points: they now land on a dashboard after logging in (instead of being dropped into a bare route), they can record the workouts they actually performed against their active plan, and they can review and curate a history of past sessions.

## Success Criteria

### Primary
- A logged-in user with an active plan can log a workout that is pre-filled from that plan, edit actual reps/weight, add a note, and save it — and the saved session then appears in their workout history, where it can be edited or deleted.

### Secondary
- The welcome dashboard is the post-auth landing surface and adapts its primary call-to-action to the user's state (no plan → generate; has plan → view plan / log a workout).

### Guardrails
- **Existing behavior must not regress:** the shipped auth flow, route gating, and active-plan generation/persistence keep working. The only intended change to the auth flow is the post-login/registration redirect target (now the dashboard).
- **No orphan logs:** workout logging is unavailable when the user has no active plan — there is nothing to log against until a plan exists.
- **History survives plan replacement:** a saved session remains intact and viewable after the active plan is regenerated and replaced.
- **Per-account isolation:** a user can never see, edit, or delete another user's logged sessions or history, consistent with existing health-data isolation.
- **Responsive core interactions:** saving a logged workout and rendering the initial history list complete within roughly 1 second (p95) as perceived by the user.
- **Lossless save semantics:** an in-progress log is recorded only on an explicit save; discarding abandons changes without a partial write. The user is never left unsure whether a session was recorded.
- **Locale parity:** all three new pages render fully in both PL and EN, preserving the existing locale behavior; no hard-coded user-facing strings.

## User Stories

### US-01: User logs a workout from their active plan

- **Given** a logged-in user with an active generated plan, on the dashboard
- **When** they open the workout-logging page (pre-filled from the active plan), edit actual reps/weight, optionally add or remove exercises and sets, enter a duration and a note, and save
- **Then** the session is saved as a standalone snapshot and appears at the top of their workout history

#### Acceptance Criteria
- The logging page is pre-filled with the active plan's exercises/sets/reps when a plan exists.
- When no active plan exists, the logging entry point is disabled and the page cannot be used to create a new log.
- A saved session shows up in history with its date, session name/type, target muscle groups, and duration.
- The saved snapshot survives a subsequent plan regeneration without loss or corruption.

### US-02: User reviews and curates workout history

- **Given** a logged-in user with one or more logged sessions
- **When** they open the history page
- **Then** they see their past sessions (newest first), can reopen any session in the logging editor to edit it, and can delete a session from history (with confirmation)

#### Acceptance Criteria
- Sessions are listed newest-first, each showing date, session name/type, target muscle groups, and duration.
- Editing a session reopens the logging editor loaded with that session's saved data, and works even after the active plan has changed.
- Deleting a session requires a confirmation step and permanently removes it (no recovery).

## Scope of Change

`[new]` = capability that did not exist · `[modified]` = existing behavior changes · `[preserved]` = must keep working unchanged. FR identifiers and their counter-argument resolutions are carried forward from shaping.

### Dashboard

- `[modified]` FR-009: After login or registration, the user lands on the welcome dashboard. Priority: must-have
  > Socrates: Counter-argument considered — "changing the post-auth redirect touches the shipped auth flow and could disrupt it." Resolution: kept, with a sequencing constraint — the dashboard must gracefully handle the empty state (new user, no active plan, no history) BEFORE the redirect is flipped to it; existing auth tests must still pass. See Constraints & Compatibility.
- `[new]` FR-010: The dashboard shows a state-aware primary CTA — "generate a plan" when the user has no active plan; "view plan" / "log a workout" when one exists. Priority: must-have
  > Socrates: State-awareness was chosen deliberately over a static CTA (the dashboard is a home, not a marketing page). Stands as written.

### Workout logging

- `[new]` FR-011: User can pick which workout day/session of their active plan they performed, and the logging page pre-fills that day's exercises, sets, and reps. (If the plan has no day structure, the single routine pre-fills directly.) Priority: must-have
  > Socrates: Pre-fill (vs blank/manual) is the core of the closed loop. Day-selection granularity resolved in Phase 5 (people train day-by-day; the mockup shows a single session). Stands as written.
- `[new]` FR-012: User can edit the actual reps and weight per set, and add or remove sets within an exercise. Priority: must-have
  > Socrates: Recording actuals is the point of logging. Stands as written.
- `[new]` FR-014: User can add or remove exercises in the workout being logged. Priority: must-have
  > Socrates: Reality diverges from the plan (skipped/substituted exercises); without this the log can't be honest. Stands as written.
- `[new]` FR-015: User can attach a free-text note to the workout session. Priority: must-have
  > Socrates: Low-cost, high-value ("how did it feel", equipment changes); matches the mockup. Stands as written.
- `[new]` FR-016: User can save the logged workout (capturing a manually-entered session duration), or discard the changes. Priority: must-have
  > Socrates: Duration source resolved in Phase 4 (manual field on save, no live timer). Stands as written.
- `[new]` FR-017: Workout logging is unavailable (blocked/disabled) when the user has no active plan. Priority: must-have
  > Socrates: Counter-argument considered — "this could frustrate a user who wants to log freely." Resolution: kept — logging is defined as recording against a prescribed (pre-filled) workout; without an active plan there is nothing to seed, and free-form logging is out of scope this iteration.

### Workout history

- `[new]` FR-018: User can view a list of past logged sessions, each showing date, session name/type, target muscle groups, and duration. Priority: must-have
  > Socrates: This is the payoff of the whole loop — without a readable history, logging is write-only. Stands as written.
- `[new]` FR-020: User can edit a logged session from history — reopening the logging editor loaded with that session's saved data (works even after the active plan has changed, since the log is a standalone snapshot). Priority: must-have
  > Socrates: Edit semantics resolved in Phase 4 (reuse the logging editor). One editor for new and existing logs. Stands as written.
- `[new]` FR-021: User can delete a logged session from history — a permanent delete (no recovery), behind a confirmation step. Priority: must-have
  > Socrates: Mistaken/duplicate logs are inevitable; without delete the history degrades. Permanent delete + confirm chosen in Phase 5 (personal tool, no trash/recovery to build). Stands as written.
- `[new]` FR-022: History loads incrementally ("load more") rather than all at once. Priority: nice-to-have
  > Socrates: Counter-argument considered — "pagination is premature before there's much data." Resolution: kept as nice-to-have — cheap, mirrors the mockup, deferrable under the page-by-page scope-down.

### Preserved (defensive — must not break)

- `[preserved]` FR-023: Existing auth (register / log in / log out) and route gating continue to work unchanged. Priority: must-have
  > Socrates: Makes preservation explicit so the FR-009 redirect change does not regress login/logout/gating. Stands as written.
- `[preserved]` FR-024: Active-plan generation and one-active-plan persistence continue to work unchanged; replacing the active plan must not corrupt or delete logged history (logs are standalone snapshots). Priority: must-have
  > Socrates: The snapshot decision (Phase 4) exists precisely to protect history from plan replacement. Stands as written.
- `[preserved]` FR-025: PL/EN locale behavior continues to work across all pages, including the three new ones. Priority: must-have
  > Socrates: The three new pages add UI strings that must respect the existing locale toggle. Stands as written.

### Considered and dropped this iteration

- FR-013 (mark individual sets as "done" while logging) — dropped: logging is after-the-fact record-keeping, so a per-set done toggle adds UI without value. Reconsider only if live, mid-workout logging becomes a goal (see Non-Goals: live workout mode).
- FR-019 (search/filter history by name or date) — dropped: unnecessary for a solo user with few sessions; scrolling beats search. Reconsider once history volume warrants it.

## Constraints & Compatibility

- **Auth-flow change is sequenced (FR-009):** the dashboard must gracefully handle the empty state (new user — no active plan, no logged history) before the post-login/registration redirect is switched to it. Existing auth behavior (register/login/logout/gating) must continue to pass its tests.
- **Shared navigation is touched:** the shared top navigation gains `Dashboard` / `Plans` / `Log Workout` entries. This modifies the navbar already rendered across existing pages; the change must not break existing pages or the existing locale/account controls in the navbar.
- **Data changes are additive:** new records for logged sessions (and their exercises/sets) are introduced alongside existing plan/account data; no existing data is rewritten or removed. Because the change is additive, it can be withdrawn without affecting existing plan/account data, and the one-active-plan model is preserved — logs are decoupled from it by being standalone snapshots.
- **Existing integrations preserved:** authentication, the active-plan generation/persistence flow, and per-account data isolation continue to operate unchanged.
- **Localization reuse:** new user-facing strings are added to the existing localization system rather than introducing a new mechanism.
- **Design system reuse:** the new pages follow the existing design system and component library (the mockups already use the project's color/spacing/typography scale and components).

## Business Logic Changes

No change to the existing domain rule — the product still generates a personalized training plan from the user's parameters. What this change adds is **record-keeping (CRUD) around that existing plan**, governed by four application rules. Logged workouts are **not** consumed by any adaptation process this iteration — they are read back only by the history view.

1. **Pre-fill rule** — when the user logs a workout, they pick which workout day/session of their active plan they performed; the logging page is then seeded with that day's prescribed exercises, sets, and reps, and the user records actuals on top of that seed.
2. **Snapshot rule** — on save, a logged session is recorded as a self-contained snapshot of what was actually done (exercise names, sets, reps, weight, duration, notes, date). It holds no live reference to the plan, so replacing the active plan (one-active-plan semantics) never alters, orphans, or deletes past history.
3. **Gating rule** — creating a new log requires an active plan to seed from; with no active plan, the logging entry point is disabled. Editing an existing snapshot does not require an active plan.
4. **Dashboard-state rule** — the dashboard derives its primary call-to-action from whether the user has an active plan: no plan → "generate a plan"; has plan → "view plan" / "log a workout".

## Access Control Changes

No access control changes — current model preserved. The flat user model (email + password, all users equal, no admin role) stays as-is. All three new pages (dashboard, workout logging, workout history) are authenticated routes behind the existing auth gate; unauthenticated users are redirected to login exactly as today. Each user's logged workouts and history are isolated per account, consistent with existing health-data isolation. No new roles, no sharing.

## Non-Goals

Ruled out for **this iteration**. All four are deliberately deferred, not rejected — they form a coherent next-stage roadmap once the record-keeping loop is in place (forwarded to roadmap planning).

- **AI plan adaptation from logs** — logged workouts do not feed back into re-generating or adjusting the active plan. This iteration is record-keeping only; the dashboard's "plan evolves with every workout" framing is aspirational and out of scope here.
- **Planned-vs-actual analytics / charts** — no progress graphs, volume/PR trends, or comparison dashboards. History is a readable list, not an analytics suite.
- **Live workout mode (timers / rest periods)** — no in-session timers or real-time set tracking; logging is after-the-fact and duration is a manual field. (This is why the per-set "done" toggle was dropped.)
- **Sharing / export of workout logs** — no trainer sharing, no CSV/PDF export, no social features. Per-account only.

## Open Questions

No open questions at PRD generation time. Shaping closed with `quality_check_status: accepted` — all six brownfield elements (Access Control, Business Logic, project artifacts, timeline-cost acknowledgment, Non-Goals, preserved behavior) were present with no recorded gaps.
