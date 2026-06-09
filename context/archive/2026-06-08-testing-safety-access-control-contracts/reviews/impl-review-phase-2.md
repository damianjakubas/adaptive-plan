<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Safety & Access-Control Contracts — Phase 2

- **Plan**: context/changes/testing-safety-access-control-contracts/plan.md
- **Scope**: Phase 2 of 4 (Risk #3 — Proxy Deny-by-Default Gating, Hermetic)
- **Date**: 2026-06-08
- **Verdict**: APPROVED (post-triage fixes applied)
- **Findings**: 0 critical  1 warning  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → FIXED |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated Success Criteria

- 2.1 `src/tests/proxy.test.ts` exists ✅
- 2.2 `npm test` — 9 proxy tests pass (8 original + 1 added during triage), 0 failures ✅
- 2.3 `npx tsc --noEmit` — PASS ✅
- 2.4 `npm run lint` — PASS ✅

## Manual Success Criteria (pending — human confirmation required)

- 2.5 ⬜ Test fails if `PUBLIC_ROUTES` becomes a protected-prefix list
- 2.6 ⬜ Test fails if the `/api/*` branch stops returning 401 JSON
- 2.7 ✅ Evidence confirmed: `/profile` is absent from `PUBLIC_ROUTES = ["/", "/login"]`

## Findings

### F1 — Authenticated user on gated route not tested

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/tests/proxy.test.ts:72-83 / src/proxy.ts:40
- **Detail**: The `describe("authenticated")` block only tested the /login → /plan redirect. No test covered an authed user hitting a gated route (/plan), which passes through via `return response` at proxy.ts:40. If that branch were accidentally replaced with a redirect, all tests would have passed.
- **Fix**: Added `it("passes through /plan for an authenticated user")` asserting `status === 200` and `location === null`.
- **Decision**: FIXED

### F2 — Pass-through tests asserted only location:null, not status:200

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/tests/proxy.test.ts:59-69
- **Detail**: Public-route pass-through tests checked only `res.headers.get("location") === null`. A custom 404/500 would have passed the assertion.
- **Fix**: Added `expect(res.status).toBe(200)` to both pass-through tests.
- **Decision**: FIXED
