# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Deny-by-default route protection

- **Context**: src/proxy.ts — route gating logic
- **Problem**: Using a protected-routes allowlist (PROTECTED_PREFIXES) meant new routes were unprotected by default. A developer adding /plans or /profile would need to remember to update the array — a missed update is a silent security gap.
- **Rule**: Route gating must use a public-routes list (deny-by-default), not a protected-routes list. New routes are protected automatically; only explicitly public routes bypass auth.
- **Applies to**: Any middleware/proxy route gating logic, future slices that add new routes.

## Use getTranslations in server components

- **Context**: src/app/page.tsx — root page using useTranslations() instead of getTranslations()
- **Problem**: Inconsistent i18n pattern — login and dashboard pages use the async getTranslations() server pattern while the root page used the client-side useTranslations() hook without "use client". Both work but the inconsistency makes conventions unclear for future pages.
- **Rule**: Server components (pages, layouts) must use `getTranslations()` from `next-intl/server` with an async function signature. Reserve `useTranslations()` for client components marked with `"use client"`.
- **Applies to**: All `page.tsx` and `layout.tsx` files that need i18n, future slices adding new pages.
- **Carve-out (sync presentational server components)**: A **sync** (non-async) presentational component MAY import `useTranslations`/`useFormatter`/`useLocale` from `next-intl` *without* `"use client"`. These are next-intl "shared components" (confirmed for next-intl 4.x): non-async components render as Server Components by default, so no client JS is shipped, and they remain synchronously renderable under `NextIntlClientProvider` in RTL tests. Do **not** "fix" such a component by adding `"use client"` (defeats the no-client-JS intent) or by converting it to async `getTranslations` (breaks RTL rendering). The async-`getTranslations` rule above applies to `page.tsx`/`layout.tsx`, not to these presentational components. First applied in `view-workout-history` (`HistoryList`, `HistoryEmptyState`).
