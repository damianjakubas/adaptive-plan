# Safety & Access-Control Contracts (Test Rollout Phase 2) Implementation Plan

## Overview

Rollout Phase 2 of `context/foundation/test-plan.md`. Protect two risks with the cheapest tests that give a real signal:

- **Risk #2 (safety contract):** prove the not-medical-advice disclaimer reaches the user's results **deterministically, regardless of LLM output**.
- **Risk #3 (cross-user data exposure):** prove gated routes **deny-by-default** and a user can never read **another** user's plan.

Research (`research.md`) already grounded the oracle and resolved the structural questions: the disclaimer is a hybrid with a deterministic static fallback, IDOR-by-id is structurally absent, the ownership read is already covered, and `src/proxy.ts` has zero tests. This plan turns those findings into ordered, mostly infra-free test phases.

## Current State Analysis

- **Disclaimer** renders through one dumb leaf, `src/components/plan/plan-disclaimer.tsx:12-23`. Line 14 (`disclaimer?.trim() ? disclaimer : t("disclaimerFallback")`) is the load-bearing safety net; line 19 always renders the static i18n title. The existing test (`src/tests/components/plan/plan-view.test.tsx:77-82`) only covers the **happy path** where the model supplies a disclaimer — the fallback branch is untested.
- **Health-respect** has no deterministic oracle: the output schema (`src/lib/validation/plan-schema.ts:50-72`) has no `healthIssues` field. The deterministic half (prompt carries the health input + honor instruction) is already covered by `src/tests/lib/plan/build-prompt.test.ts:22-37`. The "plan actually honors health" half is eval-shaped — **deferred** this phase by decision.
- **Proxy** (`src/proxy.ts:8-41`) uses a `PUBLIC_ROUTES` allowlist (deny-by-default, complies with `lessons.md`). It has **zero tests** — no `proxy.test.ts` exists. Auth state comes from `updateSession(request)` (`src/lib/supabase/middleware.ts:10-41`).
- **Ownership read** (`src/db/plans.ts:10-19`) is owner-scoped (`WHERE user_id = <session user> AND is_active`). RLS is **off** — application-level scoping is the only isolation. A real-DB isolation test exists (`src/tests/db/plans.test.ts:64-84`) but seeds only the *other* user, so a dropped filter could be masked by `latest-wins` ordering.
- **Cookbook §6.3** still reads "TBD" though the real-DB pattern already exists in `plans.test.ts`.

## Desired End State

After this plan:

- A component test fails if the disclaimer fallback ever stops rendering when the LLM omits/empties the field, and if the static title stops rendering. Verify: `npm test` covers the empty/undefined/whitespace branches of `plan-disclaimer.tsx`.
- A hermetic `src/tests/proxy.test.ts` fails if any route regresses the deny-by-default contract — including a regression back to a protected-prefix list (the "unlisted route is denied" assertion). Verify: `npm test` runs the proxy suite with no DB/network.
- The ownership integration test fails if the `eq(plans.userId, ...)` term is dropped even while the querying user also has an active row. Verify: `DATABASE_URL=… npm test src/tests/db/plans.test.ts` (self-skips without `DATABASE_URL`).
- `test-plan.md` §6.3 documents the real-DB pattern, §6 documents the proxy hermetic pattern, the deferred health eval is recorded as a known residual risk, and §3 Phase 2 status reflects reality.

### Key Discoveries:

