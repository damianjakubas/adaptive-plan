# Dashboard as Post-Auth Landing — Plan Brief

> Full plan: `context/changes/dashboard-post-auth-landing/plan.md`

## What & Why

After logging in or registering, the user is taken to the state-aware welcome dashboard
(`/dashboard`) instead of the current bare `/plan` route. This is roadmap slice **S-05** — the
final slice of the dashboard stream and the only one that touches the shipped auth flow. It
gives the product a proper post-auth home now that the dashboard (S-04) exists.

## Starting Point

Three sites send an authenticated user "home", all currently targeting `/plan`: `signIn`
(`actions.ts:34`), `signUp` (`actions.ts:63`), and the proxy's authenticated-on-`/login` bounce
(`proxy.ts:6,37`). The `/dashboard` destination already exists and was verified new-user-safe in
S-04. Three existing test assertions pin the `/plan` target.

## Desired End State

Logging in, registering, or revisiting `/login` while authenticated all land on `/dashboard`,
behind one shared constant. Every other auth behavior (error mapping, gating, logout) is
unchanged and still gated by its existing tests.

## Key Decisions Made

| Decision                       | Choice                                   | Why (1 sentence)                                                              | Source |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Which redirect sites flip      | All three (signIn, signUp, proxy bounce) | The dashboard is the home for every authenticated entry point — one rule.    | Plan   |
| Path reference                 | Single shared constant `POST_AUTH_LANDING` | One source of truth; next change is a one-line edit, no drift across sites.   | Plan   |
| Return-to-destination (`?next=`) | No — always land on `/dashboard`         | No existing mechanism; out of FR-009 scope; keeps the slice low-complexity.   | Plan   |
| Test strategy                  | Update the 3 existing target assertions  | The existing tests ARE the contract; other assertions stay as FR-023 guard.  | Plan   |

## Scope

**In scope:** shared landing constant; flip `signIn` / `signUp` / proxy bounce to `/dashboard`;
update the three redirect-target test assertions.

**Out of scope:** `?next=` return-to-destination; redesigning proxy gating; navbar / "view plan"
CTA / log-workout navigation `/plan` references; new tests beyond the three updates; any change
to the dashboard page itself.

## Architecture / Approach

Add `POST_AUTH_LANDING = "/dashboard"` in a new `src/lib/auth/routes.ts`. `actions.ts` imports
it for both `redirect(...)` calls; `proxy.ts` resolves its `DEFAULT_PROTECTED` value from it.
Route gating (deny-by-default) is untouched — only the destination value changes. Then re-point
the three existing assertions and run the full auth + proxy suites as the regression gate.

## Phases at a Glance

| Phase                                  | What it delivers                                              | Key risk                                                       |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 1. Flip post-auth landing to dashboard | Shared constant + three redirect flips + three test updates  | Accidentally regressing another auth behavior (gated by suite) |

**Prerequisites:** S-04 (`welcome-dashboard`) done — dashboard renders cleanly for new users.
**Estimated effort:** ~1 short session, single phase.

## Open Risks & Assumptions

- Assumes the S-04 dashboard empty state is genuinely safe for brand-new users (verified at S-04
  archive; FR-009's explicit sequencing prerequisite).
- The only behavioral risk is collateral change to the auth flow — bounded by leaving every
  non-target assertion in `actions.test.ts` and `proxy.test.ts` intact.

## Success Criteria (Summary)

- After login or registration, the user lands on `/dashboard` (FR-009).
- An authenticated user revisiting `/login` is bounced to `/dashboard`.
- Logout, route gating, and auth error messaging are unchanged (FR-023); full test suite green.
