# Welcome Dashboard (S-04) Implementation Plan

## Overview

Build a **state-aware welcome dashboard** at `/dashboard` — a new authenticated page,
reachable from the shared navbar, whose primary call-to-action adapts to the user's plan
state and which renders gracefully for a brand-new user (no active plan, no logged history).

- No active plan → a "generate a plan" CTA.
- Active plan → a primary "log a workout" CTA + a secondary "view plan" CTA, plus a glance
  at the active plan (goal/summary) and the 2–3 most recent logged sessions.

This slice is **additive and self-contained**: it adds one route, one component module, one
i18n namespace, and one navbar entry. It deliberately does **not** change the post-auth
redirect target — that isolation is S-05's job (`dashboard-post-auth-landing`), gated
separately so an auth-flow regression can't hide inside this feature.

## Current State Analysis

The `(app)` route group already establishes every pattern this page needs:

- **Page shape** — each authenticated page is an async server component: `getUser()` →
  `redirect("/login")` if absent → load data → render, with a sync presentational
  sub-component for the body (`src/app/(app)/plan/page.tsx:20-34`,
  `src/app/(app)/history/page.tsx:15-43`).
- **State derivation already exists** — `hasActivePlan(userId)` is an id-only, limit-1 query
  (`src/db/plans.ts:26-34`); `getActivePlan(userId)` returns the full row whose `plan` JSONB
  casts to `GeneratedPlan` (with `goal`, `summary`, `weeklySchedule`)
  (`src/db/plans.ts:10-19`); `listSessions(userId)` returns `SessionListItem[]` newest-first
  (`src/db/workout-sessions.ts:100-122`). No new data layer is required.
- **Shared navbar** — `src/app/(app)/layout.tsx:40-71` renders the nav entries (plan, newPlan,
  log-workout [plan-gated], history), the locale toggle, and sign-out. Adding "Dashboard"
  means editing this file.
- **i18n** — namespaces live in `src/i18n/messages/{en,pl}.json`; `Nav` holds nav labels
  (`en.json:132-138`). Server pages use `getTranslations`; sync presentational components use
  `useTranslations` without `"use client"` (lessons.md carve-out, applied in `HistoryEmptyState`).
- **Empty-state precedent** — `HistoryEmptyState` (`src/components/history/history-empty-state.tsx`)
  is a dumb, props-driven, bilingually-tested component branching its CTA on plan state — the
  exact shape this dashboard's CTA block mirrors.
- **Test convention** — `src/tests/components/history/history-empty-state.test.tsx` shows the
  pattern: `describe.each` over `{en, pl}`, render under `NextIntlClientProvider`, assert
  visible copy + CTA `href` per state.

## Desired End State

A logged-in user navigating to `/dashboard` (via the new leftmost navbar entry) sees:

- **No active plan** (incl. brand-new user): a welcome heading and a single "generate a plan"
  CTA → `/plan/new`. No plan glance, no recent-sessions section, no errors.
- **Active plan, no history**: heading, the active plan's goal/summary, a primary "log a
  workout" CTA → `/log-workout` and a secondary "view plan" CTA → `/plan`, and a small inline
  "no sessions yet" line where the recent-sessions list would be.
- **Active plan + history**: as above, plus the 2–3 most recent sessions (date, name, duration).

Verify: visit `/dashboard` in each of the three states, in both PL and EN; confirm the right
CTA(s)/destinations and that nothing throws for a brand-new account.

### Key Discoveries:

- `hasActivePlan` vs `getActivePlan` — the page needs the full plan (for the goal/summary
  glance), so it calls `getActivePlan` once and derives the boolean from `!== null`; it does
  **not** also call `hasActivePlan` (that helper is for the cheap navbar gate).
  `src/db/plans.ts:10-34`
- The dumb component must use the sync `useTranslations` shared-component pattern (no
  `"use client"`, no async `getTranslations`) to stay RTL-testable — lessons.md carve-out,
  first applied in `view-workout-history`.
- `SessionListItem` already carries `performedAt`, `sessionName`, `durationMinutes`
  (`src/db/workout-sessions.ts:216-226`) — enough for the glance with no schema change.
- Nav entry order is cosmetic but the file is shared; the only correctness constraint is not
  disturbing the `canLogWorkout` gating block or the locale/sign-out controls.

## What We're NOT Doing

- **Not** changing the post-auth redirect (still `/plan`) — that is S-05.
- **Not** touching `/` (root keeps redirecting to login).
- **Not** reproducing the marketing mockup's hero copy or its three feature cards — the third
  card ("plan evolves with every workout") promises AI adaptation, an explicit PRD Non-Goal.
  We reuse the mockup's dark visual language only.
