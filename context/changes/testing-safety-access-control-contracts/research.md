---
date: 2026-06-08T10:31:23Z
researcher: damianjakubas
git_commit: ceda7e73acc78a1d49c404e8d50672e4343229ba
branch: testing-safety-access-control-contracts
repository: adaptive-plan
topic: "Safety & access-control contracts (test rollout Phase 2) — Risk #2 (safety/disclaimer) and Risk #3 (IDOR + unauth)"
tags: [research, codebase, testing, safety-contract, disclaimer, idor, auth, proxy, rls, drizzle]
status: complete
last_updated: 2026-06-08
last_updated_by: damianjakubas
---

# Research: Safety & access-control contracts (test rollout Phase 2)

**Date**: 2026-06-08T10:31:23Z
**Researcher**: damianjakubas
**Git Commit**: ceda7e73acc78a1d49c404e8d50672e4343229ba
**Branch**: testing-safety-access-control-contracts
**Repository**: adaptive-plan

## Research Question

Ground the oracle for Phase 2 of `context/foundation/test-plan.md` — "Safety & access-control contracts" — covering:

- **Risk #2 (safety contract):** the not-medical-advice disclaimer reaches the user deterministically regardless of LLM output; the plan-content path respects stated health input. Decide whether the disclaimer is a static results component (cheap integration) or LLM-emitted (needs an eval).
- **Risk #3 (cross-user data exposure):** a request for *another* user's plan is denied (not merely that unauthenticated requests are denied), and gated routes deny-by-default. Ground the read/fetch path (filtered by owner, or only by login?) and the proxy gating model.

## Summary

**Risk #2 — disclaimer: SOLVED deterministically, with one untested branch.** The disclaimer is a **hybrid (BOTH)**: the model emits a `disclaimer` field, but a static React leaf (`plan-disclaimer.tsx`) renders a hardcoded i18n **fallback** whenever that field is empty/whitespace, and **always** renders a static i18n title. So a "not medical advice" string reaches the user regardless of LLM output — this is deterministically assertable, **no eval needed**. The load-bearing fallback branch (`plan-disclaimer.tsx:14`) is **currently untested** — the existing test only covers the happy path where the model supplies a disclaimer. This is the primary Risk #2 gap.

**Risk #2 — health-respect: irreducibly eval-shaped, no static net.** The prompt carries the health input and a "honor the stated health issues" instruction (deterministically testable, already lightly tested), but the **output schema has no `healthIssues` field** — health-respect manifests only as free text inside `summary`/exercise notes. There is no static fallback. So "the generated plan actually respects health" is only provable via an LLM-judge/eval. Flag this as the residual eval-shaped portion of Risk #2 (Lesson 2 boundary: an eval may be deferred or scoped tightly).

**Risk #3 — IDOR-by-id: structurally absent.** There is **no dynamic route segment** anywhere (`/plan/[id]`, `/api/plans/[id]` do not exist) and **no read path that accepts a plan id**. The single reader, `getActivePlan(userId)` (`src/db/plans.ts:10-19`), always filters `WHERE user_id = <session user> AND is_active`. The user id always comes from the verified Supabase session, never from a request parameter. Classic IDOR is not expressible.

**Risk #3 — ownership read: already substantially covered.** Contrary to the test-plan's "TBD" note in §6.3, a real-DB integration test already exists (`src/tests/db/plans.test.ts`) and **includes a two-user isolation test** (`:64-84`) asserting `getActivePlan(userA)` never returns userB's plan. Harness pattern (self-skip on missing `DATABASE_URL`, throwaway random user ids, scoped `afterEach` cleanup) is reusable. Hardening opportunity: the existing isolation test seeds only the *other* user; a **both-users-active** variant is a stronger mutation-killer (see Architecture Insights).

**Risk #3 — deny-by-default gating: correct in code, ZERO tests.** `src/proxy.ts` uses a `PUBLIC_ROUTES` allowlist (deny-by-default — complies with `lessons.md`). Unauthenticated page request → 307 redirect to `/login`; `/api/*` → 401 JSON `{ code: "unauthenticated" }`; authed user on `/login` → redirect to `/plan`. **No `proxy.test.ts` exists** — the deny-by-default contract is entirely uncovered. This is the single highest-signal gap for Risk #3's unauth face.

