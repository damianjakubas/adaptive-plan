# Auth Flow (S-01) Implementation Plan

## Overview

Establish the authentication foundation for AdaptivePlan: email + password **registration, login, and logout** (FR-001, FR-002, FR-007) via Supabase Auth using the `@supabase/ssr` cookie-session pattern. Because this is the first UI slice, it also lands the cross-cutting foundations every later slice reuses: the shadcn + DESIGN.md design system (neon-lime-on-black theme, Montserrat/Inter fonts), a PL/EN internationalization layer (next-intl, cookie-based), the Supabase browser/server clients, route-gating middleware, and a Vitest + React Testing Library harness.

## Current State Analysis

- **Bare Next.js 16 scaffold.** `src/app/` contains only a placeholder `page.tsx` ("TEST"), a generic `layout.tsx` (Geist fonts), and default Tailwind 4 `globals.css` (`src/app/globals.css:1`). None of the planned stack is installed (`package.json` has only `next`, `react`, `react-dom`; `shadcn` CLI is a devDependency but **not initialized** — no `components.json`).
- **Supabase half-wired.** `supabase/config.toml` exists; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already populated in `.env.development.local`. `enable_confirmations = false` is already set under `[auth.email]` (`supabase/config.toml:221`). No DB schema/migrations exist; **no Drizzle** — per the roadmap, Drizzle and any custom tables are deferred to S-02, and Supabase-managed `auth.users` covers this slice.
- **Design ready but unapplied.** `context/foundation/DESIGN.md` defines the full token set; `context/foundation/design/logowanie_rejestracja/{screen.png,code.html}` is a complete split-screen login/register mockup (tabs, glassmorphism, neon-lime CTA). The theme/fonts are not yet in `globals.css`/`layout.tsx`.
- **Next.js 16 middleware caveat.** `AGENTS.md` warns of breaking changes and instructs reading `node_modules/next/dist/docs/` before writing middleware/server-component code — directly relevant since `@supabase/ssr` refreshes sessions in middleware.
- **No test runner.** `package.json` exposes only `lint`.

## Desired End State

A visitor can register with email + password, is immediately signed in (auto-confirm, no email step), lands on a protected placeholder dashboard, can log out, and can log back in. Unauthenticated access to protected routes redirects to the auth page; an authenticated user visiting the auth page is redirected to the dashboard. The entire UI renders in Polish or English via a header locale toggle, styled per DESIGN.md. The Zod schema, auth server actions, and auth form are covered by tests.

**Verify:** `npm run build` and `npx tsc --noEmit` pass; `npm run lint` passes; `npm run test` passes; manual flow (register → dashboard → logout → login) works against the linked Supabase project in both locales.

### Key Discoveries:

- Auto-confirm already set locally: `supabase/config.toml:221` (`enable_confirmations = false`). The **hosted** Supabase project (the URL in env) must have "Confirm email" disabled in its dashboard to match.
- `@supabase/ssr` requires two clients (browser + server) and middleware-based token refresh — the canonical Next.js App Router pattern.
- The mockup (`logowanie_rejestracja/code.html`) is directly portable: it already uses DESIGN.md token names (`bg-surface-container`, `text-primary-container`, `glass-panel`, `input-dark`) and Montserrat/Inter.
- next-intl supports a cookie-based locale (no URL prefix) by reading the cookie inside `getRequestConfig`, which composes cleanly with the Supabase session middleware.

## What We're NOT Doing

- **No OAuth** (Google/Apple) — deferred to post-MVP; social buttons omitted from the UI.
- **No password reset** — the "forgot password" link is omitted entirely (not stubbed).
- **No email confirmation flow** — registrations are auto-confirmed.
- **No Drizzle, no migrations, no custom user/profile table** — deferred to S-02; rely on `auth.users`.
- **No parameter form or plan generation** — that is S-02. The post-login page is an interim placeholder.
- **No URL-prefixed i18n routing** — cookie-based locale only. Full i18n rollout to all pages continues in S-03; this slice establishes the layer and applies it to auth + dashboard.

## Implementation Approach

