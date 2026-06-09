# UX Resilience & Locale Output Correctness — Implementation Plan

## Overview

Phase 3 of the test rollout (`context/foundation/test-plan.md` §3). We extend the
test suite to protect **Risk #4 (UX resilience / dropped-stream)** and **Risk #5
(locale output correctness)** with the cheapest deterministic tests that give a
real signal — and we explicitly pin one confirmed gap and document two residual
eval-shaped risks rather than papering over them.

Per §1 governing principle, the existing LLM-generated suite is **untrusted
input**: research re-derived the oracle from PRD/contract, audited the current
tests, and this plan replaces one mirror test (`build-prompt.test.ts:53-57`) and
fills the genuine gaps.

## Current State Analysis

What research (`research.md`) established firsthand:

- **Risk #4 hung-stream is an UNHANDLED GAP.** A 200-OK stream that opens then
  delivers no bytes and never closes leaves `isLoading` stuck `true` forever.
  `experimental_useObject` flips `isLoading` false only in its stream `close()`
  callback or its `catch` (network reject / `!response.ok` / empty body); a
  hung-but-open stream reaches neither (`@ai-sdk/react/dist/index.js:475-510`).
  The client (`plan-generator.tsx:35`) destructures only `{ error, isLoading,
  submit }`, discarding `stop`/`clear`; there is no client-side timer or
  `AbortController`. The route's `abortSignal: req.signal` (`route.ts:63`) is
  server-only. **The proof-of-protection clause "a dead stream surfaces an
  error, not an infinite spinner" is NOT satisfied by current code.**
- **Risk #4 other faces are covered.** ≤2s acknowledgment is a *synchronous-render*
  property (`submit()` → `setIsLoading(true)` before any await), not a timing
  property. Transport-error→toast+form and `onFinish(object:undefined)`→toast+form
  are covered by Phase 1 (`plan-generator.test.tsx:97-129`). The `:121-129` test
  is the **terminal**-error case, NOT the hung-stream face.
- **Risk #5 locale is cookie-based, threaded identically into UI and prompt.**
  Cookie `NEXT_LOCALE` → `request.ts` → route `getLocale()` → `buildPlanPrompt(input,
  locale)` → a `"Language requirement"` line. The generated-content path ends at
  the LLM; nothing deterministic verifies the model obeyed.
- **Risk #5 deterministic faces.** Catalog `pl.json`/`en.json` are at **full deep
  parity today** (identical namespaces/keys; `Plan.loaderStatuses`=6,
  `Plan.loaderQuotes`=5 in both). `plan-view.test.tsx` renders **EN only**.
  `LocaleToggle` has **no test today**.
- **The mirror trap.** `build-prompt.test.ts:53-57` asserts the prompt contains
  `"Write ALL natural-language text in Polish/English"` — a verbatim copy of
  `build-prompt.ts:19`. This is the §2 Risk #5 anti-pattern.

### Key Discoveries

- Hung-stream is reproducible via the `UseObjectController` seam
  (`src/tests/helpers/ai-stub.ts:27-39,75-81`): set `isLoading=true`, leave
  `error`/`object` undefined, never invoke `capturedOnFinish` → loader renders
  indefinitely (`research.md` §"Test seam").
- Static chrome label for the PL/EN render contract: `Plan.viewTitle`, rendered
  as the `<h1>` in `plan-view.tsx:29-31` via `t("viewTitle")`. Confirmed to
  differ: PL `"Twój Plan Treningowy"` vs EN `"Your Training Plan"`.
- `LocaleToggle` (`locale-toggle.tsx:11,16-18`): `useLocale()` for active locale;
  on click `setLocale(next)` guards `if (next === active) return` (`:16`), then
  `setLocaleCookie(next)` (`:17`), then `startTransition(() => router.refresh())`
  (`:18`). `aria-pressed={isActive}` on each button (`:37`).
- `buildPlanPrompt` defaults locale to English when omitted
  (`build-prompt.test.ts:56` confirms the current default-EN behavior).
