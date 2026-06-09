<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Flow (S-01)

- **Plan**: context/changes/auth-flow/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Notes

The plan specified `middleware.ts` at the project root, but the implementation uses `src/proxy.ts` with Next.js 16's proxy API. This is the correct approach — `AGENTS.md` warns about Next.js 16 breaking changes and the build confirms it works (`ƒ Proxy (Middleware)`). Not flagged as a finding.

Extra files not in the plan (`src/lib/auth/errors.ts`, `src/i18n/config.ts`, `src/lib/utils.ts`) are reasonable extractions that support the planned architecture. No unplanned features were added.

## Findings

### F1 — TEMP DEBUG console statements in auth actions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/auth/actions.ts:32-37, 62-67, 72-76
- **Detail**: Three debug blocks marked "TEMP DEBUG" log raw Supabase error details (status, code, name, message) and signup metadata (userId, identities count, session presence) to console. These fire during tests too (confirmed in test output). The userId log is PII-adjacent and should not ship to production logs.
- **Fix**: Remove all three TEMP DEBUG blocks.
- **Decision**: FIXED

### F2 — Protected routes use an allowlist that must be manually extended

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/proxy.ts:9
- **Detail**: PROTECTED_PREFIXES = ["/dashboard"]. Any future protected route (e.g. /plans, /profile from S-02+) requires a manual update to this array, creating a risk of accidentally exposing routes.
- **Fix A ⭐ Recommended**: Invert to deny-by-default — list public routes ("/", "/login") instead of protected ones. New routes are protected automatically.
  - Strength: New routes are protected automatically. Only the public routes need listing.
  - Tradeoff: Slightly more work if public routes grow. But auth apps typically have far fewer public than protected routes.
  - Confidence: HIGH — standard pattern for auth-gated apps.
  - Blind spot: None significant.
- **Fix B**: Document as a must-update rule for future slices.
  - Strength: Zero code change now. The current slice only has /dashboard.
  - Tradeoff: Relies on developer memory; a missed update is a silent security gap.
  - Confidence: MEDIUM — documentation works if enforced, but it's easy to forget.
  - Blind spot: No automated check to catch a missed update.
- **Decision**: FIXED via Fix A + ACCEPTED-AS-RULE: Deny-by-default route protection

### F3 — Sonner Toaster uses useTheme() without a ThemeProvider

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/sonner.tsx:8
- **Detail**: The shadcn-generated Sonner component calls useTheme() from next-themes, but no ThemeProvider is mounted in the app tree. It works because useTheme() defaults to "system" and Sonner handles that gracefully — but it's a provider mismatch that could break if next-themes changes defaults.
- **Fix**: Hardcode theme="dark" on the Toaster since the app is dark-only, bypassing the useTheme() call entirely.
- **Decision**: FIXED

### F4 — Unused Database import

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/(auth)/login/page.tsx:2
- **Detail**: `import { Database } from "lucide-react"` is defined but never used. ESLint confirms: 1 warning. Leftover from a removed "Powered by Supabase" badge.
- **Fix**: Remove the unused import.
- **Decision**: FIXED

### F5 — Success toast unreachable after server redirect

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/auth-card.tsx:50
- **Detail**: The onSubmit handler fires toast.success() after calling the server action, but successful actions call redirect() on the server (which throws), so the toast line is dead code. The user never sees a success toast. Functionally harmless.
- **Fix**: Remove the success toast or move the welcome message to the dashboard page.
- **Decision**: FIXED

### F6 — Root page uses client-side useTranslations pattern

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/page.tsx
- **Detail**: Uses useTranslations() (client-side hook) while login and dashboard pages use getTranslations() (server async). The page works because next-intl supports useTranslations in server components when the plugin is configured, but it's inconsistent with the pattern established by the other pages.
- **Fix**: Convert to async function using getTranslations() to match login/page.tsx and dashboard/page.tsx.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Use getTranslations in server components