**Net: two real test gaps, neither needs new infra** — (1) the disclaimer fallback branch (component test) and (2) `src/proxy.ts` deny-by-default gating (hermetic test with mocked `updateSession`). Ownership read is largely covered and can be hardened with one stronger DB assertion. Health-respect is the lone eval-shaped item.

## Detailed Findings

### Risk #2 — Disclaimer (verdict: BOTH — LLM-emitted with deterministic static fallback)

The disclaimer the user sees flows through a hybrid path that is **always deterministically testable**.

Render location — `src/components/plan/plan-disclaimer.tsx:12-23` (single render point):

```tsx
function PlanDisclaimer({ disclaimer }: Props) {
  const t = useTranslations("Plan");
  const text = disclaimer?.trim() ? disclaimer : t("disclaimerFallback");  // line 14 — load-bearing
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{t("disclaimerTitle")}</AlertTitle>      // line 19 — ALWAYS static i18n
      <AlertDescription>{text}</AlertDescription>          // line 20 — LLM text OR static fallback
    </Alert>
  );
}
```

Contract:
- **Title** (`Plan.disclaimerTitle`) is **always** a static i18n message — never from the LLM.
- **Body** is the model's `plan.disclaimer` if non-empty after `trim()`, else the static i18n `disclaimerFallback`. Even if the LLM omits/empties the field, a "not medical advice" string still reaches the user. `plan-disclaimer.tsx:14` is the safety net.

i18n keys — `src/i18n/messages/en.json:100-101` / `src/i18n/messages/pl.json:100-101` (namespace `Plan`):
- `Plan.disclaimerTitle` — EN `"Health disclaimer"` / PL `"Zastrzeżenie zdrowotne"`
- `Plan.disclaimerFallback` —
  - EN: `"This plan is generated by AI for informational purposes only and is not medical advice. Consult a qualified professional before starting any training or dietary program."`
  - PL: `"Ten plan został wygenerowany przez AI wyłącznie w celach informacyjnych i nie stanowi porady medycznej. Przed rozpoczęciem jakiegokolwiek programu treningowego lub dietetycznego skonsultuj się z wykwalifikowanym specjalistą."`

LLM side: `disclaimer` is a required field in the output schema (`src/lib/validation/plan-schema.ts:65` — `disclaimer: z.string()`); the prompt instructs the model to emit it (`src/lib/plan/build-prompt.ts:44`).

**Testing implication:** "disclaimer reaches the user" is deterministically assertable via a component test — **no eval**. Highest-signal target is the **fallback branch** (`disclaimer` undefined/empty/whitespace → fallback i18n string renders), which is currently untested. Asserting the prompt string (`build-prompt` contains "disclaimer") would be a **mirror test** and does NOT prove the disclaimer reaches the user — avoid counting it as Risk #2 protection.

### Risk #2 — Results component tree (smart/dumb split)

Both entry points funnel through the same dumb `PlanView` → `PlanDisclaimer`, so a component test covers both surfaces:

- Cold-load / from-DB (smart): `src/app/(app)/plan/page.tsx:18-35` — server component, authenticates, `getActivePlan(user.id)`, renders `<PlanView plan={...} />` (`:34`) or `<PlanEmptyState />`.
- Streaming / just-generated (smart): `src/components/plan/plan-generator.tsx:54` — renders `<PlanView plan={finalPlan} />` after the stream completes.
- `PlanView` (dumb): `src/components/plan/plan-view.tsx:23-59` — pure function of `{ plan }`; renders `<PlanDisclaimer disclaimer={plan.disclaimer} />` at `:56`.
- `PlanDisclaimer` (dumb leaf): `src/components/plan/plan-disclaimer.tsx` — owns the disclaimer + fallback logic.

### Risk #2 — Health-respect path (verdict: prompt-carries-it deterministic; plan-honors-it needs an eval)

- Prompt builder: `src/lib/plan/build-prompt.ts` — pure `buildPlanPrompt(input, locale)`.
  - Health flows in at `:14-16`: `const health = input.healthIssues?.trim() ? input.healthIssues.trim() : "none reported";`
  - Injected at `:30`: `- Health issues / constraints: ${health}`.
  - Instruction at `:38`: *"Honor the stated health issues and constraints — never prescribe exercises that conflict with them…"*
