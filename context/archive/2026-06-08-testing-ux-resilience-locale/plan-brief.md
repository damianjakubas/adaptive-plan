# UX Resilience & Locale Output Correctness — Plan Brief

> Full plan: `context/changes/testing-ux-resilience-locale/plan.md`
> Research: `context/changes/testing-ux-resilience-locale/research.md`

## What & Why

Phase 3 of the test rollout (`test-plan.md` §3): protect **Risk #4 (UX resilience
/ dropped-stream)** and **Risk #5 (locale output correctness)** with the cheapest
deterministic tests that give a real signal. The existing suite is LLM-generated
and untrusted — research re-derived the oracle from PRD/contract; this plan fills
the genuine gaps and replaces one mirror test.

## Starting Point

Risk #4's hung-stream face (200-OK stream that opens then delivers no bytes) is a
**confirmed unhandled gap** — `isLoading` sticks `true` forever with no error.
Risk #5's three deterministic faces are unprotected: `plan-view.test.tsx` renders
EN only, `LocaleToggle` has no test, and `build-prompt.test.ts:53-57` is a mirror
that asserts the prompt's verbatim language instruction instead of any output.
Catalogs are at full pl/en parity today, but nothing enforces it.

## Desired End State

Five new/extended tests land (all green under `npm test`) plus a selective Stryker
run on `locale-toggle.tsx`: the hung-stream gap is regression-pinned, catalog
parity is enforced, the UI renders a static chrome label in the active locale,
LocaleToggle's switch contract is covered, and the prompt mirror is replaced by a
labeled threading assertion. Two residual eval-shaped risks are documented, not
hidden.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Risk #4 hung-stream | Pin current behavior, don't fix | Fixing needs client timeout/abort wiring — out of Lesson 2 testing scope | Research |
| Risk #5 generated-content language | Defer (eval-shaped) | No deterministic oracle; mirrors Phase 2's deferred health eval | Research |
| build-prompt locale mirror | Replace with threading assertion | Keeps a cheap regression net (PL ≠ EN) without mirroring the instruction string | Plan |
| UI-string render placement | Extend `plan-view.test.tsx` | Reuses existing render harness; keeps the contract beside the component | Plan |
| Phase granularity | Fine-grained (5 phases) | One behavior per phase with its own red→green checkpoint | Plan |
| Mutation gate | Selective Stryker on `locale-toggle.tsx` | The one module with branching logic this phase fully covers | Plan |
| Residual-risk recording | Plan + test-plan §6.6 + github-issues stub | Visible in test-plan AND tracked as actionable future work | Plan |

## Scope

**In scope:** hung-stream pin test; catalog deep-parity unit test; PL/EN UI-string
render; LocaleToggle cookie/guard/`aria-pressed` test + Stryker; build-prompt
threading assertion; cookbook §6.4/§6.5/§6.6 + github-issues + §3 status sync.

**Out of scope:** fixing the hung-stream gap; asserting generated-content language;
retroactive retranslation after a UI switch; e2e/accessibility; timer-based ≤2s
assertion.

## Architecture / Approach

All tests are component- or unit-level — no integration / real-DB needed for
either risk. Reuse the hermetic `UseObjectController` seam (`ai-stub.ts`) for the
hung-stream pin and the `NextIntlClientProvider` wrapper for locale renders. The
static chrome label `Plan.viewTitle` (PL "Twój Plan Treningowy" vs EN "Your
Training Plan") drives the UI-string contract. No production code changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Hung-stream pin | Component test pinning the dropped-stream gap | Mistaking the pin for "handled" — mitigated by explicit comment |
| 2. Catalog parity | Deep pl/en parity unit test | Oracle must be the opposite catalog, not a hard-coded shape |
| 3. UI-string render | PL/EN `viewTitle` assertion in plan-view | Asserting fixture content instead of static chrome |
| 4. LocaleToggle + Stryker | Cookie/guard/`aria-pressed` test + mutation gate | Chasing equivalent-mutant survivors |
| 5. Threading + docs | build-prompt threading test, cookbook, residuals, issue stub, status | Reintroducing the mirror as a substring check |

**Prerequisites:** Phase 1/2 of the rollout complete (seams + cookbook exist).
**Estimated effort:** ~1–2 sessions across 5 small phases.

## Open Risks & Assumptions

- **Risk #4 hung-stream remains unhandled** — pinned, not fixed; a future Lesson 5
  bug-fix slice owns the client timeout/abort wiring. Tracked via github-issues stub.
- **Risk #5 generated-content language is unproven** — eval-deferred; do not treat
  Risk #5 as fully closed after this phase.
- Assumes `startTransition` runs its callback synchronously under test (so
  `router.refresh()` is observable in the LocaleToggle test).

## Success Criteria (Summary)

- The genuine dropped-stream face and the three Risk #5 deterministic faces all
  have failing-on-regression tests; `npm test` green, lint + typecheck clean.
- The prompt mirror is gone; locale assertions prove threading only, with output
  language explicitly deferred.
- Both residual risks are documented in test-plan §6.6 and the hung-stream fix is
  tracked in github-issues.
