---
project: "AdaptivePlan"
version: 1
status: draft
created: 2026-06-09
updated: 2026-06-10
prd_version: 1
main_goal: low-complexity
top_blocker: none
---

# Roadmap: AdaptivePlan

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

The shipped MVP generates a personalized training plan and then stops — there is no home to return to after login, no way to record that a prescribed workout was actually performed, and no record of past sessions. This change closes the open loop into **generate plan → perform workouts → log them → review history**, delivered as three new pages (welcome dashboard, workout-logging, workout-history) on top of the existing auth + plan-generation system. It is record-keeping only this iteration: logged workouts are read back by the history view and do not yet feed plan adaptation.

## North star

**S-01: user can log a workout from their active plan and save it** — pre-fill from the active plan, edit actual reps/weight, add a note and duration, save as a snapshot. This is the validation milestone because it proves the core closed-loop hypothesis (capturing what was actually done); everything else only matters once this works.

> *North star* here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis — placed as early as its Prerequisites allow because the rest of the roadmap only pays off if this slice works.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                              | Prerequisites | PRD refs                                       | Status   |
| ---- | ----------------------------- | ---------------------------------------------------------------- | ------------- | ---------------------------------------------- | -------- |
| F-01 | workout-session-snapshot-store | (foundation) plan-decoupled, per-account snapshot store exists   | —             | FR-024                                         | done     |
| S-01 | log-workout-from-plan         | log a workout pre-filled from the active plan, then save it      | F-01          | US-01, FR-011, FR-012, FR-014, FR-015, FR-016, FR-017, FR-025 | done     |
| S-02 | view-workout-history          | view past logged sessions, newest first                          | F-01, S-01    | US-02, FR-018, FR-025                          | done     |
| S-03 | curate-workout-history        | edit or delete a logged session from history                     | S-01, S-02    | US-02, FR-020, FR-021                          | proposed |
| S-04 | welcome-dashboard             | land on a state-aware home with the right primary call-to-action | S-01          | FR-010, FR-025                                 | proposed |
| S-05 | dashboard-post-auth-landing   | be taken to the dashboard after login/registration               | S-04          | FR-009, FR-023                                 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme           | Chain                                  | Note                                                                                  |
| ------ | --------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| A      | Closed loop     | `F-01` → `S-01` → `S-02` → `S-03`      | The north-star path: store, log, read back, curate. Satisfies the Primary criterion.  |
| B      | Home surface    | `S-04` → `S-05`                        | Joins Stream A at `S-01` (dashboard's "log a workout" CTA needs the logging route).   |

## Baseline

What's already in place in the codebase as of `2026-06-09` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 App Router, React 19, Tailwind 4, shadcn components.
- **Backend / API:** present — route handlers (`src/app/api/plan/generate/route.ts`) + server actions (`src/lib/auth/actions.ts`).
- **Data:** partial — Drizzle + Supabase Postgres wired; only the `plans` table exists (`src/db/schema.ts:13-25`). The workout-session / log / history store is **absent**. Per-account isolation is enforced by app-layer `user_id` scoping (RLS off, `src/db/plans.ts:7-18`).
- **Auth:** present — Supabase SSR; deny-by-default route gating (`src/proxy.ts`); post-auth redirect currently targets `/plan` (`src/lib/auth/actions.ts:34,63`).
- **Deploy / infra:** partial — Vercel configured (`.vercel/project.json`); no `.github/workflows` CI present.
- **Observability:** absent — `console.error` only (`src/lib/plan/log-generation-error.ts:3`); no Sentry / OpenTelemetry / metrics.

Routes present: `/plan` (view), `/plan/new` (generate). Routes absent: dashboard, log-workout, history. Shared navbar exists in `src/app/(app)/layout.tsx:18-54` (entries: plan, newPlan, a disabled "Progress" placeholder, locale toggle, sign-out).

## Foundations

### F-01: Workout-session snapshot store

- **Outcome:** (foundation) a per-account-isolated, plan-decoupled persistence store for logged workout sessions exists — schema, migration, and `user_id`-scoped data access — ready for logging to write and history to read. No user-visible surface on its own.
- **Change ID:** workout-session-snapshot-store
- **PRD refs:** FR-024 (snapshot decoupling / durability), Business Logic rule 2 (snapshot rule), Access Control Changes (per-account isolation)
- **Unlocks:** S-01 (writes a session snapshot on save), S-02 (reads the session list)
- **Prerequisites:** — (Drizzle + Postgres already wired; this adds the session store alongside the existing `plans` table)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Store the session as a normalized set of tables (session / exercise / set) or as a single JSONB snapshot document mirroring the existing `plans.plan` pattern? — Owner: team. Block: no (a planning-time choice; either satisfies the snapshot guarantee).
- **Risk:** Sequenced first because no slice can persist a workout without a place to put it. The load-bearing requirement is that a saved session holds no live reference to the active plan, so plan regeneration never alters or orphans history. Risk is over-modeling — keep it minimal; durability + isolation are the only properties that must be right here.
- **Status:** done

## Slices

### S-01: Log a workout from the active plan

- **Outcome:** user can open the logging page pre-filled from their active plan (picking which day/session they performed), edit actual reps/weight, add or remove sets and exercises, enter a duration and a free-text note, and save it as a snapshot — or discard without a partial write. The logging entry point is disabled when no active plan exists.
- **Change ID:** log-workout-from-plan
- **PRD refs:** US-01, FR-011 (pick day + pre-fill), FR-012 (edit reps/weight, add/remove sets), FR-014 (add/remove exercises), FR-015 (note), FR-016 (save with manual duration / discard), FR-017 (gated when no active plan), FR-025 (locale parity)
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the north star and the heaviest UI in the change — the logging editor. It is reused by S-03 (edit from history), so the editor's contract (load-from-plan vs load-from-snapshot) must be settled here. Adds the "Log Workout" entry to the shared navbar; must not disturb existing navbar/locale/sign-out controls.
- **Status:** done

### S-02: View workout history

- **Outcome:** user can view a list of their past logged sessions, newest first, each showing date, session name/type, target muscle groups, and duration.
- **Change ID:** view-workout-history
- **PRD refs:** US-02, FR-018 (history list), FR-025 (locale parity)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Read-only and low-risk, but only meaningful once S-01 has produced saved sessions — without it the page is empty by construction. Replaces the disabled "Progress" navbar placeholder with a real history entry. FR-022 ("load more") is parked; this slice renders the full list.
- **Status:** done

### S-03: Edit & delete sessions from history

- **Outcome:** user can reopen any logged session from history in the logging editor and save changes (works even after the active plan has changed, since the log is a standalone snapshot), and can permanently delete a session behind a confirmation step.
- **Change ID:** curate-workout-history
- **PRD refs:** US-02, FR-020 (edit reopens the logging editor on saved data), FR-021 (permanent delete behind confirmation)
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Reuses the S-01 editor loaded by snapshot id rather than from the plan — the reason S-01 must settle that load path. Delete is permanent (no recovery), so the confirmation step is the only safeguard against destroying real history; getting that guard right is the slice's main concern.
- **Status:** proposed

### S-04: Welcome dashboard

- **Outcome:** user lands on a welcome dashboard (reachable from the navbar) whose primary call-to-action adapts to their state — "generate a plan" when there is no active plan; "view plan" / "log a workout" when one exists — and which renders gracefully for a brand-new user with no plan and no history.
- **Change ID:** welcome-dashboard
- **PRD refs:** FR-010 (state-aware CTA), FR-025 (locale parity), Business Logic rule 4 (dashboard-state rule)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Must handle the empty state (new user — no active plan, no logged history) cleanly, because S-05 flips the post-auth redirect onto it; a dashboard that breaks for new users would break the login experience once redirected. Depends on S-01 so the "log a workout" CTA has a live destination. Adds the "Dashboard" navbar entry.
- **Status:** proposed

### S-05: Dashboard as post-auth landing

- **Outcome:** after logging in or registering, the user is taken to the welcome dashboard instead of the current `/plan` target.
- **Change ID:** dashboard-post-auth-landing
- **PRD refs:** FR-009 (post-auth redirect target), FR-023 (existing auth: register/login/logout + route gating preserved)
- **Prerequisites:** S-04
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The single change that touches the shipped auth flow. Isolated as its own slice so the existing auth tests (register/login/logout/gating) gate it and a redirect regression can't hide inside a larger feature. Sequenced last and only after S-04 proves the dashboard is safe for new users (the PRD's explicit FR-009 sequencing constraint).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                  | Ready for `/10x-plan` | Notes |
| ---------- | ------------------------------ | ------------------------------------------------------ | --------------------- | ----- |
| F-01       | workout-session-snapshot-store | Add plan-decoupled workout-session snapshot store      | yes                   | Run `/10x-plan workout-session-snapshot-store` — unblocks the north star |
| S-01       | log-workout-from-plan          | Workout logging page (pre-fill from active plan + save) | no                    | Ready once F-01 is done |
| S-02       | view-workout-history           | Workout history list (newest first)                    | no                    | Ready once S-01 is done |
| S-03       | curate-workout-history         | Edit & delete sessions from workout history            | no                    | Ready once S-02 is done |
| S-04       | welcome-dashboard              | State-aware welcome dashboard                          | no                    | Ready once S-01 is done; parallel with S-02/S-03 |
| S-05       | dashboard-post-auth-landing    | Redirect post-auth landing to the dashboard            | no                    | Ready once S-04 is done; touches auth flow |