- Input schema: `healthIssues` optional free text, max 1000 — `src/lib/validation/plan-schema.ts:20`.
- **Output schema (`planOutputSchema`, `src/lib/validation/plan-schema.ts:50-72`) has NO `healthIssues` field.** Output fields: `calorieTarget`, `cardioGoal`, `dietaryTips`, `disclaimer`, `goal`, `milestones`, `progression`, `summary`, `timelineWeeks`, `weeklySchedule`. Health-respect appears only as free text.

So: prompt-carries-the-health-input is a pure-function unit test (already lightly covered, `build-prompt.test.ts:22-37`). Whether the plan **honors** health cannot be a deterministic `output.references(input)` assertion (no structured echo field, no static net) — it requires an LLM-judge/eval. **Unlike the disclaimer, there is no deterministic safety net for health-respect.** This is the irreducible eval-shaped portion of Risk #2.

### Risk #3 — Data model

Single Drizzle table; all inputs denormalized into the `plans` row. `src/db/schema.ts:13-25`:
- `id` uuid PK (`defaultRandom`)
- `userId` uuid `notNull()` — **ownership column** (plain uuid scoped to Supabase `auth.users.id`, not a FK)
- `isActive` boolean `notNull default true`
- `plan` jsonb (generated plan), `parameters` jsonb (snapshot of the 12 form inputs — body stats, health, goals live here), `model` text, `createdAt` timestamptz
- Index `plans_user_active_idx` on `(user_id, is_active)` — `:24`

Migration matches: `src/db/migrations/0000_friendly_bruce_banner.sql:1-11`. **FR-006 (one active plan/user) is enforced in application code, not a DB constraint** — no unique index on `(user_id) where is_active`; `saveActivePlan` flips prior active rows then inserts, inside a transaction (`src/db/plans.ts:26-46`).

### Risk #3 — Read path (verdict: filtered BY OWNER; no IDOR surface)

Exactly **one** reader — `getActivePlan(userId)` at `src/db/plans.ts:10-19`:

```ts
const rows = await db
  .select()
  .from(plans)
  .where(and(eq(plans.userId, userId), eq(plans.isActive, true)))
  .orderBy(desc(plans.createdAt))
  .limit(1);
```

Owner-scoped (`and(eq(plans.userId, userId), eq(plans.isActive, true))`), not login-only. Its only caller — `src/app/(app)/plan/page.tsx:18-34` — calls `supabase.auth.getUser()` (`:22`), redirects to `/login` if no user (`:24-26`), then passes the **session** `user.id` (`:28`) to `getActivePlan`. The id never comes from a request param/query/body.

**No IDOR-vulnerable route exists:** no dynamic route segments anywhere; all routes (`src/app/page.tsx`, `(app)/plan/page.tsx`, `(app)/plan/new/page.tsx`, `(auth)/login/page.tsx`, `api/plan/generate/route.ts`) take no plan id. A request "for another user's plan" is not expressible.

### Risk #3 — RLS (verdict: ABSENT; app does NOT rely on it)

- Only one SQL file (`0000_friendly_bruce_banner.sql`); `CREATE TABLE` + `CREATE INDEX` only. No `ENABLE ROW LEVEL SECURITY`, no `CREATE POLICY`, no `auth.uid()` anywhere (full grep empty).
- Code documents RLS is off: `src/db/plans.ts:8` ("Scoped by `userId` because RLS is off — server-side scoping is the only isolation") and `:24`.
- Drizzle connects via the Supabase transaction pooler with `DATABASE_URL` (`src/db/index.ts:9-13,30`) — a privileged connection that bypasses RLS even if it existed; no per-request JWT claims.

**Conclusion:** isolation rests entirely on the application-level `WHERE user_id = <session user>`. There is no DB backstop. Dropping the `eq(plans.userId, ...)` term = full cross-user leak. That fragility is the real (only) read-side exposure vector, and is exactly what an integration test must pin.

### Risk #3 — Write path (verdict: owner-scoped)