- `src/components/plan/plan-disclaimer.tsx:14` — the static fallback is the safety contract; assert this branch, not the prompt string (mirror anti-pattern per test-plan §2 Risk #2).
- `src/proxy.ts:16-41` — gating: null user + non-public → `/api/*` 401 JSON `{ code: "unauthenticated" }`, else 307 → `/login`; authed on `/login` → 307 → `/plan`.
- `src/db/plans.ts:10-19` — owner-scoped read; the only isolation (RLS off, `:8,24`).
- `src/tests/db/plans.test.ts:22-30` — reusable harness: self-skip on missing `DATABASE_URL`, throwaway `crypto.randomUUID()` ids, scoped `afterEach` cleanup.
- `src/lib/supabase/middleware.ts:10-41` — `updateSession` returns `{ response, user }`; this is the seam the proxy test mocks.

## What We're NOT Doing

- **No LLM-judge eval for health-respect** this phase — deferred and documented as residual risk (decision). The deterministic prompt-carries-health half is already covered; we only audit it.
- **No page-level redirect tests** for `/plan` / `/plan/new` — the hermetic proxy test is the primary unauth gate; the page guards are defense-in-depth (decision).
- **No new IDOR-by-id endpoint tests** — no dynamic route or id-accepting read path exists; the surface is structurally absent (research).
- **No new DB infra / integration split** — reuse the existing self-skip harness and `vitest.config.ts`.
- **No e2e, no Playwright, no MCP, no hooks** — out of Lesson 2 scope.
- **Not rewriting the existing route/auth tests** — they are the behavioural benchmark; we build adjacent.

## Implementation Approach

Two-layer strategy from `CLAUDE.md`, applied per risk:

- Risk #2 disclaimer → **component test** (deterministic, no DB, no eval).
- Risk #3 unauth → **hermetic test** (mock `updateSession`, no DB).
- Risk #3 ownership → **integration test** (real DB) — harden the existing one, don't rebuild.
- Audit-first: each phase re-checks the existing tests in its area (test-plan §1 governing principle) before extending.

Phases are ordered cheapest-deterministic-first (component → hermetic → integration → docs), so the fast CI-safe signal lands before the ad-hoc DB gate.

## Phase 1: Risk #2 — Disclaimer Fallback Branch (Component)

### Overview

Prove a "not medical advice" string reaches the user regardless of LLM output, by testing the static fallback branch and the always-static title. Audit the deterministic health-input coverage; extend only if the audit finds a gap.

### Changes Required:

#### 1. Disclaimer component test

**File**: `src/tests/components/plan/plan-disclaimer.test.tsx` (new)

**Intent**: Cover the load-bearing fallback branch at `plan-disclaimer.tsx:14` that the existing `plan-view` happy-path test omits. Render `PlanDisclaimer` directly with the next-intl provider used elsewhere in the component tests.

**Contract**: Parameterised over the empty-ish inputs (`it.each` per test-plan anti-pattern guidance) — `disclaimer` = `undefined`, `""`, `"   "` → `AlertDescription` shows the i18n `Plan.disclaimerFallback` string; a non-empty `disclaimer` → that text renders verbatim. In all cases `AlertTitle` shows the static `Plan.disclaimerTitle`. Assert against the i18n message value (the oracle), not against the component's own expression. Do **not** assert the prompt string.

#### 2. Audit deterministic health-input coverage

**File**: `src/tests/lib/plan/build-prompt.test.ts` (extend only if audited gap)

**Intent**: Confirm the already-present coverage (`:22-37`) actually asserts the health input is injected and the "honor the stated health issues" instruction is present. If a branch is missing (e.g. the populated-health branch vs only the `"none reported"` branch), add it. Record in the phase notes that "plan honors health" remains an unproven residual risk handled in Phase 4.

**Contract**: `buildPlanPrompt(input, locale)` output contains the trimmed `healthIssues` text when supplied, the `"none reported"` sentinel when absent, and the honor-health instruction. No new oracle invented — this is a deterministic pure-function assertion.

### Success Criteria:

#### Automated Verification:

- New disclaimer test file exists: `src/tests/components/plan/plan-disclaimer.test.tsx`
- Unit tests pass: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- The fallback test fails if `plan-disclaimer.tsx:14` is mutated to drop the fallback (spot-check by temporarily breaking it, or via Stryker on the file)
- The title assertion is independent of the LLM-supplied body
- No assertion references the prompt builder string

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Risk #3 — Proxy Deny-by-Default Gating (Hermetic)

### Overview

Encode the deny-by-default contract from `lessons.md` as an executable test. Mock `updateSession` so the test controls `user` without DB or network.

### Changes Required:

#### 1. Proxy gating test

**File**: `src/tests/proxy.test.ts` (new — mirrors `src/proxy.ts` location)

**Intent**: Drive `proxy(request)` with a mocked `updateSession` returning `{ response, user }`, asserting each branch of the gating logic (`proxy.ts:16-41`). The "unlisted route is denied" case is the assertion that protects the deny-by-default rule against a regression to a protected-prefix list.

**Contract**: Mock `@/lib/supabase/middleware` so `updateSession` returns a controllable `user` and a pass-through `response`. Construct `NextRequest`s for each path. Assert:
- null user + gated page (`/plan`) → 307 redirect, `Location` ends `/login`
- null user + `/api/*` → 401, JSON body `{ code: "unauthenticated" }`
- null user + **unlisted** route (e.g. `/profile`) → denied (307 → `/login`), proving deny-by-default
- null user + public `/` and `/login` → pass through (response returned, no redirect)
- authed user + `/login` → 307 redirect to `/plan`
- session-refresh `Set-Cookie` headers are preserved on the redirect/401 responses

Next.js 16 note: `proxy.ts` is the renamed middleware entrypoint — read `node_modules/next/dist/docs/` if the `NextRequest`/`NextResponse` test construction needs version-specific handling.

### Success Criteria:

#### Automated Verification:

- New proxy test file exists: `src/tests/proxy.test.ts`
- Unit tests pass with no DB/network: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Test fails if `PUBLIC_ROUTES` is changed to a protected-prefix list (the deny-by-default regression)
- Test fails if the `/api/*` branch stops returning 401 JSON
- The unlisted-route assertion genuinely exercises a route absent from `PUBLIC_ROUTES`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Risk #3 — Ownership Both-Users-Active Hardening (Integration DB)

### Overview

Strengthen the existing isolation test so a dropped owner-scoping term is caught even when the querying user also has an active row.

### Changes Required:

#### 1. Both-users-active isolation test

**File**: `src/tests/db/plans.test.ts` (extend)

**Intent**: Add a test that seeds active plans for **both** user A and user B, then asserts ownership reads stay isolated in both directions. The existing `:64-84` test seeds only the other user, so `getActivePlan(A)` returning `null` can't distinguish "filter held" from "filter dropped but A had no row." Seeding A too closes that gap and pins the `eq(plans.userId, ...)` term against the `orderBy desc / limit 1` ordering.

**Contract**: Within the existing `describe.skipIf(!hasDb)` block, reuse the harness pattern (`crypto.randomUUID()` ids, scoped cleanup in `finally`/`afterEach`). Seed an active plan for A and a distinct active plan for B; assert `getActivePlan(A)` returns A's plan (not B's) and `getActivePlan(B)` returns B's plan (not A's). Clean up B's rows in `finally` mirroring `:81-83`.

