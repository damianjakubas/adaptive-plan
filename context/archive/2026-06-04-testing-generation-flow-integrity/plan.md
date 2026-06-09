# Generation-flow integrity (Risk #1) — Implementation Plan

## Overview

This is **Phase 1 of the test rollout** (`context/foundation/test-plan.md` §3), covering **Risk
#1**: the LLM returns invalid/corrupted output (malformed/truncated JSON, schema-violating
object, provider error/timeout mid-stream, empty output) and it breaks the core generation
flow — a partial plan is persisted, or the user is left stuck.

We **audit and re-oracle** the existing LLM-generated tests (treated as untrusted input per
test-plan §1), then **extend** them so every corrupted-output face provably fails safe:
persists nothing, surfaces a clean error, never renders a half-plan as success. Two real bugs
the audit surfaced are **fixed in this phase with green regression tests** (decided during
planning): the client silent-fallback and the server observability gap.

The correct layer is **hermetic stub + unit** (test-plan.md:80) — the DB save is a single
atomic `db.transaction`, so no integration test for partial DB failure is warranted; the
genuine partial-failure boundary is the route's non-atomic `onFinish` sequence one level up.

## Current State Analysis

- **Validation + persist gate lives in `route.ts:64-81` `onFinish`**, after the stream is
  returned (`route.ts:86`). It awaits `result.output` → `planOutputSchema.safeParse` →
  `saveActivePlan`, all inside a swallowing `try/catch`.
- **The DB save is atomic** (`db/plans.ts:26-46`): one `db.transaction` flips the old active
  row to `isActive:false`, inserts the new one. It cannot partially commit ⇒ **no integration
  test for mid-DB-sequence failure**.
- **Existing tests are trustworthy but thin** (audited firsthand):
  - `src/tests/app/api/plan/generate/route.test.ts` — hermetic `ai` stub with a mutable
    `outputPromise`; asserts the *contract* (`saveActivePlan` not called), not the
    implementation. Misses: explicit empty `{}`/`null`, `saveActivePlan` throws, synchronous
    setup-throw → 500.
  - `src/tests/components/plan/plan-generator.test.tsx` — mocks `useObject`, drives `onFinish`;
    happy-path fixture only. **Misses `onFinish({object:undefined})`** (the silent-fallback case).
  - `src/tests/lib/validation/plan-schema.test.ts` — happy path + 2 violation cases. Misses
    empty `{}`/`null`, nested type mismatches, array-shape violations.
  - `src/lib/plan/errors.ts` (`mapPlanError`) — pure, branch-rich, **completely untested**.
- **No shared AI-SDK stub helper exists** — each test hardcodes its own. Cookbook §6.2 is TBD.
- **No logger exists in the repo** — no `handleApiError`, no `console`, no Sentry/pino. The
  `onFinish` catch is empty and `streamText` has no `onError` (impl-review F1, deferred).
- **No Stryker installed** — no config, not in `package.json`.

### Resolved open question O-1 (was pivotal)

Context7 (`/vercel/ai` v6.0.0-beta) confirmed `useObject`'s two failure channels:

