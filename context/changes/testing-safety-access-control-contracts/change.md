---
change_id: testing-safety-access-control-contracts
title: Safety & access-control contracts (test rollout Phase 2)
status: implemented
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Rollout Phase 2 of `context/foundation/test-plan.md`: "Safety & access-control contracts".

**Risks covered:** #2 (safety contract — disclaimer reaches the user; plan respects stated health input), #3 (cross-user data exposure — IDOR + unauthenticated access to gated routes).

**Test types planned:** component + integration (real DB / RLS).

**Risk response intent (from §2 Risk Response Guidance):**
- #2 — Prove the not-medical-advice disclaimer reaches the user's results *deterministically*, regardless of LLM output, and the plan-content path respects stated health input. Challenge: "the prompt contains the disclaimer instruction" ≠ "the disclaimer reaches the user". Research must decide if the disclaimer is a static results component (cheap integration) or LLM-emitted (needs an eval).
- #3 — Prove a request for *another* user's plan id is denied (not merely that unauthenticated requests are denied), and gated routes deny-by-default. Challenge: "user-scoped write + a 401 test = safe" — write-scoping and login checks do NOT prove read-authorization (IDOR). Research must ground the read/fetch path: filtered by owner, or only by login? Likely needs real-DB integration (§4 flags DB setup as TBD).

After research, follow the downstream continuation rule (research → plan → implement).

**What shipped (2026-06-08):**
- Disclaimer fallback branch (`src/tests/components/plan/plan-disclaimer.test.tsx`) — covers `undefined`/`""`/whitespace inputs via `it.each`; static title always asserted.
- Proxy deny-by-default gating (`src/tests/proxy.test.ts`) — hermetic suite with mocked `updateSession`; includes unlisted-route assertion that guards the deny-by-default rule.
- Ownership both-users-active hardening (`src/tests/db/plans.test.ts`) — pins `eq(plans.userId, …)` against `orderBy/limit` ordering; self-skips without `DATABASE_URL`.

**Residual risk:** Risk #2 is partially covered. The deterministic face (prompt carries health input) is covered by `src/tests/lib/plan/build-prompt.test.ts`. The behavioural face ("generated plan respects stated health issues") requires an LLM-judge eval and is intentionally deferred. Risk #2 is **not** fully closed.
