---
date: 2026-06-04T10:42:59+0200
researcher: damianjakubas
git_commit: 16ee9519a57974602eb6b5ecb8969ed97c695bc4
branch: main
repository: adaptive-plan
topic: "Generation-flow integrity (Risk #1): how the LLM-output path validates, persists, and surfaces errors — and where the existing tests lie about it"
tags: [research, codebase, plan-generation, ai-sdk, validation, persistence, risk-1, test-plan-phase-1]
status: complete
last_updated: 2026-06-04
last_updated_by: damianjakubas
---

# Research: Generation-flow integrity (Risk #1)

**Date**: 2026-06-04T10:42:59+0200 (CEST)
**Researcher**: damianjakubas
**Git Commit**: 16ee9519a57974602eb6b5ecb8969ed97c695bc4
**Branch**: main
**Repository**: adaptive-plan

## Research Question

This change is **Phase 1 of the test rollout** (`context/foundation/test-plan.md` §3). It
covers **Risk #1**: *"LLM returns invalid/corrupted output (malformed or truncated JSON,
schema-violating object, provider error/timeout mid-stream, empty output) and it breaks the
core generation flow — a partial or garbage plan is persisted, or the user is left stuck."*

The test plan (§2 Risk Response Guidance, test-plan.md:66) names exactly what research must
ground before any test is written:

1. **Where output is validated.**
2. **Whether the save is atomic or a non-atomic sequence.**
3. **What the client receives on each failure face.**

Plus the §1 governing principle: the existing LLM-generated suite is **untrusted input** —
audit it, re-derive the oracle from sources (PRD/contract), then extend.

## Summary

**The oracle.** From PRD FR-004/FR-005/FR-006, the NFR ("no blank screen or unresponsive
state during generation"), and the test-plan contract (test-plan.md:66): on **every**
corrupted-output face the flow must (a) **persist nothing**, (b) **surface a clean error**,
and (c) **never present a half-plan as success**. This oracle comes from sources, not from
reading the route.

**What the live code does (verified firsthand):**

- **Validation lives in `route.ts:64-81` `onFinish`**, not before the response. The route
  returns the stream immediately (`route.ts:86`); persistence runs *after* the stream is
  consumed, inside a swallowing `try/catch`. The gate is `await result.output` →
  `planOutputSchema.safeParse` → `saveActivePlan`.
- **The DB save IS atomic** — a single `db.transaction` (`db/plans.ts:26-46`) that flips the
  old active row to `isActive:false` then inserts the new active row. There is **no
  non-atomic delete-then-insert at the DB layer**. Per CLAUDE.md's two-layer guidance, this
  means **integration tests that force a mid-DB-sequence error are NOT warranted** (the
  transaction cannot partially commit). The genuine partial-failure boundary is one level up:
  the `onFinish` sequence of three independent `await`s with no shared transaction across them.
- **"Persist nothing" holds for all four faces** — the write is structurally gated behind
  both `await result.output` (rejects on faces 1/3/4) and the `safeParse` guard (face 2),
  all inside the swallow-`catch`. No partial plan ever reaches the DB; no half-plan is ever
  rendered (`plan-generator.tsx:38` renders `PlanView` only when `object && !finishError`).
- **"Surface a clean error" has two real gaps** (neither breaks "persist nothing"):
  1. **Server observability gap** — the `onFinish` `catch` is **empty** (`route.ts:77-80`),
     and `streamText` has **no `onError`** (`route.ts:61-84`). Faces 1/3b/4 produce zero
     server-side log/metric. (Confirmed deferred: impl-review F1, see Historical Context.)
  2. **Client silent-fallback gap** — on a stream that finishes with no valid object
     (`onFinish({ object: undefined })`, faces 1 & 4), `plan-generator.tsx:37-41` simply does
     not set `finalPlan`, so the user lands back on the form. The toast fires **only** from
     the hook's `error` state (`plan-generator.tsx:45-49`). Whether `useObject` sets `error`
     on a broken/empty stream is an **unresolved SDK-behaviour question** — and it is the
     pivot between "oracle met" and "user silently stuck." **This is the single most
     important untested behaviour against the oracle.**

**Key reduction for planning.** At the route's `onFinish` boundary, the SDK has already done
its own JSON-assembly/parse, so the four faces collapse into a 2-branch contract:
`output` **rejects** (provider error, truncated/malformed/empty that the SDK couldn't
assemble) → caught → no persist; **or** `output` **resolves** to something `safeParse`
rejects (schema violation, empty `{}`/`null`) → early return → no persist. A hermetic test
exercises a face by controlling what `result.output` resolves/rejects to — it cannot exercise
the SDK's internal parser. **The correct Phase-1 layer is hermetic stub + unit** (matches
test-plan.md:80), not integration.