Build foundations first (deps, design system, i18n, Supabase clients) so the auth backend and UI have everything they depend on, then wire the backend (config, validation, actions, middleware + gate target), then the UI realizing the mockup, then the test harness and end-to-end verification. Auth mutations run through **Server Actions** using the SSR server client; the client form uses **React Hook Form + zodResolver** sharing one Zod schema with the server action. Errors surface two ways: **inline field-level** (RHF/Zod) and **toast** (Sonner) for action-level failures/success, all localized.

## Critical Implementation Details

- **Middleware composition (load-bearing ordering).** A single `middleware.ts` must both refresh the Supabase session (via `@supabase/ssr`, which reads/writes cookies on the request/response) **and** apply route gating. The Supabase response object carries refreshed auth cookies — gating redirects must be built so they preserve those `Set-Cookie` headers (copy cookies onto any `NextResponse.redirect`). Getting this order wrong silently drops sessions. Read `node_modules/next/dist/docs/` for Next.js 16 middleware specifics before writing this file (per AGENTS.md).
- **next-intl cookie resolution.** With no URL locale segment, `getRequestConfig` reads a `NEXT_LOCALE` cookie (default `pl`) to choose the message catalog. The locale toggle is a client action that writes the cookie and refreshes.

---

## Phase 1: Foundation & design system

### Overview

Install the slice's dependencies, initialize shadcn, apply the DESIGN.md system, stand up the next-intl PL/EN layer, and create the Supabase clients. No auth behavior yet — this phase produces a themed, localized, dependency-complete shell.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add the runtime and dev dependencies this slice needs.

