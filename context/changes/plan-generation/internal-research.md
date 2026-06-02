---
date: 2026-06-01T00:00:00Z
researcher: damianjakubas
git_commit: bb96a4c2b139151c46e42df77760b8144d30437a
branch: plan-generation
repository: adaptive-plan
topic: "Is docs-research.md compatible with the codebase for implementing S-02?"
tags: [research, codebase, compatibility, s-02, ai-sdk, drizzle, react-hook-form, next-intl]
status: complete
last_updated: 2026-06-01
last_updated_by: damianjakubas
---

# Research: Is `docs-research.md` compatible with the codebase for S-02?

**Date**: 2026-06-01
**Researcher**: damianjakubas
**Git Commit**: bb96a4c2b139151c46e42df77760b8144d30437a
**Branch**: plan-generation
**Repository**: adaptive-plan

> Internal codebase audit (complements the external `research.md` and doc-verified
> `docs-research.md`). Answers *"does our codebase already do what those external
> docs assume?"* before `/10x-plan plan-generation`.

## Research Question

Review the codebase and decide whether `context/changes/plan-generation/docs-research.md`
(doc-verified library API reference) is compatible with what already exists, in order
to implement **S-02 — plan generation** (US-01, FR-003/004/005/006) from `roadmap.md`.

## Summary

**Verdict: COMPATIBLE — green light for `/10x-plan`, with 6 corrections/notes to fold into the plan.**

`docs-research.md`'s technical guidance is sound and matches the locked stack
(Next 16.2.6 / React 19.2.4 / TS 5 / Tailwind 4) and the conventions S-01 established.
The form stack it relies on is already installed at compatible versions; shadcn,
Supabase, and `next-intl` are already wired. The AI + persistence libraries it lists
as "net-new" are genuinely absent — consistent with the doc, not a contradiction.

Nothing in the doc conflicts with the codebase in a blocking way. The corrections
below are about **alignment with existing conventions** (i18n, error handling,
server-action-vs-API-route, proxy behaviour on API routes) and **one stale claim**
(zustand is *not* actually installed).

### Compatibility scorecard

| docs-research claim | Codebase reality | Verdict |
| --- | --- | --- |
| RHF v7 | `react-hook-form@^7.76.1` | ✅ match (`package.json:25`) |
| `@hookform/resolvers` **must be v5+** | `^5.4.0` | ✅ match |
| Zod (resolver auto-detects v3/v4) | `zod@^4.4.3` (v4) | ✅ match |
| Next 16 / React 19 | `next@16.2.6`, `react@19.2.4` | ✅ match |
| shadcn `Form`/`FormField`/`FormControl` | already used in auth, components installed | ✅ match |
| shadcn install via CLI (`form select input`) | `form`,`input`,`label` present; `select` net-new | ✅ compatible |
| `ai` v6, `@ai-sdk/react`, gateway | **absent** (listed net-new) | ✅ consistent |
| `drizzle-orm` + `postgres` + `drizzle-kit` | **absent** (listed net-new, deferred to S-02) | ✅ consistent |
| `prepare: false` on Supabase txn pooler `:6543` | not yet wired; Supabase pg v17 confirmed | ✅ correct guidance |
| `DATABASE_URL` (runtime) + `DIRECT_URL` (migrations) | only `NEXT_PUBLIC_SUPABASE_*` exist today | ⚠️ net-new env vars |
| zustand "already in stack" | **NOT installed** | ❌ stale claim (net-new if needed) |
| API route `app/api/generate-plan/route.ts` | S-01 used server actions, no API routes exist | ⚠️ justified new pattern |
| `handleApiError` (mentioned in CLAUDE.md) | does not exist; `mapAuthError` + toast used | ⚠️ follow real pattern |
| hardcoded English form labels in examples | everything is i18n'd via `next-intl` | ⚠️ must localize |

## Detailed Findings

### 1. Form stack — already present & compatible (FR-003)

The doc's §3 form guidance maps directly onto what S-01 built.

- `react-hook-form@^7.76.1`, `@hookform/resolvers@^5.4.0`, `zod@^4.4.3` are installed
  (`package.json:25,13,29`). The doc's "resolvers must be v5+" constraint is satisfied,
  and its note that `zodResolver` auto-detects Zod v4 holds.
- The exact RHF + `zodResolver` + shadcn `Form` pattern the doc shows is already in use:
  - `src/components/auth/auth-card.tsx` — `useForm({ resolver: zodResolver(schema), defaultValues })`, wrapped in shadcn `Form` → `FormField` → `FormItem` → `FormLabel` → `FormControl`.
  - Schema lives in `src/lib/validation/auth.ts` (`signInSchema`, `signUpSchema`, inferred types), shared by client form and server action — exactly the "shared schema" shape the doc wants for the plan schema.
