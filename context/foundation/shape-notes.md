---
project: "AdaptivePlan"
context_type: brownfield
created: 2026-06-09
updated: 2026-06-09
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 15
  gray_areas_resolved:
    - topic: "feedback loop scope"
      decision: "record-keeping only; logged workouts do NOT feed AI plan adaptation this iteration"
    - topic: "dashboard role"
      decision: "state-aware home; post-auth redirect target; CTA reflects whether an active plan exists"
    - topic: "workout-log source"
      decision: "pre-filled from the active plan; logging disabled when no active plan exists"
  frs_drafted: 0
  quality_check_status: accepted
---

## Current System

AdaptivePlan is a shipped MVP — a personalized fitness training plan generator.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase (Auth + Postgres) · Drizzle ORM · Zod · Vercel AI SDK · deployed on Vercel.
- **Users today:** authenticated users (email + password, flat role model). Building for the owner first, then potentially others. Health data is isolated per account.
- **What exists (delivered slices):**
  - S-01 Auth flow — register / log in / log out (Supabase Auth, gated routes).
  - S-02 Plan generation — a 12-field parameter form (body stats, lifestyle, health issues, goals, equipment, frequency, time, experience) → AI-generated training plan (routine with exercises/sets/reps/schedule, calorie target, progression, timeline) streamed to the user. Latest plan replaces previous (one active plan per user).
  - S-03 Locale — PL/EN toggle (cookie-based `NEXT_LOCALE`), applies to UI and generated plan output.
- **Pain / gap driving this change:** the MVP generates a plan but the user can do nothing *with* it afterwards. There's no home surface to return to after login, no way to record that a prescribed workout was actually performed, and no history to look back on. Two of the three new features were explicitly parked as MVP Non-Goals ("training session mode", "progress tracking over time") and are now being pulled forward.
- **Must preserve:** existing auth + route gating, per-account health-data isolation, the active-plan generation/persistence flow, and the PL/EN locale behavior across all new pages.

## Vision & Problem Statement

The MVP delivers a personalized plan but leaves the user with an **open loop**: generate a plan, then nothing. There is no home to return to after login, no way to record that a prescribed workout was actually performed, and no record of past sessions.

This change closes the loop into **generate plan → perform workouts → log them → review history**, and gives the product a proper post-auth home. The delta, in three dedicated pages:

1. **Welcome dashboard** — a state-aware home; the post-login/register redirect target. Reflects whether the user has an active plan and surfaces the right next action (generate a plan, view the plan, or log a workout).
2. **Workout logging page** — the user records that they performed a workout. The page is **pre-filled from the user's active generated plan** (exercises, sets, reps); the user edits actuals (reps, weight), marks sets done, adds notes, and saves the session. **Disabled when there is no active plan.**
3. **Workout history page** — a list of past logged sessions; the user can edit or delete a unit from history.

Scope boundary for this iteration: logging and history are **record-keeping only**. Logged workouts do **not** yet feed back into AI plan adaptation — the dashboard's "plan evolves with every workout" / progress-tracking copy is aspirational and out of scope here (a future effort). Two of these features ("training session mode", "progress tracking over time") were parked as MVP Non-Goals and are now pulled forward as record-keeping, not as an adaptive AI loop.

## User & Persona

### Primary persona

Unchanged from the MVP: the user themselves — a person who trains and has health/lifestyle context generic apps ignore, building for themselves first then potentially others. The new surfaces serve this same persona *after* a plan exists: they've generated a plan, now they want a home to land on, a way to tick off the workouts they actually did, and a history to look back on.

## Access Control

No change to the auth model — current model preserved. The flat user model (email + password, all users equal, no admin role) stays as-is. All three new pages (dashboard, workout logging, workout history) are authenticated routes behind the existing auth gate; unauthenticated users are redirected to login as today. Each user's logged workouts and history are isolated per account, exactly like existing health data. No new roles, no sharing.

## Success Criteria