## Open Roadmap Questions

None. The PRD closed with zero Open Questions (`quality_check_status: accepted`), and no cross-cutting sequencing question surfaced during framing. The single per-slice design fork (snapshot storage shape) is recorded as a non-blocking Unknown on F-01 and belongs to `/10x-plan`.

## Parked

- **FR-022 — incremental "load more" in history** — Why parked: nice-to-have; under the low-complexity sequencing goal, S-02 renders the full list and pagination is deferred until history volume warrants it.
- **FR-013 — per-set "done" toggle while logging** — Why parked: dropped in shaping; logging is after-the-fact, so a per-set live toggle adds UI without value. Revisit only with live workout mode.
- **FR-019 — search/filter history** — Why parked: dropped in shaping; unnecessary for a solo user with few sessions. Revisit once history volume warrants it.
- **AI plan adaptation from logs** — Why parked: PRD §Non-Goals; this iteration is record-keeping only, logs do not feed plan regeneration.
- **Planned-vs-actual analytics / charts** — Why parked: PRD §Non-Goals; history is a readable list, not an analytics suite.
- **Live workout mode (timers / rest periods)** — Why parked: PRD §Non-Goals; logging is after-the-fact with a manual duration field.
- **Sharing / export of workout logs** — Why parked: PRD §Non-Goals; per-account only, no trainer sharing or CSV/PDF export.

## Done

- **F-01: (foundation) a per-account-isolated, plan-decoupled persistence store for logged workout sessions exists — schema, migration, and `user_id`-scoped data access — ready for logging to write and history to read. No user-visible surface on its own.** — Archived 2026-06-09 → `context/archive/2026-06-09-workout-session-snapshot-store/`. Lesson: —.
- **S-01: user can open the logging page pre-filled from their active plan (picking which day/session they performed), edit actual reps/weight, add or remove sets and exercises, enter a duration and a free-text note, and save it as a snapshot — or discard without a partial write. The logging entry point is disabled when no active plan exists.** — Archived 2026-06-10 → `context/archive/2026-06-09-log-workout-from-plan/`. Lesson: —.
- **S-02: view past logged sessions, newest first** — Archived 2026-06-10 → `context/archive/2026-06-10-view-workout-history/`. Lesson: —.
