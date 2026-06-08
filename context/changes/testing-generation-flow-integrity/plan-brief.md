# Generation-flow integrity (Risk #1) — Plan Brief

> Full plan: `context/changes/testing-generation-flow-integrity/plan.md`
> Research: `context/changes/testing-generation-flow-integrity/research.md`

## What & Why

Phase 1 of the test rollout, covering **Risk #1**: the LLM returns corrupted output
(malformed/truncated JSON, schema violation, provider error, empty output) and breaks the core
generation flow — a partial plan is persisted, or the user is left stuck. We audit and re-oracle
the untrusted LLM-generated tests, then extend them so every corrupted-output face provably fails
safe: persists nothing, surfaces a clean error, never renders a half-plan.

## Starting Point

The server contract is solid — validation + persistence sit in `route.ts` `onFinish`, and the DB
save is a single atomic transaction. But the existing tests are thin (happy-path-biased), the
pure `mapPlanError` is completely untested, and the audit surfaced **two real bugs**: the client
silently drops the user back to the form when the stream finishes with no valid object, and the
server swallows every failure with zero logging.

## Desired End State

Every corrupted-output face is covered by a hermetic or unit test proving persist-nothing and a
surfaced error. The client always shows a toast (never a silent drop); the server logs each
failure exactly once through a spy-able seam. `mapPlanError`'s assertions are confirmed
meaningful by a selective Stryker run. The cookbook documents the reusable hermetic stub helper.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Test layer | Hermetic stub + unit, **no integration** | DB save is atomic — a mid-sequence DB failure can't happen | Research |
| O-1 (the pivot) | Confirmed: `useObject` `error` state = transport only; schema-fail goes to `onFinish.error` | Context7 `/vercel/ai` v6 — the silent-fallback is a real bug, not SDK uncertainty | Research + Plan |
| Client silent-fallback | **Fix now** + green regression test | High×High user-stuck bug; worth closing in its own phase | Plan |
| Client scope | Server contract + `onFinish({object:undefined})` **+ broader dropped-stream / spinner-forever** | Cover the Risk #4 UX faces in this pass | Plan |
| Server observability | **Add `onError` + catch logging** via a spy-able seam, assert it fires | Consistent with the fix-now stance; makes failures testable | Plan |
| `mapPlanError` | Unit `it.each` + **selective Stryker** on `errors.ts` | Cheapest high-signal target; prove assertions bite | Plan |
| Test layout | Extend in place + **extract a shared stub helper** | DRY; seeds cookbook §6.2 for future phases | Plan |
| Schema faces | empty `{}`/`null`, nested type mismatch, array-shape, + extra-fields-tolerated | Covers the highest-probability production face | Plan |

## Scope

**In scope:** Risk #1 corrupted-output faces (route + schema + error mapper + client); two source
fixes (client silent-fallback, server logging); shared hermetic stub helper; selective Stryker on
`errors.ts`; cookbook §6.2.

**Out of scope:** integration / real-DB tests; e2e / Playwright / eval; IDOR & access control
(Risk #3, Phase 2); locale-output correctness (Risk #5, Phase 3); CI/hooks/MCP; mid-stream abort
(harness can't represent "onFinish never called"); broad Stryker gate.

## Architecture / Approach

Cheapest-signal-first, dependency-ordered: shared hermetic seam → pure units → server hermetic
matrix + observability fix → client fix + UX states → docs. `vi.mock` hoisting means the helper
exports controller factories the tests wire inside their own `vi.hoisted`. Logging routes through
a dedicated `log-generation-error.ts` seam (no logger exists; `no-console` is global).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Hermetic harness | Shared AI-SDK stub helper; existing suites refactored onto it (green) | `vi.mock` hoisting — helper must expose factories, not closures |
| 2. Pure units | `mapPlanError` `it.each` + schema violation matrix + Stryker gate | Stryker config/runner setup (not yet installed) |
| 3. Server contract | Empty/null/DB-throw/setup-throw faces + `onError`/catch logging fix | Logging fix must not change persist-nothing or block response |
| 4. Client fix + UX | Surface finish error (bug fix) + terminal-state tests | Avoid double-toast across the two error channels |
| 5. Cookbook + sync | §6.2 helper reference, §6.6 note, mutation-gate row | Docs only |

**Prerequisites:** none beyond the current suite (Vitest + RTL configured).
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- The server log sink uses server `console.error` behind an inline `eslint-disable` inside the
  isolated seam — acceptable as the standard server-route pattern; revisit if a real logger lands.
- The "spinner-forever" oracle is asserted via deterministic terminal states; a truly hung
  `isLoading` (SDK-internal) is not forced — documented limitation.
- Two source fixes cross the Lesson-5 bug→fix→regression boundary by explicit user decision.

## Success Criteria (Summary)

- Every corrupted-output face fails safe (persist-nothing + surfaced error), proven by test.
- The user always sees an error; never silently dropped or stuck on an infinite spinner.
- Server failures are observable; `mapPlanError` assertions confirmed by selective mutation.
