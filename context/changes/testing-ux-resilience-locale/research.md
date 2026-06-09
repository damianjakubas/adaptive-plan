---
date: 2026-06-08T14:05:58Z
researcher: damianjakubas
git_commit: e7cdb8393aa1b2f7aadc638370836af4c8decb2e
branch: testing-ux-resilience-locale
repository: adaptive-plan
topic: "UX resilience & locale output correctness (test rollout Phase 3) — Risk #4 (dropped-stream / no-progress) and Risk #5 (locale output)"
tags: [research, codebase, testing, ux-resilience, dropped-stream, infinite-spinner, locale, i18n, next-intl, ai-sdk]
status: complete
last_updated: 2026-06-08
last_updated_by: damianjakubas
---

# Research: UX resilience & locale output correctness (test rollout Phase 3)

**Date**: 2026-06-08T14:05:58Z
**Researcher**: damianjakubas
**Git Commit**: e7cdb8393aa1b2f7aadc638370836af4c8decb2e
**Branch**: testing-ux-resilience-locale
**Repository**: adaptive-plan

## Research Question

Ground the oracle for **Phase 3** of `context/foundation/test-plan.md` §3 — "UX resilience & locale" — covering:

- **Risk #4 (UX resilience):** the user sees acknowledgment ≤2s and progress while streaming; *a dead stream surfaces an error, not an infinite spinner*. Ground the generator state machine (pending/streaming/error states) and how a dropped stream is detected.
- **Risk #5 (locale output):** the output rendered to the user is in the selected locale (PL vs EN), *not merely that the prompt asked for it*. Decide whether locale correctness is assertable deterministically or needs an eval, and where UI strings vs generated content are localized.

Per §1 governing principle the existing LLM-generated suite is **untrusted input** — audit it, re-derive the oracle from sources (PRD/contract), then extend.

### Scope decisions taken before research (user-confirmed)

1. **Risk #5 eval face is DEFERRED.** Cover the deterministic faces (catalog parity, locale-threading contract, UI-string rendering); document the generated-*content* language as an unproven residual eval-shaped risk — mirroring how Phase 2 deferred the health-respect eval.
2. **Risk #4 — test existing behavior only.** Stay within Lesson 2 (testing, not bug-fixing). If research finds no handling for a silently-dropped stream, document it as a known gap/residual risk; do **not** add code.

## Summary

**Risk #4 — the infinite-spinner face is an UNHANDLED GAP, confirmed firsthand.** A client stream that opens (200 OK, non-empty body) but then delivers no bytes and never closes leaves `isLoading` stuck `true` forever — no error fires, no timeout, no abort. `experimental_useObject` flips `isLoading` back to `false` only in its stream `close()` callback or its `catch` (network reject / `!response.ok` / empty body); a hung-but-open stream reaches neither (`node_modules/@ai-sdk/react/dist/index.js:475-510`). The client (`plan-generator.tsx:35`) destructures only `{ error, isLoading, submit }` — it discards the SDK's `stop`/`clear`, and there is no client-side timer/`AbortController`. The route's `abortSignal: req.signal` (`route.ts:63`) is server-only (forwards a *client-initiated* connection close to the model); it does nothing for a client whose socket stays open but starves. **So the proof-of-protection clause "a dead stream surfaces an error, not an infinite spinner" is NOT satisfied by current code.** Per the scope decision, Phase 3 pins the *current* behavior with a component test (regression-locks the gap) and documents it as a residual risk; the "surfaces an error" assertion cannot be made true without an out-of-scope code change (client timeout/abort wiring).

**Risk #4 — the other faces are deterministic and mostly covered.** The ≤2s acknowledgment is *structurally guaranteed*: `submit()` calls `setIsLoading(true)` synchronously before the awaited fetch (`index.js:450`), so the loader (`plan-generator.tsx:57-59`) mounts on the next render with no network round-trip. The loader has an `aria-live="polite"` status region (`generation-loader.tsx:44`); its progress ring is **explicitly decorative** (`generation-loader.tsx:8-11,30-32`) — there is no real stream-derived %. Phase 1 already covered transport-error→toast+form and `onFinish(object:undefined)`→toast+form (`plan-generator.test.tsx:97-129`).