`saveActivePlan` (`src/db/plans.ts:26-46`) scopes both statements by `input.userId`: deactivate `.where(and(eq(plans.userId, input.userId), eq(plans.isActive, true)))` (`:31`); insert `.values({ ..., userId: input.userId })` (`:35-41`). Only caller is `src/app/api/plan/generate/route.ts`, which authenticates first (`getUser()` `:41`; 401 if none `:43-45`) and persists with `userId: user.id` (`:86`) — never a client-supplied value. The request body is validated by `planInputSchema` and feeds only `parameters`/`plan`; it cannot inject `userId`. **Already tested** at `src/tests/app/api/plan/generate/route.test.ts:131-139` ("write is scoped to the authenticated user, ignoring client-supplied `userId`").

### Risk #3 — Session / current user

Server obtains the user via `@supabase/ssr`:
- `createClient()` — `src/lib/supabase/server.ts:8-32` (cookie-bound, async per Next 16).
- Callers `await supabase.auth.getUser()` — `(app)/plan/page.tsx:22`, `(app)/plan/new/page.tsx:14`, `api/plan/generate/route.ts:41`. `getUser()` validates the token with the auth server (unlike `getSession()`), so the id is trustworthy as an ownership key.

### Risk #3 — Proxy deny-by-default (verdict: correct model, ZERO tests)

`src/proxy.ts` is the sole Next.js 16 proxy. Uses a PUBLIC allowlist (deny-by-default) — complies with `lessons.md`.

`src/proxy.ts:8-9`:
```ts
/** Routes that do NOT require authentication. Everything else is protected. */
const PUBLIC_ROUTES = ["/", "/login"];
```

Gating (`src/proxy.ts:16-41`):
```ts
const isPublic = PUBLIC_ROUTES.some(
  (route) => pathname === route || pathname.startsWith(`${route}/`)
);
if (!user && !isPublic) {
  if (pathname.startsWith("/api/")) {
    return unauthorizedPreservingCookies(response);          // 401 JSON { code: "unauthenticated" }
  }
  return redirectPreservingCookies(request, response, AUTH_ROUTE);  // 307 → /login
}
if (user && isAuthRoute) {
  return redirectPreservingCookies(request, response, DEFAULT_PROTECTED);  // authed on /login → /plan
}
return response;
```

Constants `:5-6`: `AUTH_ROUTE = "/login"`, `DEFAULT_PROTECTED = "/plan"`. Note: with `route = "/"`, `startsWith("//")` means only exact `"/"` is public (not all routes) — the empty-prefix edge case is handled correctly.

Unauth behaviour:
- Page routes → 307 redirect to `/login` via `redirectPreservingCookies` (`:53-65`). No `?redirect=` return-path param.
- `/api/*` → 401 JSON `{ code: "unauthenticated" }` via `unauthorizedPreservingCookies` (`:44-50`).
- Both helpers copy session-refresh `Set-Cookie` headers onto the new response (`:46-48`, `:61-63`).

Auth state via `updateSession(request)` (`src/lib/supabase/middleware.ts:10-41`) which builds a cookie-bound `@supabase/ssr` client and calls `getUser()` (`:36-38`), returning `{ response, user }`.

Matcher (`src/proxy.ts:67-75`) is a single negative-lookahead excluding only Next static assets + images — it does **NOT** exclude `/api/`, so `/api/plan/generate` is proxy-covered (hence the dedicated 401-JSON branch). The route handler **also** self-guards (`route.ts:43`) — defense in depth.

Defense-in-depth re-checks (no shared `requireUser` helper exists): API `route.ts:37-45`, page `(app)/plan/page.tsx:18-26`, page `(app)/plan/new/page.tsx:10-17`. `(app)/layout.tsx:14` does **not** guard.

## Code References

