# Plan Generation (S-02) — Plan Brief

> Full plan: `context/changes/plan-generation/plan.md`
> Research: `context/changes/plan-generation/research.md`

## What & Why

The product's north-star slice (US-01): a logged-in user fills a 12-field parameter form and receives an LLM-generated personalized training plan — routine, calorie target, progression, timeline — streamed with visible progress, with the latest plan kept as their single active plan. This is the capability that proves the product idea; everything else (auth, locale) exists to support it.

## Starting Point

S-01 (auth) is done and sets the patterns to mirror: server actions with typed `{ ok, code }` results, shared Zod schemas with i18n-key errors, shadcn `Form` + RHF, `getTranslations()`/`useTranslations()`, deny-by-default route gating, Supabase `getUser()`. Most deps (`ai@6`, `@ai-sdk/react`, RHF, resolvers v5, zod, next-intl) are already installed. **Drizzle is not yet installed** and there are no app tables — the only net-new pieces are Drizzle (`drizzle-orm`/`postgres`/`drizzle-kit`) and the Gemini provider (`@ai-sdk/google`).

## Desired End State

A user visits `/plan/new`, completes a 4-step wizard, submits, sees an abstract generation loader within ~2s, and lands on `/plan` showing a structured personalized plan (weekly schedule, exercises, calories, progression, timeline, dietary tips) with a visible not-medical-advice disclaimer. The plan is persisted as the single active plan and survives re-login; generating again replaces it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Streaming transport | Route Handler + `experimental_useObject` | Research-verified AI SDK v6 path; real streaming + a server-side persistence hook | Research / Plan |
| Generation display | Abstract loader (ring + quotes), reveal on complete | Faithful to the approved design; no DeepPartial guarding on-screen | Plan |
| Persistence timing | Server-side in `streamText` `onFinish` | Client disconnect/navigation can't lose the plan | Plan |
| FR-006 model | Insert + `is_active` flag (transactional flip) | Non-destructive, trivial future history path, "latest replaces" = a flag flip | Plan |
| What's persisted | Plan + 12-input snapshot (JSONB on the row) | Explainability + "references inputs" guardrail, no extra tables | Plan |
| Security | RLS off, documented; server-only `user_id` scoping | Meets no-leak guardrail without jwt-in-transaction plumbing under a 3-week timeline | Plan |
| Plan output schema | Fully structured (matches the plan view) | Drives both `Output.object` and the rich design view directly | Plan |
| Model | Free Gemini direct (`@ai-sdk/google`, `gemini-2.5-flash`) | User wants free; best structured-output reliability among free options | User / Plan |
| Form UX | 4-step wizard (per design), per-step validation | Faithful to design; lowers cognitive load over 12 fields | Plan |
| Failure handling | Toast + return to form, inputs preserved | Mirrors S-01; graceful given likely free-tier rate limits | Plan |
| Post-gen nav | Navigate to `/plan`, form unmounts | Matches 3-screen design and sidesteps the RHF #13110 reset bug | Plan |

## Scope

**In scope:** Drizzle + `plans` table; shared input/output Zod schemas; streaming generation route on free Gemini; 4-step wizard form (12 fields); abstract streaming loader; structured active-plan view + disclaimer; persistence (latest = active); PL/EN UI copy.

**Out of scope:** Locale of *generated output* (FR-008 / S-03 — prompt is locale-ready only); plan history; reusable profile table / prefill; RLS policies; session mode, meal planning, progress tracking, social (PRD non-goals).

## Architecture / Approach

Bottom-up, each phase testable: **persistence** (Drizzle client with `prepare:false` on the `:6543` pooler, direct URL for migrations; `plans` table; `getActivePlan` / transactional `saveActivePlan`) → **generation route** (`POST /api/plan/generate`: auth → validate input → `streamText` + `Output.object` on `gemini-2.5-flash` → persist user-scoped in `onFinish` → `toTextStreamResponse`) → **wizard form** → **read-only plan view** → **streaming flow** wiring form → route → view via `useObject`. Persistence is server-side so client disconnects can't lose the plan; one shared Zod schema is the single source of truth for route and client.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Persistence foundation | Drizzle + `plans` table + query helpers, migrated | Pooler `prepare:false` / dual connection strings; fails only in serverless if wrong |
| 2. Schemas + generation route | Shared Zod + prompt + streaming route persisting in `onFinish` | Free model may violate deep schema; `onFinish` persistence ordering |
| 3. Parameter form wizard | 4-step validated form + page + i18n | Per-step `trigger()` validation + single form state across steps |
| 4. Active-plan display view | Structured `/plan` view + disclaimer + nav | View fidelity to design with optional/partial fields |
| 5. Streaming generation flow | `useObject` wiring + loader + nav + error handling | End-to-end glue; RHF #13110 (avoided by unmount-on-success) |

**Prerequisites:** S-01 done (✓); Supabase project must expose both pooler (`:6543`) and direct connection strings; a free `GOOGLE_GENERATIVE_AI_API_KEY`.
**Estimated effort:** ~4–5 after-hours sessions across 5 phases.

## Open Risks & Assumptions

- **Provider deviation:** research assumed the Vercel AI Gateway; going free with `@ai-sdk/google` loses Gateway failover/caching/observability and is subject to free-tier rate limits. Reverting is a one-line model-string change.
- **Free model + deep schema:** smaller free models may break a deeply nested schema; mitigated by `safeParse` in `onFinish` + a `generation_failed` path, and the option to flatten to hybrid structured+prose.
- **RLS off:** isolation relies on server-side `user_id` scoping; a query that forgets the scope is the failure mode to watch in review.
- **Assumes** both Supabase connection strings are available before the Phase 1 migration.

## Success Criteria (Summary)

- A logged-in user submits the form and receives a personalized plan that visibly references their goal, health issues, and equipment, with a disclaimer shown.
- The latest plan is persisted as the active plan and accessible after re-login; regenerating replaces it (exactly one active row per user).
- Continuous visible progress during generation (acknowledgment within ~2s, no blank/unresponsive state).
