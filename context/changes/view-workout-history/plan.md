# View Workout History (S-02) Implementation Plan

## Overview

Build the read-only workout-history page (roadmap S-02, PRD US-02 / FR-018 / FR-025): a
newest-first list of the user's logged sessions at `/history`, each row showing date,
session name/type, target muscle groups, and duration — styled after the
`historia_trening_w` mockup minus its out-of-scope controls — plus a plan-state-aware
empty state, and the navbar's disabled "Progress" placeholder replaced by an enabled
"History" link.

## Current State Analysis

- **The data layer is complete and integration-tested** (F-01, archived).
  `listSessions(userId)` (`src/db/workout-sessions.ts:100-122`) returns `SessionListItem[]`
  newest-first by `performed_at` (index-backed), `userId`-scoped, with `muscleGroups`
  already derived (distinct, non-null, exercise-position order) and **sets never loaded**.
  The DTO (`src/db/workout-sessions.ts:216-226`) carries exactly the fields FR-018 needs:
  `id`, `performedAt: Date`, `sessionName`, `sessionType: string | null`,
  `durationMinutes`, `muscleGroups: string[]` (plus `note`, `sourcePlanId` — unused here).
  Ordering, isolation, and muscle-group derivation are pinned by
  `src/tests/db/workout-sessions.test.ts` — this slice does not re-test them.
- **Sessions exist to read** — S-01 (archived) writes them via `saveWorkoutSession`
  (`src/lib/workout/actions.ts:19-60`); `performedAt` is server-stamped at save time, so
  history dates are real timestamps, not user-picked.
- **Page pattern is established** (`src/app/(app)/log-workout/page.tsx`,
  `src/app/(app)/plan/page.tsx`): RSC does `getUser()` → `redirect("/login")`, fetches,
  branches to an empty state, hands data to a presentational component. `generateMetadata`
  reuses the `Nav` title key.
- **Navbar** (`src/app/(app)/layout.tsx:65-67`): the disabled "Progress" span with the
  `Nav.progress` i18n key is the placeholder this slice replaces. The layout already
  computes `hasActivePlan` for the Log Workout entry — the History link needs no state.
- **Route gating is deny-by-default** (`src/proxy.ts:9`, lessons.md): `/history` is
  automatically auth-gated; no proxy change needed.
- **i18n**: messages in `src/i18n/messages/{en,pl}.json`, namespaced (`Nav`, `LogWorkout`,
  …). No `next-intl` formatter usage exists anywhere yet — date formatting is new ground.
- **Mockup** (`context/foundation/design/historia_trening_w/code.html`) uses the project's
  existing design tokens (`surface-container*`, `label-md`/`body-md` type scale,
  `stack-*`/`container-margin` spacing), so the layout translates directly. It includes
  search + filter (FR-019 dropped), edit/delete icons (S-03), and load-more (FR-022
  parked) — all omitted per the decisions below.
- **Test infra**: Vitest + jsdom; RTL component tests wrap components in
  `NextIntlClientProvider` (`src/tests/components/workout/workout-session-editor.test.tsx`);
  pure-logic unit tests under `src/tests/lib/**`.

## Desired End State

A logged-in user clicks "History" in the navbar (PL: "Historia") and sees their logged
sessions newest-first in the mockup's row layout: a date cell (relative day label over a
locale-formatted absolute date), the session name with a type badge and a muscle-groups
line, and a compact duration ("1h 15m"). With no logged sessions, an empty state points
to `/log-workout` when an active plan exists, or to `/plan/new` when it doesn't. The page
renders fully in PL and EN with no hard-coded strings. The "Progress" placeholder is gone.

### Key Discoveries:

- `listSessions` already returns the exact list DTO, newest-first — this slice is purely
  page + components + i18n + navbar wiring (`src/db/workout-sessions.ts:100-122,216-226`).
- The whole page can be server-rendered — nothing on it is interactive, so no
  `"use client"` is needed anywhere in this slice.
- `next-intl` hooks (`useTranslations`, `useFormatter`, `useLocale`) work in **sync,
  non-async server components**; the lessons.md `getTranslations` rule explicitly scopes
  itself to `page.tsx`/`layout.tsx` files. A sync presentational list component is both a
  valid RSC and directly RTL-testable under `NextIntlClientProvider` — the same harness
  the existing component tests use.
- `sessionName`/`sessionType` carry S-01's mapping (`sessionName` ← plan day's `focus`,
  `sessionType` ← plan day's `day`), so the badge will show day names like
  "Poniedziałek" — not the mockup's "STRENGTH"/"CARDIO" sample data. `sessionType` is
  nullable; the badge must be conditional.

