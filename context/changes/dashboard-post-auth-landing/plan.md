# Dashboard as Post-Auth Landing Implementation Plan

## Overview

Flip the post-auth landing target from `/plan` to `/dashboard`. After login or registration —
and whenever an already-authenticated user revisits `/login` — the user is taken to the
state-aware welcome dashboard (built and shipped in S-04) instead of being dropped into the
bare `/plan` route. This is roadmap slice **S-05**, the final slice of the dashboard stream and
the only one that touches the shipped auth flow.

## Current State Analysis

Three sites send an authenticated user "home", and together they constitute the entire
post-auth landing behavior. All three currently target `/plan`:

1. `src/lib/auth/actions.ts:34` — `signIn` success → `redirect("/plan")` (after login).
2. `src/lib/auth/actions.ts:63` — `signUp` success → `redirect("/plan")` (after registration).
3. `src/proxy.ts:6,37` — `const DEFAULT_PROTECTED = "/plan"`, used at line 37 when an already
   authenticated user navigates to `/login` (the auth route → home bounce).

The destination already exists: `src/app/(app)/dashboard/page.tsx` is the `/dashboard` route,
shipped in S-04. S-04 explicitly verified it renders cleanly for a brand-new user (no active
plan, no logged history) — this is the FR-009 sequencing prerequisite and it is satisfied.

The regression surface is small and already covered by tests:
- `src/tests/lib/auth/actions.test.ts:65` — asserts `signIn` redirects to `/plan`.
- `src/tests/lib/auth/actions.test.ts:108` — asserts `signUp` redirects to `/plan`.
- `src/tests/proxy.test.ts:90` — asserts the authenticated `/login → /plan` bounce.

These three assertions are exactly what must change. Every *other* assertion in those two test
files (error mapping, schema rejection, `email_exists`, logout → `/login`, deny-by-default
gating, 401 JSON for `/api/*`, Set-Cookie preservation) is FR-023's guardrail and stays
untouched.

### Key Discoveries:

- The `/dashboard` route exists and is new-user-safe (`src/app/(app)/dashboard/page.tsx`,
  S-04 archived `context/archive/2026-06-10-welcome-dashboard/`).
- `proxy.ts` route gating is **deny-by-default** (public-routes list, `lessons.md`). Flipping
  the `DEFAULT_PROTECTED` *value* changes only the authenticated-on-`/login` destination — it
  does not affect which routes are gated.
- Other `/plan` references in the codebase are **not** post-auth landing and must stay:
  navbar "plan" link (`src/app/(app)/layout.tsx:48`), the dashboard "view plan" CTA
  (`src/components/dashboard/dashboard-cta.tsx:33`), and log-workout discard/save navigation
  (`src/components/workout/log-workout-flow.tsx:56,63`).
- No email-confirmation callback route exists (Supabase auto-confirm is on — see
  `signUp` comment at `src/lib/auth/actions.ts:57-58`), so there is no fourth redirect site.
- The page-guard `redirect("/login")` calls in each `(app)` page are the *unauthenticated*
  direction and are unrelated to this change.

## Desired End State

A user who logs in, registers, or revisits `/login` while already authenticated lands on
`/dashboard`. The landing path is defined once as a shared constant and imported by both
`actions.ts` and `proxy.ts`, so a future landing change is a single-line edit. All existing
auth tests pass with the three target assertions updated to `/dashboard`; no other auth
behavior changes.

Verified by: `npm run test` (auth + proxy suites green), `npx tsc --noEmit`, `npm run lint`,
and a manual pass confirming login / registration / authenticated-`/login` all land on the
dashboard in both locales.

## What We're NOT Doing

- **No return-to-intended-destination (`?next=`) mechanism.** Unauthenticated users hitting a
  protected route continue to go to `/login` with no captured path, and after auth they land
  on the fixed dashboard. This was an explicit decision (out of FR-009 scope, no existing
  mechanism to extend).