## Detailed Findings

### A. End-to-end flow (entry → AI call → validate → persist → client)

| Step | Location | Note |
|------|----------|------|
| Auth gate (page) | `src/app/(app)/plan/new/page.tsx:10-29` | `getUser()` → `redirect("/login")`, renders `<PlanGenerator />` |
| Form submit | `src/components/plan/parameter-form.tsx:53` | wizard last step → `onGenerate(form.getValues())`; `onSubmit` is `preventDefault` only (`:71`) |
| Client trigger | `src/components/plan/plan-generator.tsx:35-43` | `experimental_useObject({ api: "/api/plan/generate", schema: planOutputSchema, onFinish })` |
| Route auth | `src/app/api/plan/generate/route.ts:42-44` | no user → `errorResponse("unauthenticated", 401)` |
| Input validation | `route.ts:46-56` | bad JSON or `planInputSchema.safeParse` fail → `400 {code:"invalid_parameters"}` |
| AI call (STREAMING) | `route.ts:61-84` | `streamText({ output: Output.object({ schema: planOutputSchema }), prompt: buildPlanPrompt(input, locale), abortSignal: req.signal, onFinish })`, model `gemini-2.5-flash` (`:30`), `maxDuration = 300` (`:28`) |
| Prompt build | `src/lib/plan/build-prompt.ts:13-45` | pure; injects 12 params + disclaimer instruction + locale line |
| Output schema | `src/lib/validation/plan-schema.ts:50-72` | `planOutputSchema`; nests `weeklySchedule[].exercises[]` (deepest shape — see risk note) |
| **Validation + persist gate** | `route.ts:64-81` | `await result.output` → `safeParse` → `saveActivePlan`; all in swallowing `try/catch` |
| Response | `route.ts:86` | `result.toTextStreamResponse()` returns **immediately**, before the write |
| **DB save (ATOMIC)** | `src/db/plans.ts:26-46` | single `db.transaction`: deactivate prior active rows, insert new active row, scoped by `userId` (RLS off) |
| Client success | `plan-generator.tsx:37-41,51-53` | renders `<PlanView>` from client-held final object; **no navigation / no DB re-read** (avoids read-after-write race) |
| Client error | `plan-generator.tsx:45-49` | `useObject.error` → `toast.error(tErrors(mapPlanError(error)))`; falls back to form with values preserved |

The route's `onFinish`, verbatim (`route.ts:64-81`):

```ts
onFinish: async () => {
  try {
    const generated = await result.output;
    const validated = planOutputSchema.safeParse(generated);
    if (!validated.success) {
      return;                       // schema violation → no persist
    }
    await saveActivePlan({ model: MODEL_ID, parameters: input, plan: validated.data, userId: user.id });
  } catch {
    // output rejection / parse failure / DB error — never persist a partial
    // plan and never mutate the active plan. The client surfaces the error.
  }
},
```

The atomic save, verbatim (`db/plans.ts:26-46`):

```ts
return db.transaction(async (tx) => {
  await tx.update(plans).set({ isActive: false })
    .where(and(eq(plans.userId, input.userId), eq(plans.isActive, true)));
  const [row] = await tx.insert(plans)
    .values({ isActive: true, model, parameters, plan, userId }).returning();
  return row;
});
```

