<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Log a Workout from the Active Plan (S-01)

- **Plan**: context/changes/log-workout-from-plan/plan.md
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: REVISE → SOUND (after triage fixes)
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING (resolved via F1 fix) |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING (resolved via F1/F3 fixes) |
| Plan Completeness | WARNING (resolved via F2 fix) |

## Grounding

17/17 paths ✓, 5/5 symbols ✓, brief↔plan ✓, Progress↔Phase contract ✓ (4/4 phases, 18/18 criteria), lessons.md priors respected (deny-by-default routing, getTranslations in server components). Notable repo fact: zero `useFieldArray` usage exists yet — the plan's nested-array component split correctly anticipates introducing it.

## Findings

### F1 — Navbar plan-state goes stale: layouts do NOT re-render on navigation

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details ("Navbar cost") + Phase 4 #6
- **Detail**: The plan asserted "the (app) layout runs on every authenticated navigation" — wrong for the App Router, which preserves shared layouts on soft navigation. A fresh user who generates their first plan (plan-generator stays on /plan/new, renders the result in-page, no navigation) keeps a stale disabled "Log Workout" entry until a hard reload. The generate→log demo flow breaks at the hand-off. The per-navigation cost worry was also overstated for the same reason.
- **Fix A ⭐ Recommended**: `router.refresh()` after successful plan generation
  - Strength: One line; exact precedent at `src/components/locale-toggle.tsx:18`.
  - Tradeoff: Future plan-state mutations must remember the same refresh.
  - Confidence: HIGH — documented Next.js behavior + in-repo precedent.
  - Blind spot: Possible flicker on /plan/new unverified.
- **Fix B**: Always render the link; gate at the page only
  - Strength: No staleness possible; drops the layout query entirely.
  - Tradeoff: Contradicts FR-017's "entry point disabled" reading.
  - Confidence: MEDIUM — relitigates a settled decision.
  - Blind spot: Strictness of FR-017 wording.
- **Decision**: FIXED via Fix A — corrected the Critical Implementation Details claim, added Phase 4 #8 (plan-generator `router.refresh()` on success), added manual criterion + Progress item 4.12, updated plan-brief risk line.

### F2 — Phase 2 save flow omits userId required by createSession

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #1 (action contract) + #2 (action tests)
- **Detail**: `createSession` takes `CreateSessionInput = WorkoutSessionInput + { userId: string }` (`src/db/workout-sessions.ts:212-214`). The plan's flow never added `userId` (would not type-check) and the test contract didn't pin it — the one field that scopes the write.
- **Fix**: Amend the contract to `createSession({ ...parsed.data, userId: user.id })` and assert `userId` in the happy-path test.
- **Decision**: FIXED — action contract and test contract both amended.

### F3 — sessionName is write-required but invisible and unvalidated in the form

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 #1 (form schema) + #2 (mapper)
- **Detail**: Write schema requires `sessionName` min(1); the form renders no input for it and `day.focus` is plain `z.string()` (no min) — an empty focus would fail server-side as an opaque `invalid_input`.
- **Fix**: Defensive mapper: `sessionName ← day.focus || day.day`, pinned in mapper unit tests.
- **Decision**: FIXED — mapper contract and test contract amended.