- **Not** adding any data-access function, schema column, migration, or API route.
- **Not** adding plan-adaptation, analytics/charts, or history search/filter (PRD Non-Goals).
- **Not** changing `hasActivePlan` or the navbar's existing log-workout gating logic.

## Implementation Approach

Smart/dumb split, mirroring `/history`:

- **Smart server page** (`(app)/dashboard/page.tsx`) — auth gate, loads `getActivePlan` +
  `listSessions`, derives a small view-model, hands it to the presentational component.
- **Dumb presentational module** (`src/components/dashboard/`) — props-driven, sync
  `useTranslations`, no side effects. The state-aware CTA block is the only real logic and is
  the unit the RTL tests pin.

Phases are ordered low-level → high-level so each builds on a green predecessor: strings +
nav first (no behavior), then the dumb components (the testable risk), then the server page
that wires data in, then the tests + manual verification.

## Phase 1: Strings & navbar entry

### Overview

Add the translation keys the dashboard needs and surface a "Dashboard" entry as the leftmost
navbar link. No behavioral logic yet — this phase only makes copy and navigation available.

### Changes Required:

#### 1. Translation messages

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Add a `dashboard` label to the existing `Nav` namespace, and a new `Dashboard`
namespace holding the page's user-facing strings (heading/greeting, the per-state CTA labels,
plan-glance labels, and the recent-sessions section heading + its empty line). Both locales
must carry identical key sets (FR-025).

> Note: top-level namespaces in these JSON catalogs are **feature-grouped, not alphabetical**
> (Common, Auth, …, Nav, History, LogWorkout, WorkoutErrors), and ESLint `sort-keys-fix`
> does **not** lint JSON. Place `Dashboard` with the feature namespaces (after `Nav`) and sort
> keys *within* the namespace asc by convention; parity is enforced by `catalog-parity.test.ts`.

**Contract**: New `Nav.dashboard` key in both files. New `Dashboard` namespace with keys for:
page heading, no-plan CTA label, has-plan primary (log) CTA label, has-plan secondary (view
plan) CTA label, plan-glance label (e.g. an "Your plan" / goal eyebrow), recent-sessions
section heading, and a "no sessions yet" inline line. Keys sorted asc (ESLint
`sort-keys-fix`); namespace placed in alphabetical position among existing namespaces. No
hard-coded strings will live in components.

#### 2. Navbar entry

**File**: `src/app/(app)/layout.tsx`

**Intent**: Add a `Dashboard` link as the first (leftmost) nav item, before the existing
"Training Plan" link, using the same `Link` styling as its siblings. Leave the `canLogWorkout`
gating block and the locale/sign-out controls untouched.

**Contract**: A new `<Link href="/dashboard">{t("dashboard")}</Link>` inserted at the head of
the `<nav>` list (`layout.tsx:40-71`), reusing the existing `font-label-md … hover:text-primary-container`
className. No change to `hasActivePlan` usage or the disabled-span logic.

### Success Criteria:

#### Automated Verification:

- Type-checking passes: `npx tsc --noEmit`
- Linting passes (key/import sort): `npm run lint`
- Both message files parse and share identical key sets (covered by existing i18n parity test if present; otherwise verified in Phase 4)

#### Manual Verification:

- The navbar shows "Dashboard" first, in both PL and EN, with no layout breakage to the other entries, locale toggle, or sign-out.

**Implementation Note**: After this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: Presentational dashboard components (dumb)

### Overview

Build the props-driven presentational module that renders the state-aware home. This is where
the slice's only real logic lives (which CTA(s) to show and where they point), so it is built
as pure, RTL-testable components per the lessons.md sync-`useTranslations` carve-out.

### Changes Required:

#### 1. State-aware CTA block

**File**: `src/components/dashboard/dashboard-cta.tsx`

**Intent**: Render the primary call-to-action(s) from plan state (Business Logic rule 4 /
FR-010): when there is no active plan, a single "generate a plan" button → `/plan/new`; when
there is an active plan, a primary "log a workout" button → `/log-workout` and a secondary
(outline) "view plan" button → `/plan`. Mirrors `HistoryEmptyState`'s structure and the
`Button asChild` + `Link` pattern.

**Contract**: `function DashboardCta({ hasActivePlan }: Props)`, `interface Props { hasActivePlan: boolean }`
declared after the component (rule 1). Sync `useTranslations("Dashboard")`, no `"use client"`.
Has-plan branch renders two buttons (primary log, `variant="outline"` view-plan); no-plan
branch renders one. Destinations: `/plan/new`, `/log-workout`, `/plan`.