### B. The four corrupted-output faces vs the oracle

SDK facts (Vercel AI SDK v6, `streamText` + `Output.object`): `result.output` is a promise
that **rejects** (TypeValidationError) when no valid object is produced; `onFinish` is **not
called on abort / mid-stream drop** unless `consumeStream` is wired (it is not here).

| # | Face | Detection (file:line) | Persists? | Client sees | Oracle |
|---|------|------------------------|-----------|-------------|--------|
| 1 | Malformed/truncated JSON | `await result.output` rejects → caught (`route.ts:66,77`) | **No** — `saveActivePlan` (`:71`) never reached | stream ends with no valid object; `onFinish({object:undefined})` → form fallback (`plan-generator.tsx:38`); **toast only if `useObject` sets `error`** | persist ✅; error-surface ⚠️ (silent-fallback risk) |
| 2 | Schema-violating object | `await result.output` rejects (TypeValidationError) **and** explicit `safeParse` early-return (`route.ts:67-70`) | **No** — gated behind `validated.success` | hook validates same schema → `object:undefined` → form fallback | ✅ persist nothing, no half-plan |
| 3 | Provider error / timeout mid-stream | (a) synchronous `streamText(...)` throw → outer catch (`route.ts:87-89`) → `500 mapPlanError`; (b) mid-stream/abort → `streamText` suppresses; `onFinish` not called or `output` rejects + swallowed (`:77`) | **No** in both | (a) clean `500 {code}` → toast `generation_failed`/`rate_limited`; (b) 200 stream already open → `useObject` must surface stream error | persist ✅; (b) ⚠️ no server `onError` log |
| 4 | Empty output (`null`/`""`/`{}`) | same path as face 1 (no parseable object → `output` rejects) **or** resolves to `{}` → `safeParse` fails; **no explicit empty check** | **No** | `onFinish({object:undefined})` → form fallback; same toast-uncertainty as face 1 | persist ✅; error-surface ⚠️ |

**The pivot (open question O-1).** Faces 1 & 4 lead to `onFinish({ object: undefined })`. If
`useObject` *also* sets `error` on a broken/empty stream → the toast fires and the oracle is
met (a green test proves it). If it does **not** → the user is silently returned to the form
with no message — the "user is left stuck" face of Risk #1 (a red test reveals a real bug).
Research cannot resolve this without an SDK-source check (Context7) or an empirical test.

### C. Existing-test audit (untrusted suite — re-oracled)

Setup: `vitest.config.ts` (jsdom, `@/` alias, globals); `src/tests/setup.ts` (jest-dom,
ResizeObserver stub, auto-cleanup). **No shared AI-client stub helper / fixture exists** —
each test hardcodes its own.