## What We're NOT Doing

- **No edit/delete actions** — the mockup's pencil/trash icons are S-03
  (`curate-workout-history`). No actions column is rendered this slice.
- **No search or filter** — FR-019 was dropped in shaping; the mockup's search bar and
  filter button are omitted entirely (no disabled stubs).
- **No pagination / "load more"** — FR-022 is parked; the page renders the full list.
- **No analytics, charts, or progress aggregation** — PRD Non-Goal; the navbar label
  changes from "Progress" to "History" partly to stop over-promising this.
- **No data-layer changes** — no schema, migration, or `workout-sessions.ts` edits;
  `listSessions` is consumed as-is (the unused `note`/`sourcePlanId` DTO fields are fine).
- **No client-side interactivity** — no `"use client"`, no loading skeletons (RSC renders
  with data), no router work beyond plain links.
- **No proxy/auth changes** — deny-by-default gating already covers `/history`.

## Implementation Approach

Mirror the `/log-workout` page anatomy exactly: an RSC page that gates auth, fetches via
the existing data-access function, branches to an empty state, and hands typed data to a
presentational component — except here even the presentational layer stays on the server
(sync components, no client boundary). New pure formatting logic (duration, relative day)
lives in `src/lib/history/` as separate helper files (per the helpers-in-separate-files
convention), unit-tested in isolation with an injected `now` so day-boundary cases are
deterministic. The list component takes `sessions` + `now` as props and is tested with
RTL under `NextIntlClientProvider` in both locales. The navbar swap retires the
`Nav.progress` key and placeholder span in the same phase so no dangling key or reference
ever exists.

## Critical Implementation Details

- **i18n pattern split** — the page uses `await getTranslations(...)` (lessons.md rule,
  scoped to `page.tsx`/`layout.tsx`); the presentational components (`HistoryList`,
  `HistoryEmptyState`) are **sync** components using `useTranslations`/`useFormatter`
  *without* `"use client"` — next-intl's supported shared-component pattern (confirmed for
  next-intl 4.x: non-async components importing `useTranslations`/`useFormatter` render as
  Server Components by default). This is what makes them RTL-testable; do not make them
  async, and do not add `"use client"`.
  - **No precedent — read this before reaching for the "obvious" pattern.** Every existing
    `useTranslations` call site in the repo is in a `"use client"` file, and the lessons.md
    *body* says "reserve `useTranslations` for client components." That rule's `Applies to`
    scopes it to `page.tsx`/`layout.tsx`, so it does **not** bind these components — but the
    wording invites two wrong "fixes" that both defeat the point: adding `"use client"`
    (ships client JS for static content — the slice's whole rendering decision is to avoid
    that) or switching to async `getTranslations` (breaks synchronous RTL rendering — the
    reason these are presentational components in the first place). lessons.md now carries a
    matching carve-out ("Use getTranslations in server components" → *Carve-out*) so this
    stays settled — no implementation step; it's already documented.