- `onFinish({ object, error })` — `object` is `undefined` and `error` is **set** on **schema-
  validation failure** (the assembled object didn't match the schema).
- The hook's returned `error` **state** (and `onError`) — set only on **fetch/transport** errors.

`plan-generator.tsx:45-49` toasts **only** from the hook `error` state, and its `onFinish`
handler (`:37-41`) uses `finishError` *solely as a guard* — it never surfaces it. Therefore on
faces 1/2/4 (no valid object assembled — including the schema violation that is the **most
likely** production face for the free Gemini model) the user is **silently dropped back to the
form with no toast**. This is a real bug, not an SDK uncertainty.

## Desired End State

- Every corrupted-output face has a hermetic or unit test proving **persist-nothing** and a
  **clean surfaced error**; no test asserts the buggy behaviour (no mirror tests).
- The client silent-fallback bug is **fixed**: a finished stream with no valid object surfaces
  a localized toast; the user is never silently returned to the form.
- The server observability gap is **closed**: `streamText.onError` and the `onFinish` catch log
  each failure exactly once through a dedicated, spy-able seam.
- `mapPlanError` and the `planOutputSchema` violation matrix are covered by parameterised units;
  `mapPlanError`'s assertions are confirmed meaningful by a **selective Stryker run** on
  `errors.ts`.
- Cookbook §6.2 documents the shared hermetic AI-SDK stub helper; the helper is importable and
  consumed by both the route and component suites.

Verify: `npm test` green; `npm run lint` and `npx tsc --noEmit` clean; `npx stryker run`
(scoped to `errors.ts`) shows no *meaningful* survived mutants.

### Key Discoveries

- `route.ts:64-81` — `onFinish` validate→persist gate inside an empty `catch`.
- `db/plans.ts:26-46` — atomic transaction ⇒ hermetic, not integration (CLAUDE.md two-layer rule).
- `route.test.ts:33-43` — the hermetic AI stub seed pattern (cookbook §6.2 source).
- `plan-generator.tsx:37-49` — silent-fallback bug location (O-1).
- `errors.ts:21-39` — untested pure `mapPlanError`; ideal unit + mutation target.
- AI SDK v6 `useObject`: `onFinish.error` = schema-validation error; `error` state = transport.

## What We're NOT Doing

- **No integration / real-DB tests** — the save is atomic; out of layer for Risk #1 (those
  belong to Phase 2 / Risk #3).
- **No e2e, no Playwright, no vision/eval** — out of Lesson 2 scope and out of this risk.
- **No locale-output correctness** (Risk #5 → Phase 3) and **no IDOR/access-control** (Risk #3
  → Phase 2).
- **No hooks/MCP/CI-pipeline authoring** (later lessons / modules).
- **No mid-stream abort test** (O-4) — `onFinish` is never called on abort; the
  onFinish-driven harness cannot represent "never called." Documented as a known limitation.
- **No broad Stryker gate** — selective, ad-hoc, scoped to `errors.ts` only; not a CI gate.

## Implementation Approach

Cheapest-signal-first, dependency-ordered: build the shared hermetic seam (environment), then
pure units (no stub needed), then the server hermetic matrix + observability fix, then the
client fix + UX states, then documentation. Each test phase re-derives its oracle from the
PRD/contract before extending, never from the implementation. The two source fixes (client,
server) ship with green regression tests in their own phases so manual verification can confirm
the user-visible behaviour change.

## Critical Implementation Details

- **`vi.mock` hoisting constrains the shared helper.** `vi.mock` factories are hoisted above
  imports and may only reference `vi.hoisted` values — they cannot close over ordinary
  module-scope variables. The shared helper must therefore export **controller factories**
  (e.g. a `streamText` controller exposing a mutable `outputPromise` + captured `onFinish`, and
  a `useObject` controller exposing settable `error`/`isLoading` + captured `onFinish`) that
  each test wires inside its own `vi.hoisted(...)` + `vi.mock(...)`. The helper centralizes the
  *shape and behaviour*; the test owns the hoisted instance. Do not try to call `vi.mock` from
  inside the helper.
- **Log seam, not raw `console`.** ESLint `no-console` is global and no logger exists. Introduce
  a single-purpose helper `src/lib/plan/log-generation-error.ts` (per CLAUDE.md rule 9) that the
  route calls from both `onError` and the `onFinish` catch. Tests spy on this helper — they
  assert it is invoked, not what it prints. Its internal sink (server `console.error` behind an
  inline `eslint-disable-next-line no-console`, the standard server-route pattern) is an
  implementation detail isolated to that file.
- **The route's HTTP 200 is not a success signal.** Persistence happens after the stream is
  consumed; success is the DB write, failure is surfaced client-side. Assert the *contract*
  (`saveActivePlan` (not) called, log (not) fired), never "200 ⇒ success" (test-plan.md:66).

## Phase 1: Hermetic harness + shared AI-SDK stub helper

### Overview

Extract the duplicated AI-SDK stubs into one importable fixture and refactor the two existing
suites to consume it — a **pure refactor** that keeps existing tests green and seeds cookbook
§6.2. No new assertions.

### Changes Required:

#### 1. Shared hermetic stub helper

**File**: `src/tests/helpers/ai-stub.ts` (new)

**Intent**: Provide reusable controller factories for the two AI-SDK seams used in this risk —
the server `ai` module (`streamText` + `Output.object`) and the client `@ai-sdk/react`
(`experimental_useObject`) — so corrupted-output faces are forced from one place.

**Contract**: Exports (a) a `streamText` controller shape with a mutable `outputPromise`, a
captured `onFinish`/`onError`, and a `toTextStreamResponse` stub; (b) a `useObject` controller
shape with settable `error`/`isLoading`/`object` and a captured `onFinish`; plus a couple of
canonical fixtures (`validPlan`, a schema-violating object). Designed to be instantiated inside
a caller's `vi.hoisted` (see Critical Implementation Details — hoisting constraint).

#### 2. Refactor existing suites onto the helper

**File**: `src/tests/app/api/plan/generate/route.test.ts`, `src/tests/components/plan/plan-generator.test.tsx`

**Intent**: Replace the hand-rolled `mocks` / `mockState` blocks with the shared controllers;
no behavioural change.

**Contract**: Existing test names and assertions unchanged; both files import from
`@/tests/helpers/ai-stub` and wire the controller via `vi.hoisted` + `vi.mock`.

### Success Criteria:

#### Automated Verification:

- Existing suite still green: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- The helper is genuinely reused (no residual duplicated stub bodies in the two suites).

**Implementation Note**: Pure refactor — if any existing assertion changes meaning, stop; the
helper must preserve current behaviour exactly. Pause for confirmation before Phase 2.

---

## Phase 2: Pure-unit coverage — `mapPlanError` + output-schema violation matrix

### Overview

Add the cheapest, highest-signal tests — no AI stub needed — and confirm `mapPlanError`'s
assertions actually bite via a selective Stryker run.

### Changes Required:

#### 1. `mapPlanError` unit tests

**File**: `src/tests/lib/plan/errors.test.ts` (new)

**Intent**: Cover every branch of the pure mapper against the oracle (429/quota ⇒
`rate_limited`; everything else ⇒ `generation_failed`).

**Contract**: A single `it.each` table over the branches — `statusCode: 429`; message contains
"rate limit" / "quota" / "429"; a plain error → `generation_failed`; a non-`Error` value
(string/object) → `generation_failed`. One assertion per case; no redundant copies.

#### 2. Output-schema violation matrix

**File**: `src/tests/lib/validation/plan-schema.test.ts`

**Intent**: Extend `planOutputSchema` coverage to the faces research flagged as untested,
parameterised to avoid redundant copies.

**Contract**: `it.each` rejection cases for empty `{}`, `null`, nested type mismatches (e.g.
`sets` as string, `kcal` as string, missing `targetMinutes`), and array-shape violations
(`weeklySchedule`/`dietaryTips`/`milestones` given a non-array); plus one **accept** case proving
extra/unknown fields are tolerated (Zod strips by default) so a future `strict()` can't silently
break valid plans.

#### 3. Selective Stryker gate on `errors.ts`

**File**: `stryker.config.mjs` (new), `package.json` (devDeps)

**Intent**: Prove the `mapPlanError` assertions kill mutants, not merely execute lines. Local,
ad-hoc, scoped — not a CI gate (test-plan §5).

**Contract**: Add `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` as devDeps; a
minimal `stryker.config.mjs` using the vitest runner. Run `npx stryker run --mutate "src/lib/plan/errors.ts"`;
triage survived mutants per CLAUDE.md (kill if user/business-meaningful, ignore equivalents
consciously).

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Selective mutation run completes: `npx stryker run --mutate "src/lib/plan/errors.ts"`

#### Manual Verification:

- Stryker HTML report reviewed; every survived mutant on `errors.ts` is either killed by a new
  assertion or consciously documented as equivalent/cosmetic.

**Implementation Note**: Do not chase 100% mutation score. Pause for confirmation before Phase 3.

---

## Phase 3: Server contract — complete hermetic face matrix + observability fix

### Overview

Finish the server-side corrupted-output matrix using the Phase 1 helper, and close the
observability gap (decided in planning: fix now). Assert *persist-nothing* on every face **and**
that exactly one log fires on failure, never on success.

### Changes Required:

#### 1. Log-seam helper

**File**: `src/lib/plan/log-generation-error.ts` (new)

**Intent**: A single spy-able sink for generation failures so the route stops swallowing errors
silently and tests can assert observability without coupling to a print format.

**Contract**: One exported function (e.g. `logGenerationError(context: { stage: string; error: unknown })`)
returning `void`. Internal sink isolated here (see Critical Implementation Details). No `any`.

#### 2. Route observability fix

**File**: `src/app/api/plan/generate/route.ts`

**Intent**: Make failures observable — add `streamText.onError` and call `logGenerationError`
from the (currently empty) `onFinish` catch. Must not change the persist-nothing contract or
block the response.

**Contract**: `onError` wired on the `streamText` call; `logGenerationError` invoked in the
`onFinish` catch and the `onError` handler. No new persistence paths; the swallow-and-continue
semantics for the client are preserved.

#### 3. Server hermetic matrix

**File**: `src/tests/app/api/plan/generate/route.test.ts`

**Intent**: Add the missing faces and the observability assertions, all via the shared helper.

**Contract**: New tests — (a) `output` resolves to `{}` → no persist; (b) `output` resolves to
`null` → no persist; (c) `saveActivePlan` throws → caught, no crash, no persist, **log fired
once**; (d) synchronous `streamText(...)` setup-throw → `500` with the `mapPlanError` code; (e)
each failure face fires `logGenerationError` exactly once; (f) the happy path fires it **zero**
times. Assert against the contract, not HTTP 200.

### Success Criteria:

#### Automated Verification:

- All route tests pass: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- A forced generation failure (locally) produces a server log entry; the happy path does not.
- No regression in the existing persist-exactly-one-active-plan behaviour.

**Implementation Note**: The setup-throw → 500 path is the only non-200 route branch; confirm it
maps through `mapPlanError`. Pause for confirmation before Phase 4.

---

## Phase 4: Client — fix silent-fallback bug + generator UX states

### Overview

Fix the O-1 silent-fallback bug and cover the generator's terminal states (including the broader
Risk #4 dropped-stream / no-progress faces, pulled into Phase 1 by decision), all via the shared
`useObject` controller.

### Changes Required:

#### 1. Surface the finish-time error

**File**: `src/components/plan/plan-generator.tsx`

**Intent**: When the stream finishes with no valid object (`onFinish` reports a validation
`error` and/or `object` is undefined), surface a localized toast and return to the form —
instead of silently dropping the user. The existing transport-`error` toast path stays.

**Contract**: `onFinish` no longer uses `finishError` only as a guard — a finished-but-invalid
stream drives the same `toast.error(tErrors(mapPlanError(...)))` surface the hook `error` state
uses today. No double-toast when both channels fire for one submission.

#### 2. Component tests

**File**: `src/tests/components/plan/plan-generator.test.tsx`

**Intent**: Pin the fix and the terminal-state contract.

**Contract**: New tests — (a) `onFinish({ object: undefined, error })` → toast fired + form
shown (green regression for the fix); (b) transport `error` state → toast + form (dropped-stream
face); (c) loader shown only while `isLoading`, and a terminal error clears the loader (no state
where the user sees neither plan, nor a justified loader, nor an error — the "spinner-forever"
oracle). Keep the existing happy-path render test.

### Success Criteria:

#### Automated Verification:

- All component tests pass: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Forcing a finished-but-invalid stream in the running app shows a toast and returns to the form
  (no silent drop).
- A simulated dropped stream surfaces an error rather than an infinite spinner.

**Implementation Note**: Confirm exactly one toast per failed submission (no duplicate from the
two channels). Pause for confirmation before Phase 5.

---

## Phase 5: Cookbook + test-plan sync

### Overview

Document the hermetic pattern so future phases reuse it, and record what this phase taught.

### Changes Required:

#### 1. Cookbook + status sync

**File**: `context/foundation/test-plan.md`

**Intent**: Turn the TBD cookbook sections into real references and record the mutation gate.

**Contract**: Fill §6.2 (hermetic AI-SDK stub) pointing at `src/tests/helpers/ai-stub.ts` with a
short usage note (including the `vi.mock` hoisting constraint); add a partial §6.4 note for the
generator UI states; append a §6.6 per-phase note (silent-fallback bug + observability gap fixed,
`useObject` two-channel error semantics); confirm §5 mutation-gate row reflects the `errors.ts`
selective run. Leave §3 Status to the orchestrator convention (Progress section drives it).

### Success Criteria:

#### Automated Verification:

- Full suite green: `npm test`
- Linting passes: `npm run lint`
- Final selective mutation run completes: `npx stryker run --mutate "src/lib/plan/errors.ts"`

#### Manual Verification:

- A reader following §6.2 can write a new corrupted-output test using the helper without reading
  the route test.

**Implementation Note**: Documentation phase — no source changes beyond `test-plan.md`.

---

## Testing Strategy

### Unit Tests:

- `mapPlanError` — all branches (`it.each`): 429 status, rate-limit/quota/429 message, default,
  non-Error input.
- `planOutputSchema` — violation matrix: empty `{}`, `null`, nested type mismatch, array-shape;
  plus extra-fields-tolerated accept case.

### Hermetic (stub) Tests:

- Route: empty `{}`/`null` output, `saveActivePlan` throws, setup-throw → 500, log-fired-once
  per failure / zero on success, persist-nothing on every face.
- Component: finished-but-invalid → toast + form, transport error → toast + form, loader/terminal
  state contract.

### Integration Tests:

- **None** — DB save is atomic (out of layer for Risk #1).

### Manual Testing Steps:

1. Force a finished-but-invalid stream → expect one toast + return to form (no silent drop).
2. Simulate a dropped stream → expect an error, not an infinite spinner.
3. Force a server-side failure → expect exactly one server log; happy path → none.

## Performance Considerations

None — test-only and small route/component edits. `maxDuration = 300` unchanged.

## Migration Notes

New devDeps (`@stryker-mutator/*`) and a `stryker.config.mjs`. Stryker runs are local/ad-hoc, not
wired into CI.

## References

- Research: `context/changes/testing-generation-flow-integrity/research.md`
- Test plan: `context/foundation/test-plan.md` §1–§3, §6.2
- Hermetic stub seed: `src/tests/app/api/plan/generate/route.test.ts:33-43`
- Bug locations: `src/components/plan/plan-generator.tsx:37-49`; `src/app/api/plan/generate/route.ts:64-81`
- AI SDK v6 `useObject` error semantics: Context7 `/vercel/ai` (resolved O-1)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Hermetic harness + shared AI-SDK stub helper

#### Automated

- [x] 1.1 Existing suite still green: `npm test` — 1483d7a
- [x] 1.2 Type checking passes: `npx tsc --noEmit` — 1483d7a
- [x] 1.3 Linting passes: `npm run lint` — 1483d7a

#### Manual

- [x] 1.4 Helper genuinely reused (no residual duplicated stub bodies) — 1483d7a

### Phase 2: Pure-unit coverage — mapPlanError + output-schema violation matrix

#### Automated

- [x] 2.1 New unit tests pass: `npm test` — 6bfee88
- [x] 2.2 Type checking passes: `npx tsc --noEmit` — 6bfee88
- [x] 2.3 Linting passes: `npm run lint` — 6bfee88
- [x] 2.4 Selective mutation run completes: `npx stryker run --mutate "src/lib/plan/errors.ts"` — 6bfee88 (run used CLI --mutate flag; `mutate` field baked into stryker.config.mjs in df03f97)

#### Manual

- [x] 2.5 Stryker report reviewed; every survived mutant on `errors.ts` killed or consciously ignored — 6bfee88 (errors.test.ts refined and statusCode 500 case added in df03f97)

### Phase 3: Server contract — hermetic face matrix + observability fix

#### Automated

- [x] 3.1 All route tests pass: `npm test` — df03f97
- [x] 3.2 Type checking passes: `npx tsc --noEmit` — df03f97
- [x] 3.3 Linting passes: `npm run lint` — df03f97

#### Manual

- [x] 3.4 Forced server failure produces a log entry; happy path does not — df03f97
- [x] 3.5 No regression in persist-exactly-one-active-plan behaviour — df03f97

### Phase 4: Client — silent-fallback fix + generator UX states

#### Automated

- [x] 4.1 All component tests pass: `npm test` — 38143a8
- [x] 4.2 Type checking passes: `npx tsc --noEmit` — 38143a8
- [x] 4.3 Linting passes: `npm run lint` — 38143a8

#### Manual

- [x] 4.4 Finished-but-invalid stream shows a toast and returns to the form (no silent drop) — 38143a8
- [x] 4.5 Simulated dropped stream surfaces an error, not an infinite spinner — 38143a8

### Phase 5: Cookbook + test-plan sync

#### Automated

- [x] 5.1 Full suite green: `npm test` — 3369feb
- [x] 5.2 Linting passes: `npm run lint` — 3369feb
- [x] 5.3 Final selective mutation run completes: `npx stryker run --mutate "src/lib/plan/errors.ts"` — 3369feb

#### Manual

- [x] 5.4 A reader can write a new corrupted-output test from §6.2 without reading the route test