- Existing test seams to reuse: `UseObjectController` (§6.2/§6.4),
  `NextIntlClientProvider` render wrapper (`plan-view.test.tsx:39-45`).

## Desired End State

Five new/extended tests land, all green under `npm test`, plus a selective
mutation check on `locale-toggle.tsx`:

1. The genuine hung-stream face is **pinned** by a regression-locking component
   test that documents the gap (loader shown, no terminal path, no toast).
2. Catalog pl/en deep parity is enforced by a unit test (oracle = opposite
   catalog).
3. `plan-view.test.tsx` proves a static chrome label renders in the active locale
   and differs PL vs EN.
4. `LocaleToggle` cookie behavior (write-on-switch, no-op-on-same, `aria-pressed`)
   is covered, and survives a selective Stryker run.
5. The build-prompt mirror is **replaced** by a labeled threading assertion;
   cookbook §6.4/§6.5/§6.6, the residual-risk register, `github-issues.md`, and
   test-plan §3 status are all synced.

Verify: `npm test` passes; `npm run lint` + `npx tsc --noEmit` clean;
`build-prompt.test.ts` no longer asserts the verbatim instruction string;
test-plan §3 Phase 3 status reflects `complete`.

## What We're NOT Doing

- **Not fixing the hung-stream gap.** No client-side timeout / `AbortController` /
  `stop()` wiring. That is a code change outside Lesson 2 (testing-only) scope —
  it belongs to a future bug-fix slice (Lesson 5). We pin current behavior and
  file an issue stub.
- **Not asserting generated-content language.** Whether the LLM's free-text fields
  (`summary`, `disclaimer`, notes, tips…) actually come back in the selected
  language is eval-shaped (LLM-judge / language-detection) and has no deterministic
  oracle. Deferred as a residual risk, mirroring Phase 2's deferred health eval.
- **Not testing retroactive retranslation after a UI switch.** The `plans` table
  has no `locale` column (`db/schema.ts:13-25`); FR-008 holds at generation time
  only (accepted MVP limitation).
- **Not adding e2e, accessibility, or a new test runner.** Out of current risk map
  and §4 stack.
- **Not advancing a timer-based ≤2s assertion.** Acknowledgment is a synchronous-
  render property; a fake-timer "loader visible at 2.1s" test would assert a
  behavior the code does not promise and catch no real regression.

## Implementation Approach

Five fine-grained phases, one behavior each, ordered Risk #4 → Risk #5
deterministic faces → threading + docs. Each phase is component- or unit-level
(no integration / real-DB needed for either risk). The hermetic `UseObjectController`
and `NextIntlClientProvider` seams already exist; no new scaffolding.

Phases 1–4 are TDD-suitable (each names a single red assertion). Phase 5's
threading test is also TDD-suitable; its doc edits are `/10x-implement` work.

## Critical Implementation Details

- **Pin, don't assert protection (Phase 1).** The hung-stream test must assert the
  *current* (gap) behavior — loader present, no toast, form absent — and carry an
  explicit comment that this pins an unhandled gap, NOT a recovery path. Do not
  write an assertion that expects an error surface; that would fail against current
  code and tempt an out-of-scope fix. The test's value is regression-locking the
  gap so a future fix (or accidental change) is visible.
- **Threading ≠ output (Phase 5).** The replacement assertion
  `buildPlanPrompt(input,"pl") !== buildPlanPrompt(input,"en")` MUST be commented
  as proving locale *threading into the prompt*, never rendered-output language.
  Do not reintroduce a substring check on the instruction text (that is the mirror).
- **Catalog parity oracle (Phase 2).** Assert the two catalogs against *each other*
  (key sets equal, leaf types equal, array lengths equal) — never against a
  hard-coded expected shape derived from reading one file. The opposite catalog is
  the oracle.

## Phase 1: Risk #4 — Dropped/Hung-Stream Pin

### Overview

Add the missing component test for the genuine hung-stream face: the stream is
open and "loading" but no `onFinish` and no `error` ever fire. This pins the
current (unhandled-gap) behavior and is the regression lock for any future fix.