### Success Criteria:

#### Automated Verification:

- Extended test present in `src/tests/db/plans.test.ts`
- With a DB: `DATABASE_URL=… npm test src/tests/db/plans.test.ts` passes
- Without a DB: suite self-skips (no failure) — `npm test` stays green in CI
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Temporarily dropping `eq(plans.userId, …)` from `getActivePlan` makes the new test fail (the existing test alone may not)
- Cleanup leaves no rows for either throwaway user after the run

**Implementation Note**: This phase needs a reachable `DATABASE_URL` (Supabase pooler) to actually run — it is the ad-hoc integration gate (test-plan §5). After automated verification, pause for manual confirmation.

---

## Phase 4: Cookbook + Test-Plan Sync + Residual-Risk Note

### Overview

Make the test plan reflect what shipped: document the real-DB and proxy patterns, record the deferred health eval as a known residual risk, and advance the rollout status.

### Changes Required:

#### 1. Cookbook §6.3 — access control / ownership

**File**: `context/foundation/test-plan.md` (§6.3)

**Intent**: Replace "TBD — see §3 Phase 2" with the documented real-DB integration pattern (self-skip on missing `DATABASE_URL`, throwaway random user ids, scoped `afterEach`/`finally` cleanup) and the both-users-active assertion as the ownership mutation-killer. Reference `src/tests/db/plans.test.ts`.

**Contract**: §6.3 prose + a short reference to the harness pattern and the proxy hermetic pattern (mock `updateSession`, control `user`). Add the proxy pattern either in §6.3 or a new §6.x sibling, referencing `src/tests/proxy.test.ts`.

#### 2. Residual-risk note — deferred health eval

**File**: `context/foundation/test-plan.md` (§6.6 per-rollout-phase notes) and `context/changes/testing-safety-access-control-contracts/change.md`

**Intent**: Record that Risk #2's "plan honors stated health" half is intentionally **not** covered this phase (no deterministic oracle; eval deferred), with the deterministic prompt-carries-health half noted as the covered portion. This prevents a future reader assuming Risk #2 is fully closed.

**Contract**: A Phase 2 sub-section under §6.6 summarising what shipped (disclaimer fallback, proxy deny-by-default, ownership hardening) and the explicit residual eval gap. `change.md` Notes updated to mirror.

#### 3. Rollout status

**File**: `context/foundation/test-plan.md` (§3 status), `context/changes/testing-safety-access-control-contracts/change.md`

**Intent**: Advance §3 Phase 2 Status from "change opened" toward `complete` per the status vocabulary once Progress is fully `[x]`. Set `change.md` `status` accordingly with `updated: <today>`.

**Contract**: §3 table Status cell + frontmatter fields. No strategy (§1–§5 risk) edits — that is Lesson 1 scope.

### Success Criteria:

#### Automated Verification:

- `test-plan.md` §6.3 no longer contains "TBD" for access control
- Full suite green: `npm test` (DB tests self-skip without `DATABASE_URL`)
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- §6.6 records the deferred health eval as residual risk
- §3 Phase 2 status matches the Progress section state
- Cookbook patterns are accurate enough for a new contributor to copy

**Implementation Note**: Documentation phase — after automated verification, confirm the test-plan reads correctly before closing the change.

---

## Testing Strategy

### Unit / Component Tests:

- Disclaimer fallback branch (empty/undefined/whitespace → static i18n fallback); always-static title (Phase 1).
- Deterministic health-input injection audit in `build-prompt.test.ts` (Phase 1).

