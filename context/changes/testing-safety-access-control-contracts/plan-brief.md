# Safety & Access-Control Contracts (Test Rollout Phase 2) — Plan Brief

> Full plan: `context/changes/testing-safety-access-control-contracts/plan.md`
> Research: `context/changes/testing-safety-access-control-contracts/research.md`

## What & Why

Phase 2 of the test rollout protects two High-impact risks: the **safety contract** (Risk #2 — the not-medical-advice disclaimer must reach the user regardless of LLM output) and **cross-user data exposure** (Risk #3 — gated routes deny-by-default; no user reads another's plan). The existing suite is LLM-generated and untrusted; this phase audits it and adds the assertions that actually pin the contracts.

## Starting Point

The disclaimer renders through one dumb leaf with a static i18n fallback (`plan-disclaimer.tsx:14`) — but only the happy path is tested. `src/proxy.ts` enforces deny-by-default correctly yet has **zero tests**. The ownership read is owner-scoped and already has a real-DB isolation test, but it seeds only the other user, so a dropped filter could be masked by latest-wins ordering. RLS is off — application-level scoping is the only isolation.

## Desired End State

A component test pins the disclaimer fallback; a hermetic test pins proxy deny-by-default (including an unlisted-route assertion that guards the `lessons.md` rule); a strengthened integration test catches a dropped owner-scoping term even when the querying user also has an active row. The cookbook documents both patterns and the deferred health eval is recorded as a known residual risk.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Disclaimer test target | Fallback branch + static title | The static fallback is the safety net; the prompt string would be a mirror test | Research |
| Health-respect eval | Defer, document residual risk | No deterministic oracle (no output field); evals are costly/non-deterministic | Plan |
| Ownership coverage | Add both-users-active variant | Strictly stronger mutation-killer than the existing other-user-only seed | Research/Plan |
| Unauth coverage | Hermetic proxy test only | Proxy is the real gate; page redirects are lower-signal defense-in-depth | Plan |
| IDOR-by-id | Not tested | No dynamic route / id-accepting read path exists — surface is structurally absent | Research |
| Infra | Reuse existing harness | DB tests self-skip without `DATABASE_URL`; no new infra needed | Research |

## Scope

**In scope:** disclaimer fallback component test; proxy deny-by-default hermetic test; both-users-active ownership integration test; cookbook §6.3 + residual-risk + status sync.

**Out of scope:** health-respect LLM eval (deferred); page-level redirect tests; IDOR-by-id tests; new DB infra; e2e/Playwright/MCP/hooks; rewriting existing route/auth tests; §1–§5 risk-strategy edits.

## Architecture / Approach

Two-layer cost×signal strategy, cheapest-deterministic-first: component (disclaimer, no DB/eval) → hermetic (proxy, mock `updateSession`) → integration (ownership, real DB, self-skipping) → docs. Each phase audits the existing tests in its area before extending.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Disclaimer fallback | Component test for empty/whitespace → static fallback; always-static title | Asserting the prompt instead of user-visible output (mirror) |
| 2. Proxy deny-by-default | Hermetic test of all gating branches + unlisted-route assertion | Next 16 `NextRequest`/`NextResponse` test construction |
| 3. Ownership hardening | Both-users-active isolation, both directions, real DB | Needs a reachable `DATABASE_URL` to actually run |
| 4. Cookbook + sync | §6.3 pattern, residual-risk note, status advance | Leaving Risk #2 looking fully closed when health eval is deferred |

**Prerequisites:** existing Vitest setup (Phase 1 complete); a Supabase `DATABASE_URL` for Phase 3's actual run.
**Estimated effort:** ~1–2 sessions across 4 phases (3 small test phases + 1 docs phase).

## Open Risks & Assumptions

- "Plan honors stated health" stays unproven until a future eval phase — recorded as residual risk, not closed.
- Phase 3 only executes where a DB is reachable; CI keeps it self-skipping.
- Assumes research's structural conclusions (no IDOR surface, RLS off) remain true at implementation time.

## Success Criteria (Summary)

- The disclaimer fallback and proxy deny-by-default contracts fail loudly if regressed.
- A dropped owner-scoping filter is caught even when both users have active rows.
- `npm test` stays green in CI (DB tests self-skip); the test plan accurately reflects what shipped and what was deferred.