- **No rename of the `DEFAULT_PROTECTED` concept beyond consolidation.** We replace its literal
  value with the shared constant; we are not redesigning proxy's gating vocabulary.
- **No changes to the navbar, the "view plan" CTA, or log-workout navigation** — those `/plan`
  references are intentional and unrelated.
- **No new tests beyond updating the three existing target assertions** — duplicating
  assertions the existing three already make would be a redundant-copy anti-pattern.
- **No changes to the dashboard page itself** — it shipped in S-04 and is already new-user-safe.

## Implementation Approach

Introduce a small auth-routes module exporting `POST_AUTH_LANDING = "/dashboard"` and
`AUTH_ROUTE = "/login"`. Point all three redirect sites at the landing constant: `signIn` and
`signUp` import and pass it to `redirect(...)`; `proxy.ts` sets its `DEFAULT_PROTECTED` from it
(or imports it directly, replacing the local literal). Consolidate the duplicated `/login`
literal onto `AUTH_ROUTE` in both `proxy.ts` and `actions.ts` `signOut` (value unchanged, so the
existing `/login` assertions stay green). Then update the three existing test assertions from
`/plan` to `/dashboard`. Run the full auth + proxy suites — they are the contract that proves the
flip landed without regressing the rest of the auth flow.

## Phase 1: Flip post-auth landing to the dashboard

### Overview

Add the shared landing constant, repoint the three redirect sites, and update the three
existing redirect-target test assertions.

### Changes Required:

#### 1. Shared auth-route constants

**File**: `src/lib/auth/routes.ts` (new)

**Intent**: Define the post-auth landing path AND the auth route once so the redirect sites
cannot drift apart and a future change is a single edit. Mirrors how `DEFAULT_PROTECTED` already
centralized proxy's target, now lifted to a shared location both `actions.ts` and `proxy.ts`
import. `/login` is duplicated in `proxy.ts:5` and `actions.ts:70` by the same drift logic, so
it is consolidated here too.

**Contract**: Exports `AUTH_ROUTE = "/login"` and `POST_AUTH_LANDING = "/dashboard"` (both
`const` strings). Follow the project export convention (named `export { ... }` block or
`export const` at declaration; alphabetical — `AUTH_ROUTE` before `POST_AUTH_LANDING`).

#### 2. Auth server actions

**File**: `src/lib/auth/actions.ts`

**Intent**: Send users to the dashboard after login and registration instead of `/plan`.

**Contract**: Both `redirect("/plan")` calls (lines 34 and 63) become
`redirect(POST_AUTH_LANDING)`, and the `signOut` `redirect("/login")` (line 70) becomes
`redirect(AUTH_ROUTE)` — all importing from `@/lib/auth/routes`. Update the two doc comments
that say "redirects to the active plan" to name the dashboard. `signOut`'s destination value is
unchanged (still `/login`); only the literal is replaced by the shared constant, so the existing
`signOut → /login` assertion stays green.

#### 3. Proxy authenticated-on-`/login` bounce

**File**: `src/proxy.ts`

**Intent**: When an already-authenticated user hits `/login`, send them to the dashboard
(the home) rather than `/plan`, keeping all three entry points consistent.

**Contract**: The value used at line 37 resolves to `POST_AUTH_LANDING`. Replace the local
`const DEFAULT_PROTECTED = "/plan"` (line 6) with the imported `POST_AUTH_LANDING` from
`@/lib/auth/routes` (either `import` it and use it directly at line 37, or assign
`const DEFAULT_PROTECTED = POST_AUTH_LANDING`). Also replace the local
`const AUTH_ROUTE = "/login"` (line 5) with the imported `AUTH_ROUTE` from the same module — the
`pathname === AUTH_ROUTE` check (line 23) and the redirect target (line 32) then use the shared
constant. Route-gating logic (the public-routes list, deny-by-default) is untouched.

#### 4. Update existing redirect-target assertions

**Files**: `src/tests/lib/auth/actions.test.ts`, `src/tests/proxy.test.ts`