### Changes Required:

#### 1. Generator hung-stream test

**File**: `src/tests/components/plan/plan-generator.test.tsx`

**Intent**: Add one `it(...)` that reproduces the dropped/hung-stream state and
asserts the component sits on the loader with no terminal path out and no toast —
documenting the gap the research confirmed. Distinguish it in a comment from the
existing `:121-129` *terminal*-error test.

**Contract**: Using the existing hoisted `useObjectCtrl`: set
`useObjectCtrl.isLoading = true`, leave `error` and `object` `undefined`, and
**never** invoke `capturedOnFinish`. After `renderGenerator()`, assert:
`Plan.loaderTitle` is present; the wizard (`Plan.next`) is absent; `toastError`
was **not** called. Comment block must state this pins an unhandled gap (no
client timeout/abort), cross-referencing the residual risk filed in Phase 5.

### Success Criteria:

#### Automated Verification:

- New test passes: `npm test src/tests/components/plan/plan-generator.test.tsx`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- The test comment makes clear it pins a gap, not a recovery path — a future
  reader cannot mistake it for "dropped-stream is handled."
- Removing `useObjectCtrl.isLoading = true` (or otherwise breaking the loader
  precedence) makes the test fail — confirming it locks the right behavior.

**Implementation Note**: After automated verification passes, pause for human
confirmation of the manual checks before Phase 2.

---

## Phase 2: Risk #5 — Catalog pl/en Deep Parity

### Overview

The cheapest, highest-signal Risk #5 contract: a render-independent unit test
proving the two message catalogs have identical structure. A missing/renamed key
or mismatched array length is a real, user-visible regression (untranslated UI,
or a runtime crash where `t.raw(...)` arrays are consumed).

### Changes Required:

#### 1. Catalog parity unit test

**File**: `src/tests/i18n/catalog-parity.test.ts` (new)

**Intent**: Load `pl.json` and `en.json`, recursively walk every nested key path,
and assert structural parity in both directions: identical key sets, identical
leaf value *types*, and equal array lengths. Oracle = the opposite catalog.

**Contract**: A recursive comparison over the two imported JSON objects yielding,
for every path: (a) the set of keys is equal both directions (no key in one and
not the other), (b) leaf types match (`typeof` / `Array.isArray`), (c) array
lengths match. Explicitly cover the known consumed arrays `Plan.loaderStatuses`
(length 6) and `Plan.loaderQuotes` (length 5) since `generation-loader.tsx`
consumes them via `t.raw(...)`. No hard-coded expected key list — derive from the
catalogs themselves.

### Success Criteria:

#### Automated Verification:

- New test passes: `npm test src/tests/i18n/catalog-parity.test.ts`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- Temporarily deleting or renaming a key in one catalog makes the test fail
  (parity is actually enforced, not just executed).
- Temporarily shortening `Plan.loaderStatuses` in one catalog fails the test.

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Risk #5 — UI-String Locale Render

### Overview

Prove the rendered UI chrome is in the active locale, not merely that the prompt
asked for it. Extend the existing `PlanView` test to render under both providers
and assert a static chrome label matches the respective catalog and differs across
locales.

### Changes Required:

#### 1. Extend plan-view test with PL/EN render

**File**: `src/tests/components/plan/plan-view.test.tsx`

**Intent**: Import `pl.json` alongside the existing `en.json`, parameterize the
render helper (or add a second render path) by locale, and assert that the
`Plan.viewTitle` `<h1>` text matches the active catalog under each provider — and
that the PL and EN titles differ.