- shadcn is configured (`components.json`, style `radix-nova`, aliases `@/components/ui`, `@/lib`). Installed UI components: `button`, `form`, `input`, `label`, `tabs`, `sonner`. So `npx shadcn@latest add form select input` only needs to **add `select`** (and likely `textarea`/`radio-group`/`slider` for the 12 fields) — `form`/`input` already present.

**Note (convention):** auth-card renders errors with a custom `<p>{tValidation(error.message)}</p>` (i18n key lookup) rather than shadcn `FormMessage`. S-02 should follow the established custom-i18n-error approach for consistency. The doc's `FormMessage`/`Field`/`FieldError` examples are illustrative, not the house pattern.

### 2. AI generation libraries — net-new, as the doc states (FR-004/005)

`ai`, `@ai-sdk/react`, `@ai-sdk/gateway`, and any `@ai-sdk/anthropic|openai` are **absent** from `package.json` and `package-lock.json`. This is exactly what the doc's "Net-new dependencies" list says, so there is no contradiction — they are installed during S-02.

**Caveat:** because `ai` is not installed, the doc's v6 API claims (`streamText` + `Output.object({ schema })` + `result.toTextStreamResponse()`, and `experimental_useObject`) could not be verified against `node_modules`. They are doc-verified via Context7 in `docs-research.md`. **Action at install time:** confirm the resolved `ai` version actually exports `Output` and `@ai-sdk/react` exports `experimental_useObject`, since the `experimental_` prefix means the surface can shift across minors.

### 3. Persistence — net-new, deferred from S-01 (FR-006)

No Drizzle/postgres client, no `drizzle.config.ts`, no schema, no migrations exist. S-01 explicitly deferred all of this ("No Drizzle — deferred to S-02; Supabase-managed `auth.users` covers this slice"). So the doc's §4 is forward guidance, not a conflict.

- `supabase/config.toml` confirms Postgres `major_version = 17`; local pooler `enabled = false` (remote Supabase pooler is used in prod). The doc's `prepare: false` requirement for the transaction pooler (`:6543`) is the correct production guidance.
- **Env var gap:** code currently only references `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/supabase/server.ts:12-13`, `client.ts`). The doc's `DATABASE_URL` (pooled runtime) and `DIRECT_URL` (migrations) are **net-new** and must be added to `.env*` + Vercel. (`.env*` files are permission-blocked from direct reading; this is inferred from code references.)
- RLS is undecided (no custom tables yet). The doc correctly leaves RLS on/off open for `/10x-plan`.

### 4. AI SDK uses an API route — a justified deviation from S-01's server-action convention

S-01 did **all** mutations via server actions (`src/lib/auth/actions.ts`, `"use server"`, returning `{ ok: false; code }`); there are **zero** `route.ts` handlers in the repo. The doc proposes the first API route (`app/api/generate-plan/route.ts`) with `export const maxDuration` + POST.

This is **correct and necessary** — `experimental_useObject` consumes an HTTP streaming endpoint; server actions don't stream partial objects to the client. So introducing the first API route is justified, but the plan should call it out as an intentional new pattern and keep the failure-path response aligned with the `{ ok, code }` + sonner-toast convention from S-01.

### 5. Route protection — proxy gates `/api`, but as a redirect (needs an explicit auth check)

`src/proxy.ts` uses the deny-by-default `PUBLIC_ROUTES = ["/", "/login"]` allowlist (matches `lessons.md`), and its matcher (`src/proxy.ts:54-60`) excludes only static assets — so it **does** run on `/api/generate-plan`. A new `/plan` page and the API route are therefore protected automatically (no proxy edit needed).

**However:** for an unauthenticated request the proxy returns a **302 redirect to `/login`** (`src/proxy.ts:26-27`), not a `401`. A `fetch`/`useObject` call that gets a 302→HTML login page will break stream parsing. **Action:** the route handler must still call `supabase.auth.getUser()` and return a real `401` itself, rather than relying on the proxy redirect. (Per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing the Next 16 route handler / touching middleware.)

### 6. i18n — labels must go through `next-intl`, not be hardcoded

The doc's form examples use hardcoded English (`"Spoken Language"`, etc.). The codebase localizes **everything**: `next-intl@^4.13.0`, catalogs at `src/i18n/messages/{en,pl}.json`, server components use `getTranslations()` and client components use `useTranslations()` (enforced by `lessons.md`). Validation messages are stored as i18n keys in the Zod schema (`z.email({ message: "invalid_email" })`) and resolved in the component.