### Primary
- A logged-in user with an active plan can log a workout that is pre-filled from that plan, edit actual reps/weight, mark sets done, add a note, and save it — and the saved session then appears in their workout history, where it can be edited or deleted.

### Secondary
- The welcome dashboard is the post-auth landing surface and adapts its primary call-to-action to the user's state (no plan → generate; has plan → view plan / log workout).

### Guardrails
- **Preserve existing behavior:** the shipped auth flow, route gating, and active-plan generation/persistence must keep working; the only intended change to the auth flow is the post-login/register redirect target (now the dashboard).
- Workout logging is unavailable (disabled / blocked) when the user has no active plan — no orphan logs without a plan to seed from.
- Logged workouts and history are isolated per account (no leakage), consistent with existing health-data isolation.
- All three new pages render correctly in both locales (PL/EN), preserving the existing cookie-based locale behavior.

### Timeline acknowledgment
Acknowledged on 2026-06-09: 4–6 week delivery (after-hours) for all three pages exceeds the 3-week MVP cadence; user accepted the sustained-effort cost. Mitigation: ship page-by-page in dependency order (data model + logging → history → dashboard), each independently shippable.

## Functional Requirements

`Change:` tag — `new` (didn't exist), `modified` (existing behavior changes), `preserved` (must keep working unchanged).

### Dashboard

- FR-009: After login or registration, the user lands on the welcome dashboard. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "changing the post-auth redirect touches the shipped auth flow and could disrupt it." Resolution: kept, with a sequencing constraint — the dashboard must gracefully handle the empty state (new user, no active plan, no history) BEFORE the redirect is flipped to it; existing auth tests must still pass. See Constraints & Preserved Behavior.
- FR-010: The dashboard shows a state-aware primary CTA — "generate a plan" when the user has no active plan; "view plan" / "log a workout" when one exists. Priority: must-have. Change: new
  > Socrates: State-awareness was chosen deliberately over a static CTA in Phase 1 (the dashboard is a home, not a marketing page). Stands as written.

### Workout logging

- FR-011: User can pick which workout day/session of their active plan they performed, and the logging page pre-fills that day's exercises, sets, and reps. (If the plan has no day structure, the single routine pre-fills directly.) Priority: must-have. Change: new
  > Socrates: Pre-fill (vs blank/manual) was chosen in Phase 1; it's the core of the closed loop. Day-selection granularity resolved in Phase 5 (people train day-by-day; the mockup shows a single session). Stands as written.
- FR-012: User can edit the actual reps and weight per set, and add or remove sets within an exercise. Priority: must-have. Change: new
  > Socrates: Straightforward editing affordance; recording actuals is the point of logging. Stands as written.
- FR-014: User can add or remove exercises in the workout being logged. Priority: must-have. Change: new
  > Socrates: Reality diverges from the plan (skipped/substituted exercises); without this the log can't be honest. Stands as written.
- FR-015: User can attach a free-text note to the workout session. Priority: must-have. Change: new
  > Socrates: Low-cost, high-value ("how did it feel", equipment changes); matches the mockup. Stands as written.
- FR-016: User can save the logged workout (capturing a manually-entered session duration), or discard the changes. Priority: must-have. Change: new
  > Socrates: Duration source resolved in Phase 4 (manual field on save, no live timer). Stands as written.
- FR-017: Workout logging is unavailable (blocked/disabled) when the user has no active plan. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "this could frustrate a user who wants to log freely." Resolution: kept — logging is defined as recording against a prescribed (pre-filled) workout; without an active plan there's nothing to seed, and free-form logging is out of scope this iteration.

DROPPED — FR-013 (mark individual sets as "done" while logging). Socrates: dropped — logging is after-the-fact record-keeping, so a per-set done toggle adds UI without value. Reconsider only if live, mid-workout logging becomes a goal.

### Workout history

- FR-018: User can view a list of past logged sessions, each showing date, session name/type, target muscle groups, and duration. Priority: must-have. Change: new
  > Socrates: This is the payoff of the whole loop — without a readable history, logging is write-only. Stands as written.
- FR-020: User can edit a logged session from history — reopening the logging editor loaded with that session's saved data (works even after the active plan has changed, since the log is a standalone snapshot). Priority: must-have. Change: new
  > Socrates: Edit semantics resolved in Phase 4 (reuse the logging editor). One editor for new and existing logs. Stands as written.
- FR-021: User can delete a logged session from history (hard delete, behind a confirmation step). Priority: must-have. Change: new
  > Socrates: Mistaken/duplicate logs are inevitable; without delete the history degrades. Hard delete + confirm chosen in Phase 5 (personal tool, no trash/recovery to build). Stands as written.
- FR-022: History loads incrementally ("load more") rather than all at once. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument considered: "pagination is premature before there's much data." Resolution: kept as nice-to-have — cheap, mirrors the mockup, deferrable under the page-by-page scope-down.

DROPPED — FR-019 (search/filter history by name or date). Socrates: dropped — YAGNI for a solo user with few sessions; scrolling beats search. Reconsider once history volume actually warrants it.

### Preserved (defensive — must not break)

- FR-023: Existing auth (register / log in / log out) and route gating continue to work unchanged. Priority: must-have. Change: preserved
  > Socrates: Defensive FR; makes preservation explicit so the FR-009 redirect change doesn't regress login/logout/gating. Stands as written.
- FR-024: Active-plan generation and one-active-plan persistence continue to work unchanged; replacing the active plan must not corrupt or delete logged history (logs are standalone snapshots). Priority: must-have. Change: preserved
  > Socrates: Defensive FR; the snapshot decision (Phase 4) exists precisely to protect history from plan replacement. Stands as written.
- FR-025: PL/EN locale behavior (cookie-based) continues to work across all pages, including the three new ones. Priority: must-have. Change: preserved
  > Socrates: Defensive FR; the three new pages add UI strings that must respect the existing locale toggle. Stands as written.

## User Stories

### US-02: User logs a workout from their active plan

- **Given** a logged-in user with an active generated plan, on the dashboard
- **When** they open the workout-logging page (pre-filled from the active plan), edit actual reps/weight, mark sets done, optionally add/remove exercises or sets, enter a duration and a note, and save
- **Then** the session is persisted as a standalone snapshot and appears at the top of their workout history

#### Acceptance Criteria
- The logging page is pre-filled with the active plan's exercises/sets/reps when a plan exists.
- When no active plan exists, the logging entry point is disabled and the page is not usable for new logs.
- A saved session shows up in history with its date, session name/type, muscle groups, and duration.
- The saved snapshot survives a subsequent plan regeneration without loss or corruption.

### US-03: User reviews and curates workout history

- **Given** a logged-in user with one or more logged sessions
- **When** they open the history page
- **Then** they see their past sessions (newest first), can reopen any session in the logging editor to edit it, and can delete a session from history (with confirmation)

## Business Logic

This iteration adds **no new AI/domain rule**. The existing domain decision — the app generates a personalized training plan from the user's parameters — is unchanged. What this change adds is **record-keeping (CRUD) around that existing plan**, governed by four application rules:

1. **Pre-fill rule** — when the user logs a workout, they pick which workout day/session of their active plan they performed; the logging page is then seeded with that day's prescribed exercises, sets, and reps. The user records actuals on top of that seed.
2. **Snapshot rule** — on save, a logged session is persisted as a self-contained snapshot of what was actually done (exercise names, sets, reps, weight, duration, notes, date). It does not hold a live reference to the plan, so replacing the active plan (one-active-plan semantics) never alters, orphans, or deletes past history.
3. **Gating rule** — creating a new log requires an active plan to seed from; with no active plan, the logging entry point is disabled. (Editing an existing snapshot does not require an active plan.)
4. **Dashboard-state rule** — the dashboard derives its primary call-to-action from whether the user has an active plan: no plan → "generate a plan"; has plan → "view plan" / "log a workout".

Logged workouts are **not** consumed by any AI/adaptation process this iteration — they are read back only by the history view. (Feedback into plan adaptation is explicitly deferred; see Non-Goals.)

## Non-Functional Requirements

- Logged workouts and workout history are isolated per account — a user can never see, edit, or delete another user's sessions, consistent with existing health-data isolation.
- Past history is durable across plan regeneration — a saved session must remain intact and viewable after the active plan is replaced (snapshot guarantee).
- Saving a logged workout and rendering the history list are perceived as responsive (user-perceived response under ~1s p95 for save and for the initial history render).
- Saving is explicit and lossless — an in-progress log is only persisted on an explicit save; "discard" abandons changes without partial writes. The user is never silently left unsure whether their session was recorded.
- All three new pages render fully in both locales (PL/EN), preserving the existing cookie-based locale behavior; no hard-coded user-facing strings.

## Constraints & Preserved Behavior

- **Auth-flow change is sequenced (FR-009):** the dashboard must gracefully handle the empty state (new user — no active plan, no logged history) before the post-login/registration redirect is switched to it. Existing auth tests (register/login/logout/gating) must continue to pass.
- **Shared navigation:** the new top-nav entries (`Dashboard` / `Plans` / `Log Workout`) modify the shared navbar that already renders across existing pages — the change must not break existing pages or the locale/account controls already in the navbar.
- **Data is additive:** new tables for logged sessions (and their exercises/sets) are introduced; existing plan/auth tables and their data are not migrated destructively. The one-active-plan model is preserved; logs are decoupled from it by snapshot.
- **Localization system reuse:** new UI strings are added to the existing i18n setup rather than introducing a new mechanism.
- **Design system reuse:** the new pages follow the existing design tokens/components (the mockups already use the project's color/spacing/typography scale and shadcn-style components).

## Product Framing

- **Product type:** no change — existing web app (Next.js App Router).
- **Target scale:** no change — solo-first, medium; this change adds per-user data (logged sessions) but no new scale class.
- **Timeline:** after-hours, no hard deadline. Estimated 4–6 weeks across the three pages, shipped page-by-page in dependency order. (See Timeline acknowledgment.)

## Non-Goals

Ruled out for **this iteration** (all flagged as strong candidates for future iterations — see Forward block):

- **AI plan adaptation from logs** — logged workouts do not feed back into re-generating or adjusting the active plan. This iteration is record-keeping only.
- **Planned-vs-actual analytics / charts** — no progress graphs, volume/PR trends, or comparison dashboards. History is a readable list, not an analytics suite.
- **Live workout mode (timers / rest periods)** — no in-session timers or real-time set tracking; logging is after-the-fact, and duration is a manual field.
- **Sharing / export of workout logs** — no trainer sharing, no CSV/PDF export, no social. Per-account only.

## Forward: future iterations

The four non-goals above are deliberately deferred, not rejected — they form a coherent next-stage roadmap once the record-keeping loop is in place:

- **Adaptive plan loop** — feed logged actuals back into plan generation so the plan evolves with performance (this is what the dashboard's "plan ewoluuje z każdym treningiem" copy already promises).
- **Progress analytics** — charts and planned-vs-actual comparison built on the accumulated snapshot history.
- **Live workout mode** — timers, rest countdowns, per-set live tracking (would revive a refined version of the dropped per-set "done" toggle, FR-013).
- **Sharing / export** — share or export logs (e.g. to a trainer).

## Quality cross-check

All six brownfield elements present at close (quality_check_status: accepted). No gaps recorded.

| Element             | Status                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| Access Control      | present — no auth change; 3 new pages gated behind existing auth                |
| Business Logic      | present — record-keeping classification + 4 application rules                   |
| Project artifacts   | present — shape-notes.md with valid checkpoint frontmatter                       |
| Timeline-cost ack   | present — 4–6 weeks after-hours accepted; page-by-page mitigation               |
| Non-Goals           | present — 4 entries + forward block                                             |
| Preserved behavior  | present — Constraints section + FR-023/024/025; FR-009 sequencing constraint    |