- **Relative-day semantics are calendar-based, not 24-hour windows** — "today" means same
  calendar date as `now`, "yesterday" the previous calendar date, weekday label for 2–6
  calendar days back, plain date for ≥7 days. The helper takes `now: Date` as an explicit
  parameter (tests inject it; the page passes `new Date()`). Comparisons use the server's
  local calendar — acceptable for this solo-first app; do not reach for a timezone library.
  Note that the component's absolute-date `useFormatter().dateTime(...)` also inherits the
  server time zone (no `timeZone` is set in `src/i18n/request.ts`; next-intl defaults to
  the server's zone), so the relative label and the absolute date stay on the *same*
  calendar today. If a `timeZone` is ever configured in `request.ts`, `relative-day`'s
  `now`-source must move to that same zone in lockstep, or the two will desync.
- **Key removal ordering** — `Nav.history` is *added* in Phase 1 (safe: unused keys are
  harmless), but `Nav.progress` is *removed* in Phase 3 in the same commit as the layout
  edit that drops `t("progress")` — removing the key earlier crashes the shell
  (`next-intl` throws on missing messages in dev).

## Phase 1: Formatting Helpers & i18n Strings

### Overview

Create the two pure formatting helpers with exhaustive unit tests, and add all new PL/EN
message strings (the `History` namespace + `Nav.history`).

### Changes Required:

#### 1. Duration formatter

**File**: `src/lib/history/format-duration.ts`

**Intent**: Render `durationMinutes` compactly as in the mockup: `75` → `"1h 15m"`,
`45` → `"45m"`, `120` → `"2h"`. Locale-independent (the mockup uses the same notation in
PL), so this is a pure function with no i18n dependency.

**Contract**: `formatDuration(minutes: number): string`. Whole hours omit the minutes
part (`"2h"`, not `"2h 0m"`); under an hour omits the hours part (`"45m"`); `0` → `"0m"`.
Exported per the hook-file/barrel convention (`export default` + named type exports if any).

#### 2. Relative-day helper

**File**: `src/lib/history/relative-day.ts`

**Intent**: Classify a session's `performedAt` against `now` so the date cell can show
the mockup's primary label (Today / Yesterday / weekday / date) without the component
owning calendar math. Returns a discriminant, not display text — translation and date
formatting stay in the component.

**Contract**: `getRelativeDay(performedAt: Date, now: Date): RelativeDayKind` where
`RelativeDayKind = "today" | "yesterday" | "weekday" | "date"`. Calendar-date comparison
(see Critical Implementation Details): same date → `"today"`; previous date →
`"yesterday"`; 2–6 days back → `"weekday"`; everything else (≥7 days back, or any future
date) → `"date"`.

#### 3. Helper unit tests

**File**: `src/tests/lib/history/format-duration.test.ts`,
`src/tests/lib/history/relative-day.test.ts`

**Intent**: Pin the formatting contracts from the oracle above (mockup + decisions), not
from the implementation. Cover: duration at `0`, `<60`, exact hour, hour+minutes;
relative-day at same-day boundary (23:59 vs 00:00 next day), yesterday boundary, exactly
6 vs 7 days back, and a future `performedAt` (clock skew → `"date"`, never a crash).

#### 4. Message strings (both locales)

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Add `Nav.history` ("History" / "Historia") and a new `History` namespace with
every string the page, list, and empty state need. Do **not** remove `Nav.progress` yet
(Phase 3). Keys sorted per the existing file style.

**Contract**: `History` namespace keys — `eyebrow` ("Archive" / "Archiwum"), `title`
("Your Workout History" / "Twoja Historia Treningów"), `subtitle` (viewing-focused copy —
no edit/delete mention; that's S-03), `columnDate`, `columnSession`, `columnDuration`,
`durationMobileLabel` (the mobile "Czas:" prefix), `today`, `yesterday`, `emptyTitle`,
`emptyBodyLog` + `emptyCtaLog` (has-plan variant → `/log-workout`), `emptyBodyPlan` +
`emptyCtaPlan` (no-plan variant → `/plan/new`).

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npx tsc --noEmit`
- Lint passes (incl. sorted JSON-adjacent conventions): `npm run lint`
- Helper unit tests pass, covering the boundary cases above: `npm test`

#### Manual Verification:

- None (pure logic + strings; fully covered by unit tests and later phases' rendering).

---

## Phase 2: History List & Empty-State Components

### Overview

Build the presentational `HistoryList` (mockup row grid minus out-of-scope controls) and
the plan-state-aware `HistoryEmptyState`, with RTL tests for both.

### Changes Required:

#### 1. History list component

**File**: `src/components/history/history-list.tsx`

**Intent**: Sync presentational server component rendering the mockup's panel: a
desktop-only header row (date / session / duration column labels) and one row per
session. No actions column, no search/filter, no load-more. Uses `useTranslations("History")`
and `useFormatter` (no `"use client"` — see Critical Implementation Details).

**Contract**: `Props { now: Date; sessions: SessionListItem[] }` (type imported from
`@/db/workout-sessions`). Per row:
- **Date cell** — calendar icon in a bordered circle; primary line from
  `getRelativeDay`: `"today"`/`"yesterday"` → translated label, `"weekday"` → locale
  weekday name via `useFormatter().dateTime(performedAt, { weekday: "long" })`, `"date"`
  → locale-formatted date as the primary line; secondary line = locale-formatted absolute
  date (omitted when the primary already is the date).
- **Session cell** — `sessionName` (emphasized), `sessionType` in an uppercase pill badge
  **only when non-null**, then a muted line joining `muscleGroups` with `", "` (omitted
  when the array is empty).
- **Duration cell** — timer icon + `formatDuration(durationMinutes)`; on mobile, prefix
  with `durationMobileLabel`.
- Responsive: stacked flex column on mobile, 12-col grid from `md:` up (mockup spans
  3/5/2 + the freed actions columns folding into session/duration; exact spans are the
  implementer's call). Rows are `<li>` items in a `<ul>` (semantic list; the mockup's
  div soup is not a constraint). Existing lucide-react icons replace Material Symbols
  (e.g. `Calendar`, `Timer`).

#### 2. History empty state

**File**: `src/components/history/history-empty-state.tsx`

**Intent**: Reuse `LogWorkoutEmptyState`'s centered *layout*
(`src/components/workout/log-workout-empty-state.tsx`) — but **not** its i18n mechanism:
that component is **async** + `getTranslations`, whereas this one is a **sync** shared
component using `useTranslations` (per the i18n pattern split above, so it stays
RTL-testable). Branches copy + CTA on plan state.

**Contract**: `Props { hasActivePlan: boolean }`. `true` → `emptyBodyLog` + Button-asChild
link to `/log-workout`; `false` → `emptyBodyPlan` + link to `/plan/new`. Shared `emptyTitle`.

#### 3. Barrel

**File**: `src/components/history/index.ts`

**Intent**: Export both components, matching `src/components/workout/index.ts` style.

#### 4. Component tests

**File**: `src/tests/components/history/history-list.test.tsx`,
`src/tests/components/history/history-empty-state.test.tsx`

**Intent**: RTL under `NextIntlClientProvider` (mirroring
`src/tests/components/workout/workout-session-editor.test.tsx`), asserting against the
PRD/mockup oracle: every FR-018 field renders per row (relative label + absolute date,
name, conditional type badge, muscle groups, compact duration); rows appear in the order
given (the component must not re-sort — ordering is `listSessions`' contract); null
`sessionType` renders no badge; empty `muscleGroups` renders no groups line; a fixed
`now` prop drives deterministic today/yesterday/weekday rows; empty state shows the
correct CTA target per `hasActivePlan` (assert `href`); key strings render in **both PL
and EN** (locale-parameterized test).

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Component test suites pass: `npm test`

#### Manual Verification:

- None at this phase — visual verification happens once the route exists (Phase 3).

---

## Phase 3: Route & Navbar Wiring

### Overview

Add the `/history` RSC page and swap the navbar's disabled "Progress" placeholder for the
enabled History link; retire the `Nav.progress` key.

### Changes Required:

#### 1. History page

**File**: `src/app/(app)/history/page.tsx`

**Intent**: Mirror `src/app/(app)/log-workout/page.tsx` anatomy: `generateMetadata` from
`Nav.history`; `getUser()` → `redirect("/login")`; `listSessions(user.id)`; when empty,
check `hasActivePlan(user.id)` (only on this branch — the non-empty path needs no plan
query) and render `<HistoryEmptyState>`; otherwise render the page header (eyebrow,
title, subtitle from `History` via `getTranslations`) and `<HistoryList sessions={…} now={new Date()} />`.

**Contract**: Async RSC, no `"use client"`. Page header lives on the page (not in the
list component); the empty state replaces the whole content area including the header,
matching the `/log-workout` empty-state behavior. Container width: the mockup's list is
wide — use a wider container than log-workout's `max-w-3xl` (e.g. the mockup's
~`max-w-5xl`-equivalent; implementer's call within the existing container/margin tokens).

#### 2. Navbar swap

**File**: `src/app/(app)/layout.tsx`

**Intent**: Replace the disabled "Progress" span (`layout.tsx:65-67`) with a plain
always-enabled `<Link href="/history">{t("history")}</Link>` styled like the existing
`/plan` link. Update the layout's doc comment (it currently says "Progress is shown as a
placeholder until its slice lands"). No state check — history is meaningful regardless of
plan state.

#### 3. Retire the progress key

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Remove `Nav.progress` from both locales in this same phase/commit as the
layout edit (see Critical Implementation Details — never leave the span referencing a
deleted key, nor an unreferenced placeholder key behind).

### Success Criteria:

#### Automated Verification:

- Type-check passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Full test suite still green: `npm test`
- Production build succeeds (catches missing-message errors): `npm run build`
- No remaining references: `grep -rn "Nav.progress\|t(\"progress\")" src/` returns nothing

#### Manual Verification:

- Logged in with saved sessions: `/history` lists them newest-first with date (relative
  label + absolute), name, type badge, muscle groups, and "1h 15m"-style duration.
- Log a new workout → it appears at the top of `/history` immediately (server render, no
  stale cache).
- Empty-history user **with** an active plan: empty state CTA goes to `/log-workout`.
- Empty-history user **without** a plan (fresh account): CTA goes to `/plan/new`.
- PL ↔ EN toggle on `/history`: all strings, weekday names, and absolute dates switch
  locale; no hard-coded text.
- Navbar across all pages: "History" link enabled and navigates; "Progress" placeholder
  gone; existing plan / new-plan / log-workout / locale / sign-out controls untouched.
- Logged out, visiting `/history` directly redirects to `/login`.
- Mobile viewport: rows stack legibly (date / session / duration), desktop shows the
  column grid.
- History intact after plan regeneration: regenerate the active plan, revisit `/history`,
  previously logged sessions are still present (FR-024 UI spot-check).
- History list renders within ~1s perceived (PRD guardrail; `listSessions` is index-backed
  and loads no sets).

**Implementation Note**: After automated verification passes, pause for the human to run
the manual checklist above before closing the plan out.

---

## Testing Strategy

### Unit Tests:

- `format-duration`: `0m`, sub-hour, exact hour, hour+minutes cases.
- `relative-day`: today/yesterday calendar boundaries, 6-vs-7-day weekday cutoff, future
  timestamps degrade to `"date"`.

### Integration Tests:

- None new — `listSessions` ordering, isolation, and muscle-group derivation are already
  pinned by `src/tests/db/workout-sessions.test.ts` (F-01). This slice adds no queries.

### Component Tests (RTL):

- `HistoryList`: field rendering per row, given-order preservation, conditional badge and
  muscle-groups line, deterministic relative-date rendering via injected `now`, PL + EN.
- `HistoryEmptyState`: CTA target per `hasActivePlan`.

### Manual Testing Steps:

1. Run the Phase 3 manual checklist (sessions present, both empty-state variants, PL/EN,
   navbar, auth redirect, mobile).
2. Regenerate the active plan, then revisit `/history` — previously logged sessions are
   intact (FR-024 spot-check from the UI side).

## Performance Considerations

`listSessions` loads session rows + exercise muscle-group columns only (no sets), served
by the `(user_id, performed_at desc)` index — the PRD's ~1s p95 guardrail is met by
construction. The full list renders without pagination (FR-022 parked); at solo-user
volumes this is well within budget. The empty-path `hasActivePlan` check is an id-only
limit-1 query and runs only when the list is empty.

## Migration Notes

None — no schema or data changes. The slice is purely additive UI; reverting it removes
the route, components, helpers, and strings, and restores the navbar placeholder.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (US-02, FR-018, FR-025; FR-019/FR-022 exclusions)
- Mockup: `context/foundation/design/historia_trening_w/{code.html,screen.png}`
- Data access consumed: `src/db/workout-sessions.ts:100-122` (`listSessions`),
  `:216-226` (`SessionListItem`)
- Page pattern mirrored: `src/app/(app)/log-workout/page.tsx`
- Empty-state pattern mirrored: `src/components/workout/log-workout-empty-state.tsx`
- Navbar placeholder replaced: `src/app/(app)/layout.tsx:65-67`
- Component-test harness mirrored: `src/tests/components/workout/workout-session-editor.test.tsx`
- Prior plans: `context/archive/2026-06-09-workout-session-snapshot-store/plan.md` (F-01),
  `context/archive/2026-06-09-log-workout-from-plan/plan.md` (S-01)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Formatting Helpers & i18n Strings

#### Automated

- [x] 1.1 Type-check passes: `npx tsc --noEmit`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 Helper unit tests pass (duration + relative-day boundary cases): `npm test`

### Phase 2: History List & Empty-State Components

#### Automated

- [ ] 2.1 Type-check passes: `npx tsc --noEmit`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 Component test suites pass (HistoryList + HistoryEmptyState): `npm test`

### Phase 3: Route & Navbar Wiring

#### Automated

- [ ] 3.1 Type-check passes: `npx tsc --noEmit`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Full test suite green: `npm test`
- [ ] 3.4 Production build succeeds: `npm run build`
- [ ] 3.5 No remaining `Nav.progress` / `t("progress")` references in `src/`

#### Manual

- [ ] 3.6 Sessions list renders newest-first with all FR-018 fields and compact duration
- [ ] 3.7 Newly logged workout appears at the top of `/history`
- [ ] 3.8 Empty state with active plan → CTA to `/log-workout`
- [ ] 3.9 Empty state without plan → CTA to `/plan/new`
- [ ] 3.10 PL ↔ EN parity on `/history` (strings, weekdays, dates)
- [ ] 3.11 Navbar: History enabled everywhere, Progress gone, existing controls untouched
- [ ] 3.12 Unauthenticated `/history` redirects to `/login`
- [ ] 3.13 Mobile stacked layout / desktop column grid both legible
- [ ] 3.14 History intact after plan regeneration (FR-024 UI spot-check)
- [ ] 3.15 History list renders within ~1s perceived (PRD guardrail)