**Risk #5 — locale is cookie-based and threaded identically into UI and prompt.** Cookie `NEXT_LOCALE` → `request.ts:6-15` → route `getLocale()` (`route.ts:59`) → `buildPlanPrompt(input, locale)` (`route.ts:93`) → a `"Language requirement"` instruction (`build-prompt.ts:18-19`). The generated-content path ends at the LLM; nothing deterministic verifies the model obeyed.

**Risk #5 — three deterministic contracts give real signal; one eval face is deferred.**
- **Catalog pl/en deep parity** (`messages/pl.json` vs `en.json`) — verified at **full parity today** (identical namespaces/keys; `Plan.loaderStatuses` length 6 and `Plan.loaderQuotes` length 5 in both). Oracle = the opposite catalog, **not a mirror**; a missing/renamed key or mismatched array length is a real, user-visible regression. Strongest candidate.
- **UI-string render under PL vs EN provider** — render a plan component twice and assert a *static chrome label* matches the respective catalog and differs across locales. Gap today: `plan-view.test.tsx` renders **EN only**.
- **LocaleToggle cookie behavior** — write `NEXT_LOCALE` on switch, no-op on same-locale (the `locale-toggle.tsx:16` guard), `aria-pressed` reflects active locale. **No test exists today.**
- **DEFERRED (eval-shaped):** whether the generated free-text fields (`summary`, `disclaimer`, exercise notes, tips, etc.) actually come back in the selected language — only an LLM-judge / language-detection heuristic can prove this. Residual risk.

**Risk #5 — the mirror trap to avoid.** `build-prompt.test.ts:53-57` asserts the prompt contains `"Write ALL natural-language text in Polish/English"` — a verbatim copy of `build-prompt.ts:19`. This is exactly the §2 Risk #5 anti-pattern (asserting the prompt instead of the output). A `buildPlanPrompt(input,"pl") !== buildPlanPrompt(input,"en")` threading contract is acceptable **only if explicitly labeled as proving threading, not rendered-output language.**

**Out of scope (confirmed):** a plan generated in one locale stays in that locale after a UI switch — the `plans` table has **no `locale` column** (`db/schema.ts:13-25`) and `/plan` renders the stored jsonb as-is. FR-008 holds at *generation time*, not retroactively (accepted MVP limitation, `context/changes/locale-support/change.md:46-49`).

## Detailed Findings

### Risk #4 — Generator state machine (`src/components/plan/plan-generator.tsx`)

Local state: `finalPlan: GeneratedPlan | null` (`:32`), `submittedValues` (`:33`). Hook-derived: `error`, `isLoading` (`:35`). Render precedence (`:53-69`):

1. `finalPlan` truthy → `<PlanView>` (`:53-55`) — **terminal (success)**; set only in `onFinish` when `object` present (`:37-39`).
2. else `isLoading` → `<GenerationLoader>` (`:57-59`) — **non-terminal**, intended transient.
3. else → `<ParameterForm>` with preserved `submittedValues` (`:61-68`) — idle / retry surface.

Error surfaces are *toast-only, no state change*: transport `error` toasts via `useEffect` (`:47-51`); `onFinish(object:undefined)` toasts (`:40-42`). Both fall through to the form because `isLoading` is false and `finalPlan` is null. The **only** way out of the loader is the hook flipping `isLoading` false or `onFinish`/`error` firing — all SDK-driven.

### Risk #4 — `experimental_useObject` lifecycle (the dead-stream proof)

In `node_modules/@ai-sdk/react/dist/index.js`:
- `:450` — `setIsLoading(true)` set synchronously inside `submit`.
- `:451-452` — an `AbortController` is created (and `stop`/`clear` exist at `:436-445,512-515`) but nothing client-side ever triggers them on a timeout.
- `:465` `!response.ok` → throws → `catch`; `:470` empty body → throws → `catch`.
- `:475-500` — `await response.body.pipeThrough(...).pipeTo(new WritableStream({...}))` drains the stream.
- `:487` `setIsLoading(false)` runs **only inside `close()`** (clean stream end); `:489-497` `onFinish` likewise fires only in `close()` after `safeValidateTypes`.
- `:508-509` — the **only other** path to `isLoading=false`/`setError` is the `catch`, reached only when `pipeTo` rejects.