- `src/components/plan/plan-disclaimer.tsx:12-23` — disclaimer render + fallback (`:14` load-bearing); `:19` static title
- `src/components/plan/plan-view.tsx:23-59` — dumb results view; renders disclaimer at `:56`
- `src/components/plan/plan-generator.tsx:54` — streaming surface renders `PlanView`
- `src/app/(app)/plan/page.tsx:18-35` — cold-load: auth + `getActivePlan(user.id)` + `PlanView`
- `src/i18n/messages/en.json:100-101`, `src/i18n/messages/pl.json:100-101` — `disclaimerTitle` / `disclaimerFallback`
- `src/lib/validation/plan-schema.ts:20` — `healthIssues` optional input; `:50-72` output schema (no health field); `:65` `disclaimer` required
- `src/lib/plan/build-prompt.ts:14-16,30,38,44` — health injection + honor instruction + disclaimer instruction
- `src/db/schema.ts:13-25` — `plans` table; `userId` ownership column; `plans_user_active_idx`
- `src/db/plans.ts:10-19` — `getActivePlan` owner-scoped read; `:26-46` `saveActivePlan` owner-scoped write; `:8,24` "RLS is off" comments
- `src/db/index.ts:20-46` — lazy Drizzle client over `DATABASE_URL` (pooler, `prepare:false`)
- `src/db/migrations/0000_friendly_bruce_banner.sql:1-11` — schema migration (no RLS)
- `src/lib/supabase/server.ts:8-32` — `createClient`; `:12-13` reads `NEXT_PUBLIC_SUPABASE_*`
- `src/lib/supabase/middleware.ts:10-41` — `updateSession`; `getUser()` at `:36-38`
- `src/proxy.ts:8-9` PUBLIC_ROUTES; `:16-41` gating; `:44-50` 401 helper; `:53-65` redirect helper; `:67-75` matcher
- `src/app/api/plan/generate/route.ts:37-45` API self-guard 401; `:86` persists `userId: user.id`
- `drizzle.config.ts:14` — migrations use `DIRECT_URL`

### Existing tests (the untrusted suite — audit results)

- `src/tests/components/plan/plan-view.test.tsx:77-82` — disclaimer test asserts static title + fixture disclaimer text. **Behavioural but under-tested: no fallback/empty-disclaimer branch.** Fixture disclaimer at `:15`.
- `src/tests/components/plan/plan-generator.test.tsx:33,54` — streaming surface; fixture includes a disclaimer.
- `src/tests/lib/validation/plan-schema.test.ts:29,51-53` — schema accepts `disclaimer`; `healthIssues` optional.
- `src/tests/lib/plan/build-prompt.test.ts:22-37` — prompt references goal/health/equipment; "includes disclaimer instruction" (`.toContain("disclaimer")`); `"none reported"` branch. Deterministic prompt-carries-it coverage. **Note: asserting the prompt is NOT proof the disclaimer reaches the user — do not count toward Risk #2 protection.**
- `src/tests/lib/auth/actions.test.ts` — `signIn`/`signUp`/`signOut` + `mapAuthError`. Behavioural; mocks supabase + navigation.
- `src/tests/app/api/plan/generate/route.test.ts:85-94` 401 unauth; `:96-110` 400 invalid; `:131-139` write owner-scoped (ignores client `userId`); `:141-224` partial-failure faces. High-quality behavioural — the model the rest should follow.
- `src/tests/db/plans.test.ts:32-62` one-active-row + latest-wins; **`:64-84` two-user isolation** (`getActivePlan(userA)` → null, `getActivePlan(otherUser)` → theirs). Real-DB, self-skips on missing `DATABASE_URL`.
- **`src/proxy.ts` has NO test** (no `proxy.test.ts`); `src/lib/supabase/middleware.ts` untested.

### Test infra

- `src/tests/setup.ts` — global setup (jsdom, jest-dom matchers, ResizeObserver stub, auto-cleanup).
- `src/tests/helpers/ai-stub.ts` — Phase 1 AI stub (`createStreamTextMock`, `createUseObjectMock`, `validPlan`, `schemaViolatingPlan`, controller types). No DB/auth/render helper.
- `vitest.config.ts` — single config, `environment: "jsdom"` globally, `globals: true`, `setupFiles: ["src/tests/setup.ts"]`, `include: ["src/tests/**/*.{test,spec}.{ts,tsx}"]`, `@` → `./src`. No `node` env, no projects, no integration split. `package.json:12` `"test": "vitest"`.
- DB harness env: `DATABASE_URL` (pooler) at runtime; `DIRECT_URL` only to apply migrations (`npm run db:migrate`). Drizzle does NOT need Supabase keys — connects raw, bypassing auth/RLS.

## Architecture Insights

