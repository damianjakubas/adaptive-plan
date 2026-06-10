<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Log a Workout from the Active Plan (S-01)

- **Plan**: context/changes/log-workout-from-plan/plan.md
- **Scope**: Phase 4 of 4 (Route, Day Picker & Navbar Wiring) — commit 8bbfaa9
- **Date**: 2026-06-10
- **Verdict**: NEEDS ATTENTION → resolved in triage (2026-06-10): F1–F5 fixed, F6 consciously skipped
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria: `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npx vitest run` 202/202 ✅ · `npm run build` ✅ (/log-workout dynamic in route manifest).

Plan drift: all 8 planned changes MATCH; no missing items, no scope creep. Benign extras: transport-error try/catch in the flow, `metadata` export (mirrors /plan), plan-generator router-refresh test. Earlier-phase contracts (mapper, action, editor) consumed exactly as designed.

## Findings

### F1 — Unguarded DB call in shared layout crashes every authenticated page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/app/(app)/layout.tsx:25
- **Detail**: The (app) layout was DB-free before this phase. `await hasActivePlan(user.id)` now runs on every hard page load with no try/catch — a transient DB failure throws inside the shared shell and takes down /plan, /plan/new, and /log-workout, not just the navbar affordance. The save action wraps its equivalent call (src/lib/workout/actions.ts:31-37).
- **Fix**: Wrap the call in try/catch defaulting to `false` — a degraded (disabled) navbar entry beats an error boundary on every page.
- **Decision**: FIXED — try/catch defaulting to false, logged via logWorkoutError (stage: navbar-active-plan-check)

### F2 — Unvalidated jsonb cast can crash the flow client-side

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/app/(app)/log-workout/page.tsx:42
- **Detail**: `(activePlan.plan as GeneratedPlan).weeklySchedule` casts a jsonb column without validation. A malformed/pre-schema plan makes `weeklySchedule` undefined and LogWorkoutFlow's `.filter(...)` (log-workout-flow.tsx:27) throws a TypeError. /plan has the same cast but this page dereferences one level deeper.
- **Fix A ⭐ Recommended**: Fall back with `?.weeklySchedule ?? []`
  - Strength: One-line guard; malformed plan degrades to the existing "no loggable days" state.
  - Tradeoff: Doesn't validate inner day/exercise shape.
  - Confidence: HIGH — the flow already renders a designed empty state.
  - Blind spot: Whether malformed plans can exist in prod (all writes go through planOutputSchema today).
- **Fix B**: Validate with `planOutputSchema.safeParse`, render empty state on failure
  - Strength: Fully sound — flow only ever sees a valid schedule.
  - Tradeoff: Inconsistent unless /plan gets the same treatment; repo-wide pattern change beyond this slice.
  - Confidence: MEDIUM — right long-term, wrong scope for S-01.
  - Blind spot: safeParse cost on a large jsonb per page load (minor).
- **Decision**: FIXED via Fix A — `(activePlan.plan as Partial<GeneratedPlan>).weeklySchedule ?? []`

### F3 — Triple `getUser()` round-trip per hard page load

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Performance)
- **Location**: src/app/(app)/layout.tsx:21-24
- **Detail**: Proxy → layout → page each create a fresh supabase client and call `getUser()` (network round-trip each). /log-workout now costs 3 auth calls + 2 plan queries per hard load. DB side is fine: hasActivePlan is the id-only, limit-1 indexed query the plan demanded.
- **Fix**: Wrap `createClient` (or a getUser helper) in `React.cache()` so layout and page share one validated user per request.
  - Strength: Standard App Router per-request memoization; fixes it app-wide.
  - Tradeoff: Touches the shared supabase server client — blast radius beyond this slice.
  - Confidence: HIGH — documented Next.js pattern.
  - Blind spot: Low urgency at Hobby-plan traffic.
- **Decision**: FIXED — new `src/lib/supabase/get-user.ts` (React.cache-wrapped getUser); swapped into (app)/layout, /plan, /plan/new, /log-workout. Middleware/route handler/action untouched.

### F4 — Hardcoded English page metadata title

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/(app)/log-workout/page.tsx:9-11
- **Detail**: `metadata.title: "Log Workout"` is English-only — small FR-025 gap in the `<title>`. Mirrors /plan's "Training Plan"; pre-existing repo-wide pattern, not a phase-4 regression.
- **Fix**: Switch to `generateMetadata` with getTranslations — ideally a repo-wide follow-up covering /plan too.
- **Decision**: FIXED — generateMetadata + Nav-namespace titles on /log-workout, /plan, /plan/new (no new catalog keys needed).

### F5 — Disabled navbar entry invisible to screen readers

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/(app)/layout.tsx:55-57
- **Detail**: Disabled "Log Workout" is a plain span with opacity-40 — no aria-disabled or sr-only explanation. Byte-identical to the existing Progress placeholder, so consistent.
- **Fix**: Add `aria-disabled="true"` + sr-only hint to both spans (could ride with S-02).
- **Decision**: FIXED — aria-disabled="true" added to both disabled navbar spans (Log Workout + Progress).

### F6 — onSave closure at the rule-9 boundary

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/components/workout/log-workout-flow.tsx:57-73
- **Detail**: Inline onSave closure carries action call, ok/error branch, toasts, saving state. Compliant today (once-used inline closure, same shape as auth-card.tsx) but at the limit of AGENTS.md rule 9. Double-submit is genuinely handled (`saving` stays true through redirect + RHF isSubmitting).
- **Fix**: No action now; extract a shared save handler when S-03 reuses this flow shape.
- **Decision**: SKIPPED — compliant today; revisit when S-03 reuses the flow.