**Intent**: Re-point exactly the three assertions that pin the post-auth target, leaving every
other auth assertion as the FR-023 regression guard.

**Contract**:
- `actions.test.ts:65` — `expect(mocks.redirect).toHaveBeenCalledWith("/plan")` → `"/dashboard"`
  (and rename the `it("redirects to /plan on success")` title to `/dashboard`).
- `actions.test.ts:108` — same change for the signUp success test (and its title).
- `proxy.test.ts:90` — the authenticated `/login` test expects
  `new URL(...).pathname` to be `/dashboard` (and rename `it("redirects /login to /plan ...")`).
- Do **not** touch any other assertion in either file (error mapping, gating, logout,
  401 JSON, Set-Cookie preservation, `/plan` pass-through for authed users).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes (no-console, alphabetical sort, no `any`): `npm run lint`
- Auth action tests pass with the new target: `npm run test -- src/tests/lib/auth/actions.test.ts`
- Proxy tests pass with the new target: `npm run test -- src/tests/proxy.test.ts`
- Full suite green (no collateral regression): `npm run test`

#### Manual Verification:

- Logging in with valid credentials lands on `/dashboard`.
- Registering a fresh account lands on `/dashboard`.
- An already-authenticated user navigating to `/login` is bounced to `/dashboard`.
- Logout still returns to `/login`; unauthenticated access to a protected route still goes
  to `/login`; auth error messages still display (FR-023 — no regression).
- Behavior is identical in both Polish and English locales (the dashboard is locale-aware
  from S-04; this change adds no user-facing copy).

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `signIn` success → `redirect("/dashboard")` (updated assertion).
- `signUp` fresh-success → `redirect("/dashboard")` (updated assertion).
- Proxy authenticated `/login` → `/dashboard` 307 (updated assertion).

### Integration Tests:

- None added. The change is a redirect-target flip with no DB or infra dependency; the
  existing mocked unit assertions are the right cost × signal layer (a real-infra test would
  add setup cost without new signal).

### Manual Testing Steps:

1. From a signed-out state, log in → confirm URL is `/dashboard`.
2. From a signed-out state, register a new email → confirm URL is `/dashboard`.
3. While signed in, manually navigate to `/login` → confirm bounce to `/dashboard`.
4. Sign out → confirm return to `/login`; attempt to open `/plan` while signed out → confirm
   redirect to `/login` (gating preserved).
5. Toggle locale to the other language and repeat step 1 → confirm identical behavior.

## Performance Considerations

None. No added work on any request path; the proxy still performs one session refresh and one
conditional redirect exactly as before.

## Migration Notes

None. No data, schema, or config migration. Pure behavioral change to redirect targets.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-05)
- PRD: FR-009 (post-auth redirect), FR-023 (existing auth preserved) — `context/foundation/prd.md`
- Destination (S-04): `context/archive/2026-06-10-welcome-dashboard/`
- Redirect sites: `src/lib/auth/actions.ts:34,63`, `src/proxy.ts:6,37`
- Regression assertions: `src/tests/lib/auth/actions.test.ts:65,108`, `src/tests/proxy.test.ts:90`
- Lesson (gating is deny-by-default): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Flip post-auth landing to the dashboard

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — ce5e16a
- [x] 1.2 Linting passes: `npm run lint` — ce5e16a
- [x] 1.3 Auth action tests pass with the new target: `npm run test -- src/tests/lib/auth/actions.test.ts` — ce5e16a
- [x] 1.4 Proxy tests pass with the new target: `npm run test -- src/tests/proxy.test.ts` — ce5e16a
- [x] 1.5 Full suite green: `npm run test` — ce5e16a

#### Manual

- [x] 1.6 Logging in lands on `/dashboard`
- [x] 1.7 Registering a fresh account lands on `/dashboard`
- [x] 1.8 Authenticated user revisiting `/login` is bounced to `/dashboard`
- [x] 1.9 Logout → `/login`, gating, and auth error messages all still work (FR-023 no regression)
- [x] 1.10 Behavior identical in both locales
