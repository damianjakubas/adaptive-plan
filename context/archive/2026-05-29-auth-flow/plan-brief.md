# Auth Flow (S-01) — Plan Brief

> Full plan: `context/changes/auth-flow/plan.md`

## What & Why

Build AdaptivePlan's authentication foundation: email + password **registration, login, and logout** (FR-001/002/007). It's the prerequisite for everything — plans are persisted per user, and all generation/viewing routes are gated behind login. As the first UI slice, it also lands the shared foundations later slices reuse.

## Starting Point

A bare Next.js 16 scaffold: placeholder home page, default Tailwind theme, Geist fonts. Supabase is half-wired (config + env keys present, `enable_confirmations=false` already set locally) but no auth code, no design system, no i18n, no test runner, and none of the planned libraries installed. shadcn CLI is present but not initialized.

## Desired End State

A visitor registers with email/password, is immediately signed in (no email step), lands on a protected placeholder dashboard, can log out and back in. Unauthenticated access to protected routes redirects to the auth page (and vice-versa). The UI renders in Polish or English via a header toggle, styled to the DESIGN.md neon-lime-on-black system, realizing the approved login mockup. Zod schema, server actions, and the auth form are tested.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| OAuth (Google/Apple) | Deferred to post-MVP | Not in PRD; per-provider setup is heavy for the after-hours budget | Plan |
| Forgot-password link | Omitted entirely | Not a functional requirement; no email delivery set up | Plan |
| Locale (PL/EN) | **Pulled into this slice** | User wants the switch now; this slice owns the i18n foundation | Plan |
| i18n approach | next-intl, cookie-based (no URL prefix) | No route restructuring; composes cleanly with auth middleware | Plan |
| Email confirmation | Auto-confirm (disabled) | Fastest working flow; no SMTP setup; matches `config.toml:221` | Plan |
| Design system | Full foundation now (shadcn + theme + fonts) | Reused by every later slice; AGENTS.md mandates shadcn + MCP | Plan |
| Auth UI shape | Single page, tabbed | 1:1 with the approved mockup | Plan |
| Auth mutations | Server Actions + `@supabase/ssr` | Idiomatic Next 16; server-side cookies; pairs with RHF | Plan |
| Routing | Route groups `(auth)` / `(app)` + placeholder dashboard | Establishes the gate pattern S-02 plugs into | Plan |
| Validation | Zod + React Hook Form | In the stack; one schema reused client + server; reused by S-02's big form | Plan |
| Errors | Inline field errors + Sonner toasts, localized | Clear UX; distinguishes failure modes; respects i18n | Plan |
| Testing | Vitest + RTL harness + focused tests | Auth is security-sensitive; harness reused by all later slices | Plan |
| Drizzle / user table | Deferred to S-02 | Roadmap sequences Drizzle there; `auth.users` suffices | Roadmap |

## Scope

**In scope:** email/password register/login/logout · Supabase SSR clients + session-refresh/gating middleware · DESIGN.md system + shadcn init · PL/EN i18n layer (cookie-based) applied to auth + dashboard · placeholder protected dashboard · Vitest/RTL harness + tests.

**Out of scope:** OAuth · password reset · email confirmation · Drizzle/migrations/custom tables · parameter form & plan generation (S-02) · full-app i18n rollout (S-03).

## Architecture / Approach

`@supabase/ssr` with a browser client and a cookies-bound server client. A single `middleware.ts` refreshes the session and gates routes (preserving refreshed auth cookies). Forms (RHF + zodResolver on a shared Zod schema) submit to `"use server"` actions that call Supabase and redirect; failures return mapped codes resolved to localized inline errors + toasts. next-intl resolves locale from a `NEXT_LOCALE` cookie set by a header toggle.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Foundation & design system | Deps, shadcn, DESIGN.md theme+fonts, next-intl PL/EN, Supabase clients | Tailwind 4 token port + shadcn init friction |
| 2. Auth backend | Zod schema, sign-up/in/out actions, gating middleware, placeholder dashboard | Next.js 16 middleware + cookie-preservation gotcha |
| 3. Auth UI | Tabbed login/register page (mockup), locale toggle, toasts, logout | Faithfully porting the mockup; RHF↔action wiring |
| 4. Testing & verification | Vitest/RTL harness + schema/action/form tests; e2e pass | Mocking the Supabase SSR client |

**Prerequisites:** Linked Supabase project (present) with email confirmation disabled in its dashboard; Supabase + AI env keys (present).
**Estimated effort:** ~3–4 after-hours sessions across 4 phases.

## Open Risks & Assumptions

- **Next.js 16 middleware specifics** — must read `node_modules/next/dist/docs/` before writing the session/gating middleware (AGENTS.md); cookie preservation on redirects is the easy thing to get wrong.
- **Hosted vs local Supabase** — local `config.toml` disables confirmations, but the hosted project needs the same toggle in its dashboard or registration won't auto-sign-in.
- **i18n pulled forward** — this slice now owns the routing-strategy decision the roadmap parked for S-03; S-03 continues the rollout to remaining pages on this foundation.

## Success Criteria (Summary)

- A user can register, log in, and log out; unauthenticated users are redirected to the auth page.
- The auth UI matches the mockup, is themed per DESIGN.md, and works fully in both Polish and English.
- `npm run build`, `npx tsc --noEmit`, `npm run lint`, and `npm run test` all pass.