#### 2. Plan-glance + recent-sessions glance

**File**: `src/components/dashboard/dashboard-recent-sessions.tsx` (and a plan-summary line,
either inline in `DashboardHome` or as a sibling presentational piece)

**Intent**: Render the active plan's goal/summary as a short context line and a list of the
recent sessions passed in; when the sessions array is empty, render an inline "no sessions yet"
line instead of an empty block. Date/duration formatting **reuses the existing lib helpers**
`formatDuration` (`@/lib/history/format-duration`) and, if relative day labels are wanted,
`getRelativeDay` (`@/lib/history/relative-day`) plus next-intl's `useFormatter` — exactly as
`HistoryList` does (`history-list.tsx:1-3,37-45`). Do **not** create a new date/label helper
in the dashboard module; if only a plain absolute date is needed, a single inline
`useFormatter().dateTime(...)` call is acceptable (convention rule 9 carve-out).

**Contract**: `function DashboardRecentSessions({ sessions, now }: Props)` where `sessions` is
typed `SessionListItem[]` (`@/db/workout-sessions`) — the same prop shape `HistoryList` accepts;
the component reads only `id`/`performedAt`/`sessionName`/`durationMinutes`. No bespoke
view-subset type and no per-row mapping in the page (the page just slices to 2–3 and passes the
`SessionListItem[]` through). `interface Props` after the component. Empty array → the localized empty
line. Date/duration mapping reuses `@/lib/history/format-duration` (+ `relative-day` if used),
never a newly-introduced dashboard helper (DRY / convention rule 9).

#### 3. Composition + barrel

**File**: `src/components/dashboard/dashboard-home.tsx`, `src/components/dashboard/index.ts`

**Intent**: `DashboardHome` composes the heading, the plan-summary line (has-plan only),
`DashboardCta`, and `DashboardRecentSessions` (has-plan only) into the page body using the
mockup's dark layout language and existing spacing/typography tokens. The barrel re-exports
the public components for the page to import.

**Contract**: `function DashboardHome({ hasActivePlan, planGoal, planSummary, recentSessions, now }: Props)`,
`interface Props` after the component. No data fetching, no side effects (dumb). `index.ts`
exports `DashboardHome` (and any directly-imported siblings).

### Success Criteria:

#### Automated Verification:

- Type-checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Rendered in isolation (e.g. via the Phase 3 page) the CTA block shows the correct button(s)/destinations for each state and the glance degrades cleanly when there are no sessions.

**Implementation Note**: After this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 3: Dashboard route (smart server page)

### Overview

Add the authenticated `/dashboard` route that gates on auth, loads state, derives the
view-model, and renders `DashboardHome`. Mirrors `/history`'s server-page contract.

### Changes Required:

#### 1. Dashboard page

**File**: `src/app/(app)/dashboard/page.tsx`

**Intent**: Async server component: `getUser()` → `redirect("/login")` if absent; call
`getActivePlan(user.id)` once and `listSessions(user.id)`; derive `hasActivePlan` from the
plan being non-null, pull `goal`/`summary` off the cast `GeneratedPlan` when present, slice
the sessions to the most recent 2–3 for the glance; pass these as props to `DashboardHome`.
Add `generateMetadata` titling the page from `Nav.dashboard`.

**Contract**: Default-exported async `DashboardPage`. Reuses `getUser`
(`src/lib/supabase/get-user.ts`), `getActivePlan` (`src/db/plans.ts`), `listSessions`
(`src/db/workout-sessions.ts`), and casts `activePlan.plan as GeneratedPlan`
(`src/lib/validation/plan-schema.ts`) exactly as `plan/page.tsx` does. Session slicing is a
pure inline expression; any richer plan→view-model mapping that grows beyond a line moves to a
helper file (convention rule 9). No new data-access functions.

### Success Criteria:

#### Automated Verification:

- Type-checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- App builds: `npm run build`

#### Manual Verification:

- `/dashboard` renders for: a brand-new account (no plan, no history) with the generate CTA and no errors; an account with a plan but no history (plan glance + log/view CTAs + "no sessions yet"); an account with a plan and history (recent sessions listed). All three in both PL and EN.
- An unauthenticated request to `/dashboard` redirects to `/login` (existing gate).

**Implementation Note**: After this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 4: Tests & verification

### Overview

Pin the slice's only real behavioral risk — the state-aware CTA derivation (FR-010 /
Business Logic rule 4) — with bilingual RTL tests at the cheapest layer, plus the
brand-new-user render. Manual locale/visual pass closes the slice.

### Changes Required:

#### 1. CTA / state-logic tests