**A 200-OK stream that hangs with no chunks and never closes** makes `pipeTo` pend forever → neither `close()` nor `catch` runs → `isLoading` is permanently `true`, no error, no `onFinish`. Repo-wide scan for `setTimeout|AbortController|abortSignal|.abort|timeout|stop()|clear()` across the plan client + route returns exactly one hit: `route.ts:63` `abortSignal: req.signal` (server-side only).

### Risk #4 — Loader & acknowledgment (`src/components/plan/generation-loader.tsx`)

- ≤2s acknowledgment **structurally guaranteed** — loader is a pure function of parent `isLoading`, which flips true synchronously on `submit` (`plan-generator.tsx:66` → SDK `:450`), no network round-trip.
- `aria-live="polite"` status region present (`:44`); status/quote rotate on a 5s `setInterval` (`:19-25`).
- Progress ring is **decorative** by explicit design (`:8-11` comment; `:30-32` CSS `animate-spin`, no value bound); the partial streamed object is intentionally not shown.

### Risk #4 — Test seam (`src/tests/helpers/ai-stub.ts`)

`UseObjectController` (`:75-81`) exposes `capturedOnFinish`, `error`, `isLoading`, `object`, `submit`; `createUseObjectMock` (`:27-39`) returns the controller's state lazily. **A dropped-stream state is reproducible**: set `isLoading=true`, leave `error`/`object` undefined, and never invoke `capturedOnFinish` → the component renders the loader indefinitely. A component test under this state pins the current (gap) behavior; it cannot exercise a recovery path because none exists.

### Risk #5 — Locale flow end-to-end

| Hop | What happens | Citation |
|-----|--------------|----------|
| Cookie write | `setLocaleCookie` writes `NEXT_LOCALE=<locale>;path=/;max-age=31536000;samesite=lax` | `src/i18n/config.ts:14-16` (`LOCALE_COOKIE` at `:7`) |
| Cookie read → request config | `getRequestConfig` reads `NEXT_LOCALE`, validates via `isLocale`, falls back to `defaultLocale` (`"pl"`), loads `./messages/${locale}.json` | `src/i18n/request.ts:6-15`; `config.ts:4,9-11` |
| Root layout | `getLocale()` → `<html lang={locale}>` + `NextIntlClientProvider` | `src/app/layout.tsx:29,33,37` |
| Route obtains locale | `const locale = await getLocale()` | `src/app/api/plan/generate/route.ts:3,59` |
| Locale → prompt | `prompt: buildPlanPrompt(input, locale)` | `route.ts:93` |
| Locale → language line | `locale === "pl" ? "Polish" : "English"` + appended `"Language requirement"` | `src/lib/plan/build-prompt.ts:18-19,44` |

### Risk #5 — Catalog parity (definitive)

`pl.json` and `en.json` are at **full deep parity, zero drift** (recursive walk of every nested key path, leaf type, array length):
- Identical top-level namespaces: `Auth, AuthErrors, Common, Nav, Plan, PlanErrors, Validation`.
- No keys present in one and not the other.
- Array-length parity: `Plan.loaderStatuses` = 6 in both; `Plan.loaderQuotes` = 5 in both (these arrays are consumed by `generation-loader.tsx:15-16` via `t.raw(...)`, so a length/type mismatch would surface at runtime).

This is the strongest deterministic contract: oracle is the opposite catalog (not the implementation). **Not a mirror.**

### Risk #5 — Output schema structural vs free-text split (`src/lib/validation/plan-schema.ts`)

- **STRUCTURAL / locale-invariant** (deterministically assertable regardless of locale): `calorieTarget.kcal` (`:52`), `cardioGoal.targetMinutes` (`:57`), `timelineWeeks` (`:70`), `weeklySchedule[].isRest` (`:42`), `exercise.sets` (`:34`), and the JSON field names themselves.
- **FREE-TEXT / locale-bearing** (only an eval can verify *language*): `summary` (`:69`), `goal` (`:66`), `disclaimer` (`:65`), `calorieTarget.note` (`:53`), `cardioGoal.note` (`:56`), `dietaryTips[].title/.body` (`:60-63`), `milestones[]` (`:67`), `progression[]` (`:68`), `weeklySchedule[].day/.focus` (`:39,41`), `exercise.name/.note/.muscleGroup/.reps` (`:30-33`). `build-prompt.ts:19` enumerates exactly these — which is why asserting that line is a mirror.