| File | Covers | AI stub? | Verdict | Gap for Risk #1 |
|------|--------|----------|---------|------------------|
| `src/tests/app/api/plan/generate/route.test.ts` | the route | Yes — `vi.mock("ai")` captures `onFinish`, mutable `mocks.outputPromise` (`:33-43`) | **Trustworthy contract tests, but thin** — assertions check the *contract* (`saveActivePlan` not called), not the implementation, so NOT mirror | misses: empty-output explicit, **`saveActivePlan` throws (DB error)**, **synchronous setup-throw → 500** |
| `src/tests/lib/plan/build-prompt.test.ts` | prompt builder | No (pure fn) | mirror-ish (asserts presence of inputs) | n/a (pre-generation; not Risk #1) |
| `src/tests/lib/validation/plan-schema.test.ts` | schemas | No | happy-path + 2 violation cases (`:112-124`) | misses: wrong nested types, empty `{}`/`null`, array-shape violations |
| `src/tests/db/plans.test.ts` | `saveActivePlan`/`getActivePlan` | No (real DB, self-skips w/o `DATABASE_URL`) | **Trustworthy** (asserts atomic-replace + user isolation) | n/a — DB semantics, not output validation |
| `src/tests/components/plan/plan-generator.test.tsx` | client component | Yes — mocks `useObject`, drives `onFinish` (`:82-106`) | trustworthy for state transitions, **happy-path fixture only** | **misses `onFinish({object:undefined})`** (the silent-fallback / O-1 case); only tests explicit `mockState.error` |

**Which faces are tested today** (test-plan.md asks this explicitly):

- Malformed/truncated JSON — **No** (mock returns clean object or generic rejection).
- Schema violation — **Partial**: `route.test.ts:149-156` (`{summary:"incomplete"}`) +
  `plan-schema.test.ts:112-124`. Misses type mismatches and empty objects.
- Provider error mid-stream — **Minimal**: `route.test.ts:158-165` drives a synchronous
  `output` rejection only. No setup-throw→500 test; no `mapPlanError` unit test.
- Empty output — **No** anywhere.

`src/lib/plan/errors.ts` (`mapPlanError`, `:21-39`) — **pure, high-signal, completely
untested**. 429/`statusCode` → `rate_limited`; "rate limit"/"quota"/"429" in message →
`rate_limited`; else → `generation_failed`. Ideal cheap unit + mutation target.

## Code References

- `src/app/api/plan/generate/route.ts:42-44` — 401 unauth gate
- `src/app/api/plan/generate/route.ts:46-56` — 400 invalid input (bad JSON / `planInputSchema`)
- `src/app/api/plan/generate/route.ts:61-84` — `streamText` + `Output.object`; **no `onError`**
- `src/app/api/plan/generate/route.ts:64-81` — `onFinish` validate→persist gate (empty `catch`)
- `src/app/api/plan/generate/route.ts:86` — `toTextStreamResponse()` returns before the write
- `src/app/api/plan/generate/route.ts:87-89` — outer catch → `errorResponse(mapPlanError(error), 500)`
- `src/db/plans.ts:26-46` — `saveActivePlan` single atomic transaction (deactivate→insert)
- `src/db/plans.ts:10-19` — `getActivePlan` (user-scoped, `isActive`, latest by `createdAt`)
- `src/lib/validation/plan-schema.ts:50-72` — `planOutputSchema` (nested `weeklySchedule[].exercises[]`)
- `src/lib/plan/errors.ts:21-39` — `mapPlanError` (untested)
- `src/components/plan/plan-generator.tsx:37-41` — `onFinish` sets plan only when `object && !finishError`
- `src/components/plan/plan-generator.tsx:45-49` — error→toast effect (only fires on hook `error`)
- `src/tests/app/api/plan/generate/route.test.ts:33-43` — the hermetic AI stub pattern (cookbook seed)
- `src/tests/app/api/plan/generate/route.test.ts:149-165` — the two existing failure-branch tests

## Architecture Insights

- **Persistence is decoupled from the response.** The stream is returned at `route.ts:86`;
  the durable write happens in `onFinish` after the stream is consumed. The just-generated
  view renders from the client-held object, never from a DB re-read (`plan-generator.tsx`
  docblock `:14-24`) — deliberately avoiding a read-after-write race. Consequence for tests:
  the route's HTTP status (200) is **not** a signal of generation success; success is the DB
  write, and failure is surfaced client-side. "stream returned 200 means success" is exactly
  the anti-pattern test-plan.md:66 warns against.
- **At the `onFinish` boundary the four faces reduce to two branches** (output rejects /
  output resolves-but-`safeParse`-fails) plus a third independent failure (`saveActivePlan`
  throws). These three are the hermetic test matrix; a fourth route branch (synchronous
  `streamText` setup throw → 500) is the only path that returns a non-200.
- **Atomic save → no integration test for partial DB failure.** The single transaction
  cannot leave zero or two active rows. Hermetic stubs on the `onFinish` sequence are the
  cheapest real signal (CLAUDE.md two-layer rule: "non-atomic save sequence → hermetic
  tests"; here the *DB* is atomic but the *onFinish* sequence is not).
- **The output schema's nested `weeklySchedule[].exercises[]` is the most likely real
  violation point** for the free Gemini model — making face 2 (schema violation) the
  highest-probability corrupted-output face in production (see Historical Context #6).

## Historical Context (from prior changes)

From `context/changes/plan-generation/` (merged via PR #8) and `context/changes/locale-support/`:

- **Validation strategy (oracle).** `plan-generation/plan.md` Critical Implementation
  Details: *"await `result.output` … then `outputSchema.safeParse(generated)` before
  writing. (Do not hand-parse `onFinish`'s finished text — that's the fragile path.)"* →
  safeParse failure ⇒ never persist. Matches live code.
- **Atomic replacement (oracle).** Plan + `db/plans.ts`: two saves ⇒ exactly one active row
  (latest), prior flipped inactive, no orphans. Covered by `plans.test.ts:32-62`.
- **Decoupled write (oracle).** Plan: *"Display vs. persistence are decoupled (no
  read-after-write race) … Never gate the just-generated view on a DB read of the row the
  same request is still writing."*
- **Schema-depth risk (oracle for face 2).** Plan Open Risks: the nested
  `weeklySchedule[].exercises[]` is *"the deepest a smaller free model is asked to satisfy and
  the most likely violation point. Mitigations (load-bearing): `safeParse` in `onFinish` with
  a `generation_failed` path (never persist a partial)."*
- **Deferred observability gap (impl-review F1, LOW/WARNING, SKIPPED).**
  `plan-generation/reviews/impl-review-phase-2.md:23-31`: *"The plan explicitly required …
  'log and let the client surface a generation error'. The catch block is completely empty
  and swallows the error silently without logging."* → confirms gap #1; logging is **not**
  currently implemented, so a test asserting a log would be red (treat as scope decision, not
  a mirror test).
- **Locale captured at generation, not stored (scope boundary for Risk #5, not this phase).**
  `locale-support/change.md:45-51`: a plan stays in its original language after a UI switch;
  `plans` has no `locale` column. FR-008 holds at generation time only. **Out of Phase-1
  scope** (Risk #5 → Phase 3).

## Related Research

- `context/changes/plan-generation/research.md` — original generation-flow exploration (PR #8)
- `context/changes/plan-generation/plan.md` — the design decisions cited above
- `context/foundation/test-plan.md` §2–§3 — Risk #1 response guidance and Phase-1 scope

## Open Questions

- **O-1 (pivotal).** Does `useObject` (AI SDK v6) set `error` when the stream finishes with
  **no valid object** (faces 1 & 4: truncated/empty), or only on transport/HTTP failure? This
  determines whether the user gets a clean toast or is **silently** dropped on the form. Two
  ways to resolve: (a) Context7 lookup of AI SDK v6 `useObject` error/onFinish semantics; (b)
  write the component test for `onFinish({ object: undefined })` and let red/green decide — if
  red, it surfaces a real "user left stuck" bug (Risk #1's soft edge). **Resolve before
  finalizing the plan's component-test assertions.**
- **O-2 (scope boundary).** The route-level hermetic tests (persist-nothing on every face +
  setup-throw→500) are unambiguously Phase 1. The client "left stuck / no progress" behaviour
  overlaps **Risk #4 (Phase 3: UX resilience)**. Recommendation: Phase 1 owns the **server
  contract fully** plus the **`onFinish({object:undefined})` Risk-#1 face**; defer the broader
  dropped-stream/infinite-spinner UX states to Phase 3. The plan should confirm this line.
- **O-3 (observability, possibly out of lesson scope).** Should the empty `onFinish` `catch`
  (`route.ts:77-80`) and missing `streamText.onError` log the failure? impl-review F1 left
  this deferred. A test asserting a log is legitimate (it asserts the plan's stated intent),
  but adding the log is a fix → borderline **Lesson 5** (bug→fix→regression). Flag for the
  plan to decide whether Phase 1 asserts current behaviour or drives the fix.
- **O-4.** Mid-stream **abort** (`req.signal`) means `onFinish` is never called → no persist
  (oracle-consistent), but the current onFinish-driven mock cannot represent "never called."
  Note as a known hermetic-harness limitation rather than a test to force.
