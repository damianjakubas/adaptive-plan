<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Auth Flow (S-01) Implementation Plan

- **Plan**: context/changes/auth-flow/plan.md
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE (light — close to SOUND; both fixes are quick)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

6/6 paths ✓ (page.tsx, layout.tsx, globals.css, package.json, supabase/config.toml, next.config.ts), `enable_confirmations = false` confirmed at supabase/config.toml:221 ✓, mockup tokens confirmed (`glass-panel`×2, `input-dark`×4, `surface-container`×9, Montserrat×6 in logowanie_rejestracja/code.html) ✓, DESIGN.md + roadmap + design assets present ✓, Progress↔Phase mechanically consistent ✓. Codebase is essentially empty (placeholder-only), so blast-radius and pattern-proliferation sweeps are trivially nil.

## Findings

### F1 — Auth actions file location left unresolved (and self-contradictory)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §3 (line 141) vs Phase 4 §3 (line 269)
- **Detail**: Phase 2 specifies the actions file as "src/app/(auth)/actions.ts (new) — or src/lib/auth/actions.ts" — an unresolved "or" the implementer must guess. It conflicts with Phase 4, whose test path is src/tests/lib/auth/actions.test.ts, presuming src/lib/auth/actions.ts. Functionally it matters: signOut is consumed by (app)/dashboard (line 220), so co-locating the actions inside the (auth) route group couples two route groups through a shared import. src/lib/auth/ is the neutral home.
- **Fix**: Pin the location to src/lib/auth/actions.ts in Phase 2 §3; drop the "(auth)/actions.ts — or" alternative so it matches the Phase 4 test path and keeps signOut reusable across both shells.
- **Decision**: PENDING

### F2 — Gating middleware never enumerates the protected vs. public path set

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §4 (lines 147–153) + Critical Implementation Details (line 43)
- **Detail**: The plan describes the gating logic well ("unauthenticated → auth route; authed at auth route → dashboard") and nails the cookie-preservation gotcha, but never says which concrete paths are "protected." Route groups (auth)/(app) don't appear in the URL, so the matcher can't key off the group name — it sees /login and /dashboard. Two unspecified cases bite at runtime: (1) the root "/" — Phase 1 leaves the themed "TEST" placeholder page (src/app/page.tsx) live and public; whether "/" is gated and what an authed user sees there is undefined; (2) if the auth route is accidentally in the protected set, an unauthenticated redirect to /login re-triggers the gate → redirect loop. The matcher spec is only "exclude static assets and _next" — the auth-route exemption and public allowlist are implicit.
- **Fix**: In Phase 2 §4, enumerate the path policy explicitly: protected = /dashboard (and future (app) routes); public = / and the auth route; the auth-route redirect-to-dashboard branch must short-circuit BEFORE the protected-path check to avoid a loop. State what "/" does for an authed user (leave public, or redirect to /dashboard).
- **Decision**: PENDING

### F3 — i18n + a working PL↔EN toggle pulled forward from S-03

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 §4 (lines 80–86); roadmap S-03
- **Detail**: The roadmap parks locale support in S-03 (FR-008); this slice's FRs are register/login/logout only (FR-001/002/007). Phase 1 builds the full next-intl layer, BOTH pl.json + en.json catalogs, the provider, the next.config plugin wiring, AND a live PL↔EN toggle — most of S-03's UI-facing outcome for the auth+dashboard surface. The plan and brief acknowledge this and attribute it to a user request ("user wants the switch now"), and the cookie-based approach keeps it out of the middleware, so this is not a defect — just the single largest scope-add beyond the slice's FRs. Every later slice inherits dual-catalog maintenance for new auth/dashboard copy.
- **Fix**: Confirm S-01 genuinely needs the interactive toggle now, not just the i18n layer + PL catalog. If the toggle isn't needed to demo S-01, ship auth in PL and defer the live toggle + en.json to S-03. Otherwise proceed as planned (already an owned decision).
- **Decision**: PENDING