### Risk #5 — LocaleToggle (`src/components/locale-toggle.tsx`)

Reads active locale via `useLocale()` (`:11`); on click → `setLocale(next)` guards `if (next === active) return` (`:16`) → `setLocaleCookie(next)` (`:17`) → `startTransition(() => router.refresh())` (`:18`). Switch = cookie write + `router.refresh()` (server re-reads cookie in `getRequestConfig`); no full reload. Mounted on every layout (`(app)/layout.tsx:43`, `(auth)/layout.tsx:16`, `page.tsx:13`). Deterministically testable with `useLocale`/`useRouter` mocked: assert cookie write on switch, no-op on same-locale (`:16` guard), `aria-pressed` state. **No test exists today.**

### Existing-test audit (untrusted suite — Risk #4 / #5 lens)

**`src/tests/components/plan/plan-generator.test.tsx`** (renders EN only, `:51`):

| Test | Lines | Asserts | Verdict |
|------|-------|---------|---------|
| loader shown while loading | 71-78 | `isLoading=true` → loaderTitle present, wizard hidden | genuine (loading face) |
| plan view from final object | 80-95 | `onFinish(valid)` → summary + exercises render, wizard gone | genuine (success contract) |
| stream error → toast + form | 97-105 | `error` set → toast `generation_failed`, form retained | genuine (transport-error face) |
| onFinish no valid object → toast + form | 107-119 | `onFinish(object:undefined,error)` → toast, form, loader absent | genuine (schema-fail face) |
| isLoading=false + terminal error → no spinner-forever | 121-129 | loader absent, form shown, toast fired | genuine (*terminal*-error case) |

**Gap:** every test sets an already-terminal snapshot or fires `onFinish` synchronously. **No test holds `isLoading=true` with neither `onFinish` nor `error`** — the actual dropped/hung-stream face. (Note: the `:121-129` test is the `isLoading=false`+error terminal case, *not* the hung-stream case — do not mistake it for dropped-stream coverage.)

**`src/tests/components/plan/plan-view.test.tsx`** (renders EN only, `:41`): three happy-path tests (weekly grid/summary/tips/cardio/calorie `:48-61`; day-tab swap `:63-75`; disclaimer `:77-82`). Catalog-derived assertions read `enMessages.Plan.*` (tautological — catalog value == catalog value); everything else is fixture (English) content. **No PL render; no assertion that switching provider locale changes a static label.** Does not protect the Risk #5 UI-string face.

**`src/tests/lib/plan/build-prompt.test.ts`** (pure unit, no i18n provider): five tests, all asserting substrings the template itself builds → **mirror tests** (goal/health/equipment echo `:22-27`; disclaimer instruction `:32-36`; `"none reported"` fallback `:38-43`; "honor the stated health issues" `:48-51`; **locale line `:53-57`**). The locale test (`:53-57`) is the Risk #5 mirror trap — asserts the prompt asked for the language, never the rendered output.

## Code References

- `src/components/plan/plan-generator.tsx:35,53-69` — state machine; discards `stop`/`clear`; loader has no exit on hung stream
- `node_modules/@ai-sdk/react/dist/index.js:450,475-510` — `isLoading` false only on stream `close()`/`catch`; no timeout
- `src/app/api/plan/generate/route.ts:59,63,93` — `getLocale()`, server-only `abortSignal: req.signal`, `buildPlanPrompt(input, locale)`
- `src/components/plan/generation-loader.tsx:8-11,30-32,44` — decorative ring, `aria-live` status, 5s rotation
- `src/tests/helpers/ai-stub.ts:27-39,75-81` — `UseObjectController` seam (can reproduce the stuck-loader state)
- `src/i18n/config.ts:7,14-16` · `src/i18n/request.ts:6-15` — cookie-based locale, no URL prefix
- `src/i18n/messages/pl.json` · `en.json` — full deep parity (incl. `loaderStatuses`=6, `loaderQuotes`=5)
- `src/lib/validation/plan-schema.ts:30-70` — structural vs free-text field split
- `src/components/locale-toggle.tsx:11,16-18` — cookie write + `router.refresh()`; same-locale no-op guard
- `src/db/schema.ts:13-25` — `plans` table has **no `locale` column**
- `src/tests/components/plan/plan-generator.test.tsx:71-129` · `plan-view.test.tsx:41-82` · `src/tests/lib/plan/build-prompt.test.ts:53-57`