- **Two-layer test strategy maps cleanly here.** Disclaimer + proxy gating = cheap deterministic component/hermetic tests (no eval, no DB). Ownership = integration (real DB) — but it already exists; harden, don't rebuild. Health-respect = the lone eval-shaped item.
- **The disclaimer's static fallback is the safety contract.** The contract "disclaimer reaches the user regardless of LLM output" is satisfied *by the component*, not the prompt. The test that protects it is the **fallback branch** (`plan-disclaimer.tsx:14`), not the happy-path render that already exists. Asserting the prompt string is the mirror anti-pattern called out in test-plan §2 Risk #2.
- **IDOR-by-id is absent by construction**, so the Risk #3 read oracle is "the owner-scoping `WHERE` clause holds," not "an id endpoint rejects strangers." The genuine fragility is the no-RLS, application-level filter: one dropped `eq(plans.userId, ...)` = total leak. The existing `plans.test.ts:64-84` catches a *fully* dropped filter (userA has no rows → expects null), but a **both-users-active** variant is a stronger mutation-killer: if the filter were dropped while userA also has a row, `orderBy desc / limit 1` could return userA's own row and mask the leak. Recommend adding: seed active rows for A and B, assert `getActivePlan(A)` returns A's row (not B's), and vice-versa. This pins the ownership term against the `latest-wins` ordering.
- **Proxy deny-by-default is the highest-signal untested gap.** A hermetic `proxy.test.ts` (mock `updateSession` to control `user`) should assert: gated page (`user: null`) → 307 `/login`; `/api/*` (`user: null`) → 401 `{ code: "unauthenticated" }`; **an unlisted route (e.g. `/profile`) → also denied** (this is the assertion that protects the `lessons.md` deny-by-default rule against a regression back to a protected-prefix list); public `/` and `/login` (`user: null`) → pass through; authed on `/login` → 307 `/plan`. No DB needed.
- **Layer choice for the unauth face:** the API route already proves its own 401 (`route.test.ts:85-94`). Per the Risk #3 "must challenge" — a 401 test ≠ read-authorization proof — keep the proxy gating test and the ownership DB test as distinct concerns; do not let the existing 401 stand in for either the deny-by-default contract or ownership.

## Historical Context (from prior changes)

- **Phase 1 — `context/changes/testing-generation-flow-integrity/`** (rollout Phase 1, complete): established the hermetic AI-stub helper (`src/tests/helpers/ai-stub.ts`) and the `vi.hoisted` + `vi.mock` pattern documented in test-plan §6.2. The route test built there (`route.test.ts`) is the behavioural-quality benchmark and already contains the unauth-401 and write-ownership assertions Phase 2 can build adjacent to.
- **`context/foundation/lessons.md`** — "Deny-by-default route protection" rule names `src/proxy.ts` and forbids a `PROTECTED_PREFIXES` allowlist. Phase 2's proxy test should encode this rule (the "unlisted route is denied" assertion).
- **`context/foundation/test-plan.md` §6.3** still reads "TBD — see §3 Phase 2" for access-control/ownership, but a working real-DB integration test (`src/tests/db/plans.test.ts`) already exists. Phase 2's cookbook update should replace the TBD with the documented self-skip + scoped-cleanup pattern.

## Related Research

- `context/changes/testing-generation-flow-integrity/research.md` — Phase 1 oracle (generation-flow integrity, Risk #1).

## Open Questions

1. **Health-respect eval — in or out of Phase 2 scope?** There is no deterministic way to assert the plan honors stated health (no output field, no static net). Options: (a) defer the eval to a later phase and assert only the deterministic prompt-carries-it half now; (b) write a small, tightly-scoped LLM-judge eval as part of Phase 2. Lesson 2 permits an eval where research shows one is genuinely required, but evals are costly/non-deterministic. **Recommend deferring the eval and documenting the residual risk** unless the plan explicitly opts in. → decide in `/10x-plan`.
2. **Harden the ownership test now, or treat as covered?** The existing `plans.test.ts:64-84` covers isolation when the other user is the only seeded row. A both-users-active variant is a strictly stronger mutation-killer (see Architecture Insights). Cheap to add. → likely a one-line Phase item.
3. **Page-level redirect re-checks (`/plan`, `/plan/new` → `/login`) — test or rely on proxy?** They are defense-in-depth and currently untested. Lower signal than the proxy contract; the plan should decide whether to cover them or treat the proxy test as sufficient for the unauth face.
