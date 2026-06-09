---
change_id: locale-support
title: "Locale support: PL/EN for UI and generation"
status: archived
created: 2026-06-03
updated: 2026-06-09
archived_at: 2026-06-09T18:09:42Z
---

## Notes

Roadmap slice **S-03** (from `context/foundation/roadmap.md`).

- **Outcome:** user can select a locale (Polish or English) from the navbar; both the UI and the generated training plan render in the selected language.
- **PRD refs:** FR-008

## Closure rationale — delivered without a dedicated implementation

S-03's full outcome was already delivered incidentally by the two preceding slices. No
net-new feature work was required; this slice is closed administratively.

- **Locale selector + UI localization** — built in **S-01 (auth-flow)**: `next-intl`
  with cookie-based locale (`NEXT_LOCALE`, default `pl`, 1-year persistence),
  `LocaleToggle` rendered on every layout, and `pl.json` / `en.json` message catalogs.
  Server components use `getTranslations()`, client components use `useTranslations()`
  (see `context/foundation/lessons.md`).
- **Localized generated plan** — built in **S-02 (plan-generation)**: the AI route
  reads the active locale (`getLocale()`) and passes it to `buildPlanPrompt(input, locale)`,
  which appends a strict "Language requirement" instruction so all natural-language
  plan text is emitted in the selected language. Every plan-feature UI string is in the
  i18n catalogs with full pl/en parity (`Plan`, `PlanErrors`, `Nav` namespaces) — no
  hardcoded user-facing strings.

The roadmap's open unknown (URL-prefixed `/pl` `/en` vs client/cookie locale state) was
resolved in implementation as **cookie-based** — no URL prefixing, no `[locale]` segment.

### Acceptance criteria (ADA-7) — all met

- Language selector visible in the navbar (PL / EN) — `LocaleToggle`.
- All UI text renders in the selected locale — `next-intl` catalogs.
- Generated training plan is in the selected locale — locale passed into the prompt.
- Locale preference persists across sessions — `NEXT_LOCALE` cookie (1 year).
- Default locale is Polish — `defaultLocale = "pl"`.

### Known limitation (accepted, not addressed)

A plan generated in one language stays in that language if the user later switches the
UI locale (the `plans` table stores no `locale`, and `/plan` renders the stored plan
as-is). FR-008 therefore holds at generation time, not retroactively after a switch.
Decision: accept as a documented limitation for the MVP rather than add a `locale`
column + regeneration/translation affordance.