## Architecture Insights

- **Two structurally different "stuck" outcomes for Risk #4.** A *terminal* failure (transport error, schema-fail) flips `isLoading` false and surfaces a toast + form — covered. A *non-terminal* hang (open socket, no bytes) never flips `isLoading` — uncovered **and** unhandled. Tests must not conflate the two; the `:121-129` existing test covers the former only.
- **Acknowledgment ≤2s is a synchronous-render property, not a timing property.** It is provable by "loader present on the render after `submit`", not by advancing fake timers to 2.1s. A timer-based "assert loader visible at 2.1s" test would assert a behavior the code doesn't promise (and would not catch a real regression).
- **Locale correctness bifurcates cleanly.** UI chrome → next-intl catalogs (deterministic, oracle = catalog). Generated content → LLM free text (eval-shaped, no static net). The same `locale` value threads both, but only the chrome side has a deterministic oracle.
- **The catalog-parity contract is the cheapest high-signal Risk #5 test** and is independent of any component render — a unit test loading both JSON files.

## Historical Context (from prior changes)

- `context/changes/locale-support/change.md:31-49` — S-03 closed administratively; locale delivered by S-01 (UI: next-intl cookie locale, `LocaleToggle`, pl/en catalogs) + S-02 (generation: route reads `getLocale()`, threads into prompt). **Accepted limitation:** no retranslation after a UI switch (no `locale` column) — out of Phase 3 scope.
- `context/changes/testing-generation-flow-integrity/research.md` — Phase 1; established the `useObject` two-channel error semantics (`onFinish.error` = schema failure; returned `error` state = transport failure) and the hermetic AI-stub helper reused here.
- `context/changes/testing-safety-access-control-contracts/research.md` — Phase 2; **precedent for deferring an eval-shaped face** (health-respect) as a documented residual risk while shipping the deterministic disclaimer-fallback test. Phase 3's locale-content deferral follows the same pattern.
- `context/foundation/test-plan.md:56-57,69-70` — Risk #4/#5 rows and Risk Response Guidance grounding this research.

## Related Research

- `context/changes/testing-generation-flow-integrity/research.md` — Risk #1 (generation-flow integrity), AI-stub seam origin
- `context/changes/testing-safety-access-control-contracts/research.md` — Risk #2/#3, eval-deferral precedent
- `context/foundation/lessons.md` — "Use getTranslations in server components" (relevant to any new i18n-rendering test setup)

## Open Questions

1. **Risk #4 hung-stream gap — pin-only vs flag-for-fix.** Decision taken: pin current behavior (test existing only), document residual risk. The plan should make explicit that the "surfaces an error, not infinite spinner" proof-of-protection is *intentionally not asserted* (would require client timeout/abort wiring — out of Lesson 2 scope). Worth a one-line note to a future bug-fix slice (Lesson 5).
2. **Risk #5 generated-content eval — deferred.** No deterministic oracle. If/when an eval harness is introduced (not in the §4 stack today), a PL/EN language-detection judge on the free-text fields would close this. Until then it is an unproven residual risk, like the Phase 2 health eval.
3. **Threading contract scope.** Should the plan keep a thin `buildPlanPrompt(pl) !== buildPlanPrompt(en)` threading assertion (replacing the current mirror at `build-prompt.test.ts:53-57`), or drop locale assertions from the prompt unit entirely and rely on the eval-deferral note? Either is defensible; the plan decides. If kept, it MUST be labeled as threading, not output proof.
