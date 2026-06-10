# Welcome Dashboard (S-04) — Plan Brief

> Full plan: `context/changes/welcome-dashboard/plan.md`

## What & Why

The shipped MVP drops a logged-in user straight into a bare route — there is no home to
return to. This slice adds a **state-aware welcome dashboard** at `/dashboard`: a home whose
primary call-to-action adapts to the user's plan state (no plan → "generate a plan"; has plan
→ "log a workout" / "view plan"). It is built now because S-05 will flip the post-auth
redirect onto it — so the dashboard must first render cleanly for a brand-new user.

## Starting Point

Every `(app)` page already follows the same shape (async server component → `getUser` →
redirect → load data → render a dumb presentational body). `getActivePlan`, `hasActivePlan`,
and `listSessions` already exist and are indexed; the shared navbar and the bilingual i18n
namespaces are in place. Nothing new is needed below the page layer.

## Desired End State

Navigating to `/dashboard` (via a new leftmost navbar entry), the user sees: with no plan, a
single "generate a plan" CTA; with a plan, a primary "log a workout" + secondary "view plan",
the plan's goal/summary, and the 2–3 most recent logged sessions. A brand-new account renders
the generate CTA with no errors. All copy works in PL and EN. The post-auth redirect is
unchanged (still `/plan`).

## Key Decisions Made

| Decision                         | Choice                                              | Why (1 sentence)                                                                 | Source |
| -------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Route path                       | `/dashboard` (root `/` untouched)                   | Additive, zero risk to the shipped `/`→login redirect; S-05 later targets it.    | Plan   |
| Mockup fidelity                  | Functional home, mockup styling only                | PRD wants a home, not a marketing page; reuse the dark visual language.          | Plan   |
| Has-plan CTA layout              | "Log a workout" primary + "View plan" secondary     | Logging is the north-star action the whole loop exists for.                      | Plan   |
| Marketing feature cards          | Dropped entirely                                    | The third card promises AI adaptation — an explicit PRD Non-Goal.                | Plan   |
| With-plan glance                 | Plan goal/summary + 2–3 recent sessions             | Makes the home useful; data layer already provides it for free.                  | Plan   |
| Navbar placement                 | First (leftmost)                                    | Matches its role as the home/landing surface and S-05's redirect target.         | Plan   |
| Test coverage                    | Bilingual RTL on the state-aware CTA logic          | Pins the slice's only real logic at the cheapest layer.                          | Plan   |

## Scope

**In scope:** `/dashboard` route; a dumb dashboard component module; a `Dashboard` i18n
namespace + `Nav.dashboard` (PL/EN); a leftmost navbar entry; RTL tests on the CTA logic.

**Out of scope:** the post-auth redirect (S-05); changes to `/`; the marketing hero/feature
cards; plan adaptation, analytics, history search; any schema/migration/API/data-access change.

## Architecture / Approach

Smart/dumb split mirroring `/history`. The smart server page (`(app)/dashboard/page.tsx`)
gates on auth, calls `getActivePlan` + `listSessions`, derives a small view-model, and hands
it to a dumb `DashboardHome` (sync `useTranslations`, RTL-testable per the lessons.md
carve-out). The state-aware CTA block is the only real logic and the unit the tests pin.

## Phases at a Glance

| Phase                          | What it delivers                                          | Key risk                                              |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- |
| 1. Strings & navbar entry      | `Dashboard` namespace + `Nav.dashboard`; leftmost link    | Disturbing the shared navbar's log-workout gating     |
| 2. Presentational components   | Dumb CTA block + plan/recent-sessions glance + `DashboardHome` | Getting the state→CTA mapping right (FR-010)      |
| 3. Dashboard server page       | `/dashboard` route wiring data → component                | Brand-new-user (null plan / empty history) must not throw |
| 4. Tests & verification        | Bilingual RTL on CTA logic + manual PL/EN pass            | Missing-key / locale-parity gaps                      |

**Prerequisites:** S-01 (`log-workout-from-plan`) — done, so the "log a workout" CTA has a
live destination.
**Estimated effort:** ~1 session across 4 small phases.

## Open Risks & Assumptions

- Assumes `getActivePlan` + `listSessions` p95 stays within the PRD's ~1s guardrail (same
  reads `/plan` and `/history` already make — low risk).
- The brand-new-user empty render is load-bearing for S-05; covered explicitly by a Phase 4 test.

## Success Criteria (Summary)

- `/dashboard` shows the correct CTA(s) and destinations for no-plan, plan-no-history, and
  plan-with-history states, in PL and EN.
- A brand-new account renders the dashboard with the generate CTA and no errors.
- Existing navbar controls (locale, sign-out, log-workout gating) and the post-auth redirect
  are unchanged.