**File**: `src/tests/components/dashboard/dashboard-cta.test.tsx` (and, if the empty/glance
branch carries logic worth pinning, `dashboard-recent-sessions.test.tsx`)

**Intent**: Bilingual `describe.each` over `{en, pl}`, rendering the component under
`NextIntlClientProvider`, asserting per state: no-plan renders exactly the "generate" CTA →
`/plan/new`; has-plan renders the primary "log a workout" CTA → `/log-workout` **and** the
secondary "view plan" CTA → `/plan`. Add a brand-new-user case asserting `DashboardHome`
renders without throwing when `planGoal`/`recentSessions` are empty. Oracle is FR-010 + the
chosen CTA layout, not the component's own output.

**Contract**: Mirrors `history-empty-state.test.tsx` structure (render helper +
`describe.each` + `getByRole("link", { name })` / `toHaveAttribute("href", …)`). Assertions
reference message values from the imported `en.json`/`pl.json`, not hard-coded strings.

### Success Criteria:

#### Automated Verification:

- New tests pass: `npm run test`
- Full suite still green (no regression): `npm run test`
- Type-checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Toggling PL/EN on `/dashboard` swaps all visible strings with no missing-key warnings.
- Visual check: the page reads as a coherent home (not a marketing landing page) and contains no AI-adaptation / "plan evolves" promise.

**Implementation Note**: After this phase and all automated verification passes, pause for
final manual confirmation; then the slice is ready to archive and hand off to S-05.

---

## Testing Strategy

### Unit / component Tests (RTL, Vitest):

- State-aware CTA derivation across all three states, in both locales (the core risk).
- Brand-new-user render: `DashboardHome` with no plan and no sessions renders without error
  (the guardrail S-05 depends on).

### Edge cases:

- Active plan present but `goal`/`summary` empty strings → glance still renders without crash.
- Empty `recentSessions` array → inline "no sessions yet" line, not an empty block.

### Manual Testing Steps:

1. Brand-new account → `/dashboard`: generate CTA only, no errors, both locales.
2. Generate a plan, no logs → `/dashboard`: plan glance + log/view CTAs + "no sessions yet".
3. Log a session → `/dashboard`: recent session appears; verify date/name/duration.
4. Toggle PL/EN on each: all strings swap, no console missing-key warnings.
5. Sign out, hit `/dashboard` directly → redirected to `/login`.

## Performance Considerations

The page issues two already-indexed, user-scoped reads (`getActivePlan`, `listSessions`) —
the same reads `/plan` and `/history` already perform; well within the PRD's ~1s p95
guardrail. No new query patterns.

## Migration Notes

None — additive route + component + strings only. Fully withdrawable with no data impact.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-04, lines 116–126)
- PRD: FR-010, FR-025, Business Logic rule 4 (`context/foundation/prd.md:91,126,150`)
- Pattern to mirror: `src/app/(app)/history/page.tsx`, `src/components/history/history-empty-state.tsx`
- Test pattern: `src/tests/components/history/history-empty-state.test.tsx`
- Data layer: `src/db/plans.ts:10-34`, `src/db/workout-sessions.ts:100-122`
- Lessons carve-out (sync `useTranslations`): `context/foundation/lessons.md:18`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Strings & navbar entry

#### Automated

- [x] 1.1 Type-checking passes: `npx tsc --noEmit`
- [x] 1.2 Linting passes (key/import sort): `npm run lint`
- [x] 1.3 Both message files parse and share identical key sets

#### Manual

- [ ] 1.4 Navbar shows "Dashboard" first in PL and EN with no layout breakage

### Phase 2: Presentational dashboard components (dumb)

#### Automated

- [ ] 2.1 Type-checking passes: `npx tsc --noEmit`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 CTA block shows correct button(s)/destinations per state; glance degrades cleanly with no sessions

### Phase 3: Dashboard route (smart server page)

#### Automated

- [ ] 3.1 Type-checking passes: `npx tsc --noEmit`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 App builds: `npm run build`

#### Manual

- [ ] 3.4 `/dashboard` renders correctly across all three states in PL and EN
- [ ] 3.5 Unauthenticated request to `/dashboard` redirects to `/login`

### Phase 4: Tests & verification

#### Automated

- [ ] 4.1 New tests pass: `npm run test`
- [ ] 4.2 Full suite still green: `npm run test`
- [ ] 4.3 Type-checking passes: `npx tsc --noEmit`
- [ ] 4.4 Linting passes: `npm run lint`

#### Manual

- [ ] 4.5 PL/EN toggle swaps all strings with no missing-key warnings
- [ ] 4.6 Page reads as a home (not marketing) and makes no AI-adaptation promise