**Contract**: Runtime — `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `react-hook-form`, `@hookform/resolvers`, `next-intl`. Dev/test — `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react`. Add a `"test": "vitest"` script. Install with npm only (AGENTS.md).

#### 2. shadcn initialization + components

**File**: `components.json` (new), `src/components/ui/*`

**Intent**: Initialize shadcn and add the primitives the auth UI and toasts need. Use the shadcn MCP server (per AGENTS.md) to fetch current component sources.

**Contract**: Run shadcn init configured for Tailwind 4 + the project's path alias (`@/*`). Add components: `button`, `input`, `label`, `tabs`, `form`, `sonner`. The init must not clobber the DESIGN.md tokens added below.

#### 3. Design tokens + fonts

**File**: `src/app/globals.css`, `src/app/layout.tsx`

**Intent**: Replace the default Tailwind theme with the DESIGN.md system and load the brand fonts.

**Contract**: Port the `colors`, `rounded`, and `spacing` tokens from `DESIGN.md` frontmatter into the Tailwind 4 `@theme` block in `globals.css`, plus the `glass-panel` / `input-dark` utility styles from `logowanie_rejestracja/code.html`. Swap Geist for `Montserrat` (headlines) and `Inter` (body) via `next/font/google` in `layout.tsx`; set the dark, high-contrast base background. Keep CSS variable names aligned with the mockup's class names so the markup ports directly.

#### 4. next-intl layer (cookie-based)

**File**: `src/i18n/request.ts` (new), `src/i18n/messages/pl.json` (new), `src/i18n/messages/en.json` (new), `next.config.ts`, `src/app/layout.tsx`, `src/components/locale-toggle.tsx` (new)

**Intent**: Establish PL/EN message catalogs resolved from a cookie, expose them to the tree, and provide a header toggle. Polish is the default to match the design.

**Contract**: `getRequestConfig` reads the `NEXT_LOCALE` cookie (fallback `pl`) and loads the matching catalog. Wrap the app in `NextIntlClientProvider` in `layout.tsx`. Wire the next-intl plugin in `next.config.ts`. `locale-toggle.tsx` is a client component that sets the cookie and triggers a refresh. Seed catalogs with the auth + dashboard keys used in Phase 3 (tab labels, field labels, button copy, error messages, dashboard greeting/logout).

#### 5. Supabase clients

**File**: `src/lib/supabase/client.ts` (new), `src/lib/supabase/server.ts` (new)

**Intent**: Provide the browser and server Supabase clients per the `@supabase/ssr` pattern.

**Contract**: `client.ts` exports a browser client via `createBrowserClient` using the public env vars. `server.ts` exports an async factory using `createServerClient` wired to Next.js `cookies()` (get/set/remove). Both read `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- `components.json` exists and `src/components/ui/{button,input,label,tabs,form,sonner}.tsx` are present

#### Manual Verification:

- The placeholder home page renders with the neon-lime-on-black theme and Montserrat/Inter fonts
- The locale toggle switches a sample translated string between PL and EN and persists across reload
- No console errors on load

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 2.

---

## Phase 2: Auth backend

### Overview

Wire the server side of auth: ensure auto-confirm, define the shared validation schema, implement the sign-up/sign-in/sign-out server actions with localized error mapping, and add middleware that both refreshes the session and gates routes. Create the protected placeholder route so the gate has a target.

### Changes Required:

#### 1. Auto-confirm configuration

**File**: `supabase/config.toml` (verify), hosted Supabase dashboard (manual)

**Intent**: Guarantee registration yields an immediate session with no email step, locally and in the linked project.

**Contract**: Confirm `enable_confirmations = false` under `[auth.email]` (already at `supabase/config.toml:221`). Document in the verification notes that the hosted project must have "Confirm email" disabled to match.

#### 2. Shared auth validation schema

**File**: `src/lib/validation/auth.ts` (new)

**Intent**: One Zod schema for email + password reused by the client form and the server actions.

**Contract**: Export `signInSchema` (email format, password non-empty) and `signUpSchema` (email format, password min length per Supabase policy). Error messages are i18n keys/codes resolved to localized strings, not hardcoded English. Export the inferred TS types.

#### 3. Auth server actions

**File**: `src/app/(auth)/actions.ts` (new) — or `src/lib/auth/actions.ts`

**Intent**: Implement `signUp`, `signIn`, `signOut` against the SSR server client, returning structured results the UI maps to inline errors + toasts.

**Contract**: Each action is a `"use server"` function. `signUp`/`signIn` validate input with the Zod schema, call `supabase.auth.signUp` / `signInWithPassword`, and on success redirect to the dashboard. On failure they return a typed result `{ ok: false, code }` where `code` maps to a localized message (invalid credentials, email-already-registered, weak-password, generic). `signOut` calls `supabase.auth.signOut` and redirects to the auth page. A small `mapAuthError` helper translates Supabase error shapes to the `code` set.

#### 4. Session-refresh + route-gating middleware

**File**: `middleware.ts` (new, project root), `src/lib/supabase/middleware.ts` (new helper)

**Intent**: Refresh the Supabase session on every matched request and redirect based on auth state, preserving refreshed auth cookies.

**Contract**: Helper builds a `createServerClient` bound to the request/response cookies, calls `getUser()`, and returns `{ response, user }`. `middleware.ts` uses it: unauthenticated request to a protected path → redirect to the auth route; authenticated request to the auth route → redirect to the dashboard. Redirect responses must carry over the Supabase `Set-Cookie` headers. Configure the `matcher` to exclude static assets and `_next`. (See Critical Implementation Details for the cookie-preservation gotcha.)

#### 5. Protected placeholder dashboard route

**File**: `src/app/(app)/dashboard/page.tsx` (new), `src/app/(app)/layout.tsx` (new)

**Intent**: Provide the post-login landing target — a minimal authenticated page S-02 will replace with the parameter form.

**Contract**: Server component that reads the current user from the server client and renders a localized greeting plus a logout control (wired in Phase 3). The `(app)` layout establishes the authenticated shell.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Visiting `/dashboard` while logged out redirects to the auth route
- A registration through a temporary test trigger creates a session and reaches `/dashboard` with no email step
- Logout clears the session and returns to the auth route
- After login, manually visiting the auth route redirects back to `/dashboard`

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 3.

---

## Phase 3: Auth UI

### Overview

Build the tabbed login/register page realizing the mockup, wire it to the server actions with RHF + Zod, surface errors inline and via Sonner toasts, mount the locale toggle, and finish the dashboard logout.

### Changes Required:

#### 1. Auth route group + page

**File**: `src/app/(auth)/login/page.tsx` (new), `src/app/(auth)/layout.tsx` (new)

**Intent**: Render the split-screen branding + tabbed auth panel from `logowanie_rejestracja/code.html`, localized and on-theme.

**Contract**: Server component page composing the branding panel (logo, headline, "Zasilane przez Supabase" line) and a client `AuthCard`. All copy comes from next-intl. The `(auth)` layout centers the card on the dark background. OAuth buttons and the forgot-password link are omitted.

#### 2. AuthCard (tabbed form)

**File**: `src/components/auth/auth-card.tsx` (new)

**Intent**: Client component with Zaloguj się / Zarejestruj się tabs, each an RHF form bound to the shared Zod schema, submitting to the corresponding server action.

**Contract**: Uses shadcn `tabs` + `form` + `input` + `label` + `button`. `useForm` with `zodResolver` on `signInSchema` / `signUpSchema`. Submit invokes the server action; field errors render inline; an action-level failure (mapped `code`) fires a localized Sonner toast; success fires a success toast before the action's redirect. Markup ports the mockup's classes (`glass-panel`, `input-dark`, neon-lime CTA).

#### 3. Locale toggle in the auth + app shells

**File**: `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx`

**Intent**: Expose the PL/EN toggle on both shells (the auth page has no navbar in the mockup, so place it discreetly in the layout header).

**Contract**: Mount `locale-toggle.tsx` (Phase 1) in both layouts.

#### 4. Toaster + logout wiring

**File**: `src/app/layout.tsx`, `src/app/(app)/dashboard/page.tsx`

**Intent**: Mount the Sonner `<Toaster />` globally and connect the dashboard logout control to the `signOut` action.

**Contract**: Add `<Toaster />` to the root layout. The dashboard logout is a form/button invoking `signOut`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- The login page matches the mockup (split-screen, tabs, glassmorphism, neon-lime CTA) with no OAuth/forgot-password elements
- Register a new account → toast + redirect to dashboard with a localized greeting
- Submitting a duplicate email shows the localized "email already registered" error (inline and/or toast)
- Submitting wrong credentials on login shows the localized invalid-credentials error
- Invalid email / short password show inline field errors before submit
- Logout returns to the auth page; full flow works in both PL and EN

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before Phase 4.

---

## Phase 4: Testing & verification

### Overview

Stand up the Vitest + RTL harness and add focused tests for the riskiest logic, then run the full end-to-end manual pass.

### Changes Required:

#### 1. Test harness

**File**: `vitest.config.ts` (new), `src/tests/setup.ts` (new)

**Intent**: Configure Vitest with the React plugin, jsdom environment, jest-dom matchers, and the `@/*` path alias.

**Contract**: `vitest.config.ts` registers `@vitejs/plugin-react`, `environment: "jsdom"`, and `setupFiles: ["src/tests/setup.ts"]`; setup imports `@testing-library/jest-dom`. `npm run test` runs the suite.

#### 2. Validation schema tests

**File**: `src/tests/lib/validation/auth.test.ts` (new)

**Intent**: Cover happy path and edge cases for `signInSchema` / `signUpSchema`.

**Contract**: Valid email/password pass; invalid email, empty/short password, missing fields fail with the expected error codes.

#### 3. Server action tests

**File**: `src/tests/lib/auth/actions.test.ts` (new)

**Intent**: Verify action logic with the Supabase client mocked.

**Contract**: Mock the SSR server client; assert `signIn`/`signUp` return the mapped error `code` on Supabase errors and redirect on success; assert `signOut` calls `auth.signOut`. `mapAuthError` covers each known case.

#### 4. Auth form render test

**File**: `src/tests/components/auth/auth-card.test.tsx` (new)

**Intent**: Confirm the form renders both tabs and shows inline validation errors.

**Contract**: Renders `AuthCard` (next-intl provider + actions mocked); both tab labels present; submitting an invalid email surfaces the field error.

### Success Criteria:

#### Automated Verification:

- Test suite passes: `npm run test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Full end-to-end flow against the linked Supabase project: register → dashboard → logout → login, in both PL and EN
- Confirm the hosted Supabase project has email confirmation disabled (matches local config)
- No regressions on the home page or theme

**Implementation Note**: After automated verification passes, pause for human confirmation of the end-to-end pass — this completes the slice.

---

## Testing Strategy

### Unit Tests:

- Zod `signInSchema` / `signUpSchema`: valid inputs, invalid email, empty/short password, missing fields
- `mapAuthError`: each Supabase error case → correct localized code

### Integration Tests:

- Auth server actions with a mocked Supabase client: success redirect + each error `code`
- `AuthCard` render: tabs present, inline validation error on bad input

### Manual Testing Steps:

1. Register a brand-new email → expect immediate session + redirect to `/dashboard` (no email step)
2. Log out → expect redirect to the auth page and a cleared session
3. Log back in with the same credentials → expect dashboard
4. Attempt registration with an existing email → expect localized "already registered" error
5. Attempt login with a wrong password → expect localized invalid-credentials error
6. Submit an invalid email / short password → expect inline field errors before any network call
7. Visit `/dashboard` while logged out → expect redirect to auth; visit auth while logged in → expect redirect to dashboard
8. Toggle PL ↔ EN and repeat a flow → expect all copy and errors localized

## Performance Considerations

Negligible. Auth is low-QPS (PRD `target_scale.qps: low`). The only per-request cost is the middleware session refresh; scope the `matcher` to exclude static assets and `_next` so it doesn't run on every asset.

## Migration Notes

No data migrations (no Drizzle, no custom tables this slice). The only environment step is ensuring the hosted Supabase project has email confirmation disabled to match `supabase/config.toml`. Rollback is a code revert plus, if desired, re-enabling email confirmation in the dashboard.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (FR-001, FR-002, FR-007; Access Control; NFR on data isolation)
- Design system: `context/foundation/DESIGN.md`
- Login mockup: `context/foundation/design/logowanie_rejestracja/{screen.png,code.html}`
- Auto-confirm setting: `supabase/config.toml:221`
- Next.js 16 middleware caveat: `AGENTS.md` → read `node_modules/next/dist/docs/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation & design system

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Production build succeeds: `npm run build`
- [x] 1.4 `components.json` and `src/components/ui/{button,input,label,tabs,form,sonner}.tsx` present

#### Manual

- [ ] 1.5 Home page renders with neon-lime theme + Montserrat/Inter fonts
- [ ] 1.6 Locale toggle switches a string PL↔EN and persists across reload
- [ ] 1.7 No console errors on load

### Phase 2: Auth backend

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Build succeeds: `npm run build`

#### Manual

- [ ] 2.4 `/dashboard` while logged out redirects to auth route
- [ ] 2.5 Registration creates a session and reaches `/dashboard` with no email step
- [ ] 2.6 Logout clears the session and returns to the auth route
- [ ] 2.7 Authenticated visit to the auth route redirects to `/dashboard`

### Phase 3: Auth UI

#### Automated

- [x] 3.1 Type checking passes: `npx tsc --noEmit`
- [x] 3.2 Linting passes: `npm run lint`
- [x] 3.3 Build succeeds: `npm run build`

#### Manual

- [ ] 3.4 Login page matches the mockup; no OAuth/forgot-password elements
- [ ] 3.5 Register → toast + redirect to dashboard with localized greeting
- [ ] 3.6 Duplicate email shows localized "already registered" error
- [ ] 3.7 Wrong credentials show localized invalid-credentials error
- [ ] 3.8 Invalid email / short password show inline field errors pre-submit
- [ ] 3.9 Full flow works in both PL and EN

### Phase 4: Testing & verification

#### Automated

- [x] 4.1 Test suite passes: `npm run test`
- [x] 4.2 Type checking passes: `npx tsc --noEmit`
- [x] 4.3 Linting passes: `npm run lint`
- [x] 4.4 Build succeeds: `npm run build`

#### Manual

- [ ] 4.5 End-to-end flow (register → dashboard → logout → login) in both PL and EN
- [ ] 4.6 Hosted Supabase project has email confirmation disabled
- [ ] 4.7 No regressions on home page or theme