**Action:** S-02 must add a `Plan` (and plan-validation) namespace to both catalogs and route every label/error through `next-intl`. This also de-risks S-03 (locale support), which builds on S-02. The doc's examples are fine as API illustrations but should not be copied verbatim.

### 7. Stale claim — zustand is not installed

`research.md` §4 and `docs-research.md` treat `zustand` as "already in tech-stack.md". It is **not** in `package.json`. Practically harmless: both docs correctly advise reaching for it only if state must live outside `useObject` (which exposes `{ object, submit, isLoading, stop }`). If the plan does need it, it is **net-new**, not pre-installed.

### 8. Error handling — `handleApiError` doesn't exist

`CLAUDE.md` rule 6 references a `handleApiError` helper, but the codebase uses `mapAuthError` (`src/lib/auth/errors.ts`) + localized error codes + `toast.error(t(code))` (sonner, already wired in `src/app/layout.tsx`). `docs-research.md` doesn't depend on `handleApiError`, so no conflict — but S-02's error handling should follow the real `{ ok, code }` + toast pattern, not invent a generic helper.

## Code References

- `package.json:12-46` — installed deps; confirms RHF/resolvers/zod present, AI/Drizzle/zustand absent
- `components.json` — shadcn config (style `radix-nova`, aliases); `src/components/ui/` has `form`,`input`,`label`,`button`,`tabs`,`sonner`
- `src/components/auth/auth-card.tsx` — RHF + `zodResolver` + shadcn `Form` reference implementation; custom i18n error rendering
- `src/lib/validation/auth.ts` — `*-schema.ts` shared-schema convention with i18n message keys
- `src/lib/auth/actions.ts` — server-action mutation pattern returning `{ ok, code }`
- `src/lib/auth/errors.ts` — `mapAuthError` + error-code pattern (the real "handleApiError")
- `src/lib/supabase/server.ts:12-13` — only `NEXT_PUBLIC_SUPABASE_*` env vars used today
- `src/proxy.ts:9,20-27,54-60` — deny-by-default allowlist; matcher covers `/api`; unauth → 302 redirect
- `src/i18n/messages/{en,pl}.json`, `next.config.ts` — next-intl wiring
- `supabase/config.toml` — Postgres v17; local pooler disabled
- `next.config.ts` — minimal (next-intl plugin only); no serverActions/experimental flags, safe to add a route handler

## Architecture Insights

- The codebase consistently follows the CLAUDE.md/AGENTS.md conventions: kebab-case files, schemas in `src/lib/validation/*-schema.ts`-style, helpers out of component files, `"use client"` pushed down, props inlined/after the component, deny-by-default route gating, full i18n.
- S-02 is additive: it reuses the form/validation/i18n/supabase scaffolding from S-01 and introduces three genuinely new capabilities (AI streaming via the AI SDK, an API route, and the Drizzle persistence layer) — each of which the roadmap already scoped to this slice.
- The single real deviation (API route vs server action) is forced by streaming and is appropriate.

## Historical Context (from prior changes)

- `context/changes/plan-generation/research.md` — external library selection (what to use); lists the same net-new deps and open decisions.
- `context/changes/plan-generation/docs-research.md` — doc-verified API reference (how to use it), the subject of this audit.
- `context/foundation/roadmap.md:67-77` — S-02 scope, prerequisites (S-01 done), risks.
- `context/foundation/lessons.md` — deny-by-default route gating + `getTranslations` in server components; both confirmed live in the codebase and reinforced by this audit.
- Auth-flow slice (S-01, commit d1d5dd5) explicitly deferred Drizzle/DB to S-02 — consistent with the absence findings above.

## Related Research

- `context/changes/plan-generation/research.md`
- `context/changes/plan-generation/docs-research.md`

## Open Questions

These remain for `/10x-plan` (carried from both research docs, unaffected by this audit):

1. **Model string** — which `'provider/model'` + whether to set `providerOptions.gateway` routing/fallback.
2. **FR-006 schema shape** — overwrite-in-place vs insert + `is_active` flag.
3. **RLS on/off** — server-only (RLS off, documented) vs RLS-aware client.
4. **Plan output Zod schema** — the shared schema driving both `Output.object` and `useObject`.
5. **Form reset strategy** — given RHF #13110, only if the form clears after generation.

New items surfaced by this audit, to resolve in `/10x-plan`:

6. **API-route auth** — add explicit `supabase.auth.getUser()` → 401 in the route handler (proxy only 302-redirects).
7. **Env vars** — add `DATABASE_URL`, `DIRECT_URL`, `AI_GATEWAY_API_KEY` to `.env*` + Vercel.
8. **i18n namespace** — add `Plan` + plan-validation keys to `src/i18n/messages/{en,pl}.json`.
9. **zustand** — install only if state must live outside `useObject` (it is *not* currently installed).