### Integration Tests:

- Both-users-active ownership isolation in both directions, real DB, self-skipping (Phase 3).

### Hermetic Tests:

- Proxy deny-by-default gating across all branches, including the unlisted-route assertion (Phase 2).

### Manual Testing Steps:

1. Temporarily break `plan-disclaimer.tsx:14` fallback → Phase 1 test fails.
2. Temporarily switch `PUBLIC_ROUTES` to a protected-prefix list → Phase 2 unlisted-route test fails.
3. Temporarily drop the `userId` term in `getActivePlan` → Phase 3 test fails (existing test alone may pass).
4. Run `npm test` with no `DATABASE_URL` → DB tests skip, suite green.

## Performance Considerations

None — all tests are unit/component/hermetic except the ad-hoc DB gate (test-plan §5), which is run locally on demand, not on every commit.

## Migration Notes

None — no schema or runtime code changes; this phase adds and extends tests plus documentation.

## References

- Research: `context/changes/testing-safety-access-control-contracts/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 Risk Response, §3 Phase 2, §6 cookbook)
- Lessons: `context/foundation/lessons.md` (deny-by-default route protection)
- Disclaimer leaf: `src/components/plan/plan-disclaimer.tsx:12-23`
- Proxy gating: `src/proxy.ts:8-41`; seam `src/lib/supabase/middleware.ts:10-41`
- Ownership read + harness: `src/db/plans.ts:10-19`, `src/tests/db/plans.test.ts:22-84`
- Behavioural benchmark: `src/tests/app/api/plan/generate/route.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Risk #2 — Disclaimer Fallback Branch (Component)

#### Automated

- [x] 1.1 New disclaimer test file exists: `src/tests/components/plan/plan-disclaimer.test.tsx` — ec34e56
- [x] 1.2 Unit tests pass: `npm test` — ec34e56
- [x] 1.3 Type checking passes: `npx tsc --noEmit` — ec34e56
- [x] 1.4 Linting passes: `npm run lint` — ec34e56

#### Manual

- [ ] 1.5 Fallback test fails if `plan-disclaimer.tsx:14` is mutated to drop the fallback
- [ ] 1.6 Title assertion is independent of the LLM-supplied body
- [ ] 1.7 No assertion references the prompt builder string

### Phase 2: Risk #3 — Proxy Deny-by-Default Gating (Hermetic)

#### Automated

- [x] 2.1 New proxy test file exists: `src/tests/proxy.test.ts` — f26101b
- [x] 2.2 Unit tests pass with no DB/network: `npm test` — f26101b
- [x] 2.3 Type checking passes: `npx tsc --noEmit` — f26101b
- [x] 2.4 Linting passes: `npm run lint` — f26101b

#### Manual

- [ ] 2.5 Test fails if `PUBLIC_ROUTES` becomes a protected-prefix list
- [ ] 2.6 Test fails if the `/api/*` branch stops returning 401 JSON
- [ ] 2.7 The unlisted-route assertion exercises a route absent from `PUBLIC_ROUTES`

#### Addendum (landed in e3b1edc with Phase 3)

- `status: 200` assertions added to the "passes through /" and "passes through /login" pass-through tests
- New test: "passes through /plan for an authenticated user" — closes the missing authed pass-through branch

### Phase 3: Risk #3 — Ownership Both-Users-Active Hardening (Integration DB)

#### Automated

- [x] 3.1 Extended test present in `src/tests/db/plans.test.ts` — e3b1edc
- [x] 3.2 With a DB: `DATABASE_URL=… npm test src/tests/db/plans.test.ts` passes — e3b1edc
- [x] 3.3 Without a DB: suite self-skips, `npm test` stays green — e3b1edc
- [x] 3.4 Type checking passes: `npx tsc --noEmit` — e3b1edc
- [x] 3.5 Linting passes: `npm run lint` — e3b1edc

#### Manual

- [ ] 3.6 Dropping `eq(plans.userId, …)` makes the new test fail (existing test alone may not)
- [ ] 3.7 Cleanup leaves no rows for either throwaway user

### Phase 4: Cookbook + Test-Plan Sync + Residual-Risk Note

#### Automated

- [x] 4.1 `test-plan.md` §6.3 no longer contains "TBD" for access control
- [x] 4.2 Full suite green: `npm test`
- [x] 4.3 Type checking passes: `npx tsc --noEmit`
- [x] 4.4 Linting passes: `npm run lint`

#### Manual

- [ ] 4.5 §6.6 records the deferred health eval as residual risk
- [ ] 4.6 §3 Phase 2 status matches the Progress section state
- [ ] 4.7 Cookbook patterns are accurate enough for a new contributor to copy