**Contract**: Render `<PlanView plan={fixture}>` inside
`<NextIntlClientProvider locale="pl" messages={plMessages}>` and assert
`screen.getByText(plMessages.Plan.viewTitle)` is present; the existing EN render
asserts `enMessages.Plan.viewTitle`. Add an explicit
`expect(plMessages.Plan.viewTitle).not.toBe(enMessages.Plan.viewTitle)` so the
test fails if the catalogs ever collapse to a single string. Reuse the existing
`fixture` (its plan-content values are locale-invariant; only chrome is asserted).

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test src/tests/components/plan/plan-view.test.tsx`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- The asserted label is **static chrome** (`viewTitle`), not fixture/generated
  content — the test proves locale-driven rendering, not data passthrough.
- Pointing the PL render at `enMessages` makes the PL assertion fail.

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Risk #5 — LocaleToggle Cookie Behavior + Mutation Gate

### Overview

`LocaleToggle` owns the locale-switch contract and has no test. Cover its three
deterministic behaviors, then run a selective Stryker pass to confirm the
assertions kill mutants on the guard/cookie logic.

### Changes Required:

#### 1. LocaleToggle component test

**File**: `src/tests/components/locale-toggle.test.tsx` (new)

**Intent**: With `useLocale` and `next/navigation`'s `useRouter` mocked and
`setLocaleCookie` spied, assert: switching to the other locale writes the cookie
and calls `router.refresh()`; clicking the already-active locale is a no-op
(the `:16` guard); `aria-pressed` reflects the active locale on each button.

**Contract**: Mock `next-intl` `useLocale` to return a fixed active locale; mock
`next/navigation` `useRouter` to expose a spyable `refresh`; spy
`setLocaleCookie` from `@/i18n/config`. Three assertions: (a) click inactive
locale button → `setLocaleCookie("<other>")` called once + `router.refresh()`
called; (b) click active locale button → `setLocaleCookie` **not** called,
`router.refresh()` **not** called (no-op guard); (c) the active locale's button
has `aria-pressed="true"`, the other `"false"`. `startTransition` runs its
callback synchronously in tests, so `refresh` is observable.

### Success Criteria:

#### Automated Verification:

- New test passes: `npm test src/tests/components/locale-toggle.test.tsx`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Selective mutation run executed: `npx stryker run --mutate "src/components/locale-toggle.tsx"`

#### Manual Verification:

- Stryker survivors reviewed against "would this change hurt a user/business?":
  the no-op guard (`:16`) and the cookie-write argument are killed; any survivor
  is either killed with an added assertion or consciously ignored (equivalent/
  cosmetic) — no 100% chase.
- Removing the `:16` guard in the source makes test (b) fail.

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Risk #5 — Threading Assertion + Docs & Residual Risk

### Overview

Replace the build-prompt mirror with a labeled threading assertion, then sync all
documentation: cookbook patterns, the two residual risks, a GitHub issue stub for
the hung-stream fix, and the rollout status.

### Changes Required:

#### 1. Replace the build-prompt locale mirror

**File**: `src/tests/lib/plan/build-prompt.test.ts`

**Intent**: Delete the `:53-57` test that asserts the verbatim language
instruction (the §2 Risk #5 mirror) and replace it with a threading assertion
that proves locale actually changes the prompt — explicitly labeled as
threading-only, not output-language proof.

**Contract**: New `it(...)`: `buildPlanPrompt(baseInput, "pl")` and
`buildPlanPrompt(baseInput, "en")` are **not equal**, and `buildPlanPrompt(baseInput)`
(default) equals the `"en"` form (pins current default-EN behavior). A comment
block states this proves locale *threading into the prompt*, and that rendered-
output language is eval-shaped and deferred (cross-ref §6.6). No substring check
on the instruction text.

#### 2. Cookbook §6.4 and §6.5

**File**: `context/foundation/test-plan.md`

**Intent**: Extend §6.4 (generator UI states) to record the hung-stream pin and
its gap caveat; fill in §6.5 (asserting locale-correct output) with the three
deterministic patterns shipped (catalog parity, UI-string render, LocaleToggle)
and the threading-vs-output distinction.

**Contract**: §6.4 gains a "Phase 3" note: the hung-stream face is pinned (loader
+ no terminal + no toast) and is a documented gap, not handled. §6.5 replaces its
"TBD" with: catalog deep-parity unit test (oracle = opposite catalog); UI-string
render via dual `NextIntlClientProvider` asserting a static chrome label differs;
LocaleToggle cookie/guard/`aria-pressed`; and an explicit note that prompt-level
locale assertions prove threading only — output language is eval-deferred.

#### 3. Per-phase notes §6.6 + residual risks

**File**: `context/foundation/test-plan.md`

**Intent**: Add a "Phase 3" entry to §6.6 mirroring the Phase 1/2 format, recording
both residual risks: (a) Risk #4 hung-stream is an unhandled gap (pinned, not
fixed — needs client timeout/abort wiring, a future Lesson 5 slice); (b) Risk #5
generated-content language is eval-deferred (no deterministic oracle).

**Contract**: A §6.6 "Phase 3 — UX resilience & locale" block listing the five
tests, the two residual risks with the same "do not treat as fully closed"
caveat used for Phase 2's health eval, and pointers to the new test files.

#### 4. GitHub issue stub

**File**: `context/foundation/github-issues.md`

**Intent**: Add a Test-Rollout issue stub for Phase 3 and a one-line forward
pointer for the hung-stream client-timeout/abort fix as a future bug-fix slice.

**Contract**: A new `### [T-03]` entry under "Test Rollout" mirroring the `#9`
[T-01] format (labels `test`, PRD refs Risk #4/#5, plan folder pointer), plus a
noted follow-up for the hung-stream fix (Lesson 5 / bug-fix slice). URL/number
left as a stub if the issue is not yet created on GitHub.

#### 5. Rollout status sync §3

**File**: `context/foundation/test-plan.md`

**Intent**: Update §3 Phase 3 Status from `change opened` toward `complete` per
the status vocabulary once Progress is fully `[x]`.

**Contract**: §3 table Phase 3 row Status reflects the actual Progress state
(`planned` → `implementing` → `complete`) per the §3 status-vocabulary literals.

### Success Criteria:

#### Automated Verification:

- build-prompt test passes and no longer contains `"Write ALL natural-language text"`:
  `npm test src/tests/lib/plan/build-prompt.test.ts`
- Full suite passes: `npm test`
- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- The threading test comment makes clear it proves threading, not output language.
- §6.5 is no longer "TBD"; §6.6 has a Phase 3 entry with both residual risks.
- `github-issues.md` carries the Phase 3 stub and the hung-stream follow-up.
- test-plan §3 Phase 3 Status matches the Progress section.

**Implementation Note**: Final phase — after automated + manual verification,
confirm the rollout status sync is accurate.

---

## Testing Strategy

### Unit Tests

- Catalog deep parity (`catalog-parity.test.ts`) — key sets, leaf types, array
  lengths, both directions; consumed-array lengths (`loaderStatuses`=6,
  `loaderQuotes`=5).
- build-prompt threading (`build-prompt.test.ts`) — PL ≠ EN, default = EN; labeled
  threading-only.

### Component Tests

- Hung-stream pin (`plan-generator.test.tsx`) — `isLoading=true`, no `onFinish`/
  `error` → loader + no toast + no form (gap pin).
- UI-string locale render (`plan-view.test.tsx`) — `Plan.viewTitle` per locale,
  PL ≠ EN.
- LocaleToggle (`locale-toggle.test.tsx`) — cookie write on switch, no-op on same,
  `aria-pressed`.

### Mutation (selective)

- `npx stryker run --mutate "src/components/locale-toggle.tsx"` after Phase 4 —
  confirm the guard and cookie-write assertions kill mutants; ignore equivalent/
  cosmetic survivors consciously.

### Manual Testing Steps

1. Break the loader precedence in `plan-generator.tsx` → Phase 1 test fails.
2. Rename a key in `pl.json` → Phase 2 test fails.
3. Point the PL render at `enMessages` → Phase 3 PL assertion fails.
4. Remove the `:16` same-locale guard → Phase 4 no-op test fails.
5. Make `buildPlanPrompt` ignore the locale arg → Phase 5 threading test fails.

## Performance Considerations

None — all tests are component/unit level. Stryker on a single small file is
local and ad hoc (not a CI gate, per §5).

## Migration Notes

The build-prompt locale mirror test is **removed and replaced**, not just
extended. No production code changes in any phase.

## References

- Research: `context/changes/testing-ux-resilience-locale/research.md`
- Test plan: `context/foundation/test-plan.md` §2 (Risk #4/#5), §3 (rollout),
  §6.2/§6.4/§6.5/§6.6 (cookbook)
- Cookbook seam: `src/tests/helpers/ai-stub.ts:27-39,75-81`
- Static chrome label: `src/components/plan/plan-view.tsx:29-31`
- LocaleToggle: `src/components/locale-toggle.tsx:11,16-18`
- Mirror to replace: `src/tests/lib/plan/build-prompt.test.ts:53-57`
- Phase 2 eval-deferral precedent: `context/foundation/test-plan.md:380-387` (§6.6)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Risk #4 — Dropped/Hung-Stream Pin

#### Automated

- [x] 1.1 New test passes: `npm test src/tests/components/plan/plan-generator.test.tsx` — 0bb70e5
- [x] 1.2 Type checking passes: `npx tsc --noEmit` — 0bb70e5
- [x] 1.3 Linting passes: `npm run lint` — 0bb70e5

#### Manual

- [x] 1.4 Test comment makes clear it pins a gap, not a recovery path — 0bb70e5
- [x] 1.5 Breaking the loader precedence makes the test fail — 0bb70e5

### Phase 2: Risk #5 — Catalog pl/en Deep Parity

#### Automated

- [x] 2.1 New test passes: `npm test src/tests/i18n/catalog-parity.test.ts`
- [x] 2.2 Type checking passes: `npx tsc --noEmit`
- [x] 2.3 Linting passes: `npm run lint`

#### Manual

- [x] 2.4 Deleting/renaming a key in one catalog makes the test fail
- [x] 2.5 Shortening `Plan.loaderStatuses` in one catalog fails the test

### Phase 3: Risk #5 — UI-String Locale Render

#### Automated

- [ ] 3.1 Tests pass: `npm test src/tests/components/plan/plan-view.test.tsx`
- [ ] 3.2 Type checking passes: `npx tsc --noEmit`
- [ ] 3.3 Linting passes: `npm run lint`

#### Manual

- [ ] 3.4 Asserted label is static chrome (`viewTitle`), not fixture content
- [ ] 3.5 Pointing the PL render at `enMessages` makes the PL assertion fail

### Phase 4: Risk #5 — LocaleToggle Cookie Behavior + Mutation Gate

#### Automated

- [ ] 4.1 New test passes: `npm test src/tests/components/locale-toggle.test.tsx`
- [ ] 4.2 Type checking passes: `npx tsc --noEmit`
- [ ] 4.3 Linting passes: `npm run lint`
- [ ] 4.4 Selective mutation run executed: `npx stryker run --mutate "src/components/locale-toggle.tsx"`

#### Manual

- [ ] 4.5 Stryker survivors reviewed; guard + cookie-write mutants killed, others consciously ignored
- [ ] 4.6 Removing the `:16` guard makes the no-op test fail

### Phase 5: Risk #5 — Threading Assertion + Docs & Residual Risk

#### Automated

- [ ] 5.1 build-prompt test passes and no longer contains the verbatim instruction: `npm test src/tests/lib/plan/build-prompt.test.ts`
- [ ] 5.2 Full suite passes: `npm test`
- [ ] 5.3 Type checking passes: `npx tsc --noEmit`
- [ ] 5.4 Linting passes: `npm run lint`

#### Manual

- [ ] 5.5 Threading test comment makes clear it proves threading, not output language
- [ ] 5.6 §6.5 no longer "TBD"; §6.6 has a Phase 3 entry with both residual risks
- [ ] 5.7 `github-issues.md` carries the Phase 3 stub and hung-stream follow-up
- [ ] 5.8 test-plan §3 Phase 3 Status matches the Progress section
