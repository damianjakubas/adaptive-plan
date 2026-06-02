# Plan Generation (S-02) Implementation Plan

## Overview

Deliver the product's north-star slice (US-01): a logged-in user fills a 12-field parameter form, an LLM generates a personalized training plan (routine, calorie target, progression, timeline) streamed back with visible progress, and the latest plan becomes the user's single active plan, persisted across sessions. This plan covers FR-003, FR-004, FR-005, FR-006.

## Current State Analysis

- **S-01 (auth) is done** and establishes the patterns this slice mirrors: server actions returning typed `{ ok, code }` results (`src/lib/auth/actions.ts`), shared Zod schemas with **i18n-key error messages** (`src/lib/validation/auth.ts`), shadcn `Form` + RHF + `zodResolver` (`src/components/auth/auth-card.tsx`), `getTranslations()` in server components / `useTranslations()` in client, deny-by-default route gating (`src/proxy.ts`, `PUBLIC_ROUTES = ["/", "/login"]` — new routes are auto-protected), and the Supabase `createClient()` server helper (`src/lib/supabase/server.ts`) for `getUser()`.
- **Most deps are already installed**: `ai@^6`, `@ai-sdk/react@^3`, `react-hook-form@^7.76`, `@hookform/resolvers@^5.4` (satisfies the research-required v5+), `zod@^4.4`, `next-intl@^4.13`, `@supabase/ssr`, `sonner`. shadcn present: button, input, form, label, tabs, sonner.
- **Net-new**: Drizzle (`drizzle-orm`, `postgres`, `drizzle-kit`) is **not installed** — no `db/`, schema, migrations, or config exist. The Gemini provider (`@ai-sdk/google`) is also net-new. These two are the only new dependencies.
- **Supabase is configured** (`supabase/config.toml`, Postgres 17) but has no application tables yet.
- **Design is explicit** across three approved screens: a **4-step wizard** form (`design/formularz_danych_profilowych` — "Krok 1 z 4", sliders for weight/height, sex toggle), a **full-screen abstract loader** during generation (`design/generowanie_planu_ai` — circular progress ring + rotating motivational quotes + status line), and a **structured plan view** (`design/wygenerowany_plan_treningowy` — goal chip, weekly-schedule day tabs, today's exercises with sets/reps, dietary-tips sidebar, weekly cardio ring).

### Key Discoveries:

- **AI SDK v6 streaming-object contract (verified via Context7):** route handler runs `streamText({ model, output: Output.object({ schema }), prompt, onFinish })` and returns `result.toTextStreamResponse()`; the client consumes it with `experimental_useObject` from `@ai-sdk/react`, which exposes `{ object, submit, isLoading, stop, error }` where `object` is a `DeepPartial` of the schema. The older `streamObject` call is **not** used.
- **Google provider (verified):** `import { google } from '@ai-sdk/google'`, `google('gemini-2.5-flash')`, env var `GOOGLE_GENERATIVE_AI_API_KEY` (free Google AI Studio tier). This **replaces** the AI-Gateway `'provider/model'` string the research assumed — see Open Risks.
- **Supabase + Drizzle pooler gotcha (research):** `postgres-js` with `prepare: false` is **mandatory** on the transaction pooler (port `6543`), or production hits "prepared statement already exists" 502s. `drizzle-kit` migrations need the **direct / session-pooler** connection, not `6543`.
- **RHF #13110 (research):** `form.reset()` after submit on Next 16 + Server Actions causes phantom validation errors. Sidestepped here because the success path navigates away and unmounts the form.
- **Lessons (`context/foundation/lessons.md`):** route gating is deny-by-default (new routes auto-protected — no `proxy.ts` change needed); server components must use `getTranslations()`, client components `useTranslations()`.

## Desired End State

A logged-in user visits `/plan/new`, completes the 4-step wizard, submits, sees the abstract generation loader within ~2s, and on completion lands on `/plan` showing their structured personalized plan with a visible health disclaimer. The plan is persisted as their single active plan (`is_active = true`, prior plans flipped to `false`) and survives logout/login. A second generation replaces the active plan. Verify by: completing the flow end-to-end, reloading `/plan` after re-login, generating again and confirming the view updates and exactly one active row exists per user.

## What We're NOT Doing

- **Locale of generated output (FR-008 / S-03)** — out of scope. The prompt builder will accept a `locale` argument and is structured to receive it, but selecting/applying locale to UI + output is the next slice. Generated output language for this slice follows the prompt's default.
- **Plan history / multiple saved plans** — deferred (PRD YAGNI). The `is_active` flag leaves a trivial future path, but no history UI.
- **Reusable user-profile table / form prefill from saved profile** — post-MVP. We persist a parameter *snapshot* on the plan row, not a separate editable profile.
- **Training session mode, meal planning, progress tracking, social** — explicit PRD non-goals.
- **RLS policies** — RLS stays off (documented); isolation is enforced server-side by scoping every query to the authenticated `user_id`.

## Implementation Approach

Build bottom-up so each phase is testable: persistence first (Drizzle + `plans` table), then the generation route (the contract both form and view depend on), then the form UI, then the read-only plan view, and finally the streaming flow that wires form → route → view. Persistence happens **server-side in the route's `onFinish`** so a client disconnect can't lose the plan. The plan output is a **fully-structured** shared Zod schema imported by both the route (`Output.object`) and the client (`useObject`), driving the rich design view. The generation UX uses the design's **abstract loader** (real streaming under the hood, partial object hidden until complete).

## Critical Implementation Details

- **Persisting the structured object in `onFinish`:** with `streamText` + `Output.object`, the `onFinish` callback receives `{ text, usage, … }` — **not** the parsed object. Get the structured object by awaiting the result's `output` promise (`const generated = await result.output;`, in a `try/catch`), then `outputSchema.safeParse(generated)` before writing. (Do **not** hand-parse `onFinish`'s finished text — that's the fragile path.) The DB write runs after `output` resolves, i.e. after the stream is consumed — Fluid Compute keeps the function alive for this; do **not** block `toTextStreamResponse()` on the write. If `output` rejects, `safeParse` fails, or the write throws, do not persist a partial plan — log and let the client surface a generation error (no active-plan mutation).
- **`prepare: false` + connection split:** the runtime DB client uses the pooler URL (`:6543`) with `prepare: false`; `drizzle.config.ts` uses the direct/session connection. Getting this wrong only fails in deployed/serverless conditions, not necessarily local dev.
- **`maxDuration`:** set `export const maxDuration` on the route handler high enough for a full structured plan on a free-tier model (free tiers can be slow); the 2s-acknowledgment NFR is met by the stream opening, not by completion.
- **DeepPartial guarding:** because `useObject`'s `object` is partial *during* streaming, any component reading it mid-stream must guard every field with `?.`. The abstract-loader UX keeps that partial off-screen during generation; on completion the view renders from the **complete** object (`onFinish`'s typed `object`), and the from-DB `/plan` page reads a complete row — so no on-screen surface ever touches a partial.
- **Display vs. persistence are decoupled (no read-after-write race):** the post-generation view is rendered from the client-held final object; the server-side `onFinish` DB write is the durable copy consumed only by the from-DB `/plan` page on cold loads / refresh / re-login. Never gate the just-generated view on a DB read of the row the same request is still writing.

---

## Phase 1: Persistence Foundation (Drizzle + plans table)

### Overview

Stand up Drizzle against the existing Supabase Postgres, define the `plans` table, and expose typed query helpers for reading and replacing the active plan.

### Changes Required:

#### 1. Install dependencies

**File**: `package.json`

**Intent**: Add the ORM and driver needed for persistence.

**Contract**: Add `drizzle-orm` and `postgres` (runtime deps) and `drizzle-kit` (dev dep) via npm. No other deps in this phase.

#### 2. Drizzle config

**File**: `drizzle.config.ts` (repo root)

**Intent**: Configure schema location, migrations output, and the migration connection.

**Contract**: Drizzle Kit config pointing `schema` at the schema file (Phase 1.3), `out` at a migrations dir (e.g. `src/db/migrations`), dialect `postgresql`, and `dbCredentials.url` set to the **direct/session** connection env var (not `:6543`).

#### 3. Runtime DB client

**File**: `src/db/index.ts`

**Intent**: A single shared Drizzle client for server-side queries, safe on the Supabase transaction pooler.

**Contract**: `postgres(connectionString, { prepare: false })` over the **pooler URL (`:6543`)** env var, wrapped with `drizzle(client, { schema })`. Export the `db` instance. `prepare: false` is mandatory.

#### 4. `plans` schema

**File**: `src/db/schema.ts`

**Intent**: One table modeling "one active plan per user, latest replaces previous" with the input snapshot for explainability.

**Contract**: `plans` table — `id` (uuid pk), `userId` (uuid, references the Supabase auth user id; indexed), `isActive` (boolean, default true), `plan` (jsonb — the generated structured plan), `parameters` (jsonb — snapshot of the 12 inputs), `model` (text — the model id used), `createdAt` (timestamptz default now). Add an index supporting `WHERE user_id AND is_active`. Export inferred select/insert types.

#### 5. Query helpers

**File**: `src/db/plans.ts`

**Intent**: Encapsulate the active-plan read and the transactional replace so callers never forget the user scope or the deactivate-then-insert ordering.

**Contract**:
- `getActivePlan(userId: string)` → the active plan row or `null`, filtered by `userId` AND `isActive`.
- `saveActivePlan(input)` → in a single transaction, set `isActive = false` for the user's existing active rows, then insert the new row with `isActive = true`; returns the new row. Input carries `userId`, `plan`, `parameters`, `model`.
- Both must scope by `userId` (server-side isolation — RLS is off).

#### 6. Environment variables + migration

**File**: `.env.local` (+ document in a sample if one exists)

**Intent**: Provide both connection strings and generate/apply the first migration.

**Contract**: Add the pooler URL var (`:6543`, used by `src/db/index.ts`) and the direct URL var (used by `drizzle.config.ts`). Add npm scripts for `drizzle-kit generate` and `drizzle-kit migrate`. Generate and apply the migration creating `plans`.

#### 7. Test infrastructure

**File**: `vitest.config.ts` (repo root), `src/tests/setup.ts`

**Intent**: Stand up the test runner once, here in the foundation phase, so every later phase's test bullet is runnable. The repo already has `vitest@^3` and a `test` script but no config and no DOM/testing-library deps.

**Contract**: Add `vitest.config.ts` with the `jsdom` environment (for the component tests in Phases 3–5), the `@/` path alias, and a `setup.ts` (imports `@testing-library/jest-dom`). Install dev deps `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Establish how DB-touching tests get a database — a dedicated test schema/DB via the direct connection, with each test wrapped in a transaction that rolls back (so `saveActivePlan` assertions don't pollute dev data). `npm run test` runs green on a trivial sanity test.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Migration generates without error: `npx drizzle-kit generate`
- Migration applies cleanly against the dev database: `npx drizzle-kit migrate`
- Tests pass: `npm run test` — `saveActivePlan` called twice for one user leaves exactly one `is_active = true` row, and `getActivePlan` returns it (rolled-back test DB).

#### Manual Verification:

- `plans` table exists in Supabase with the expected columns and index.
- A manual insert + `getActivePlan` round-trips end-to-end against the real dev database.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Shared Schemas + AI Generation Route

### Overview

Define the shared input + output Zod schemas, build the prompt, and implement the streaming generation route that authenticates, validates, generates on free Gemini, and persists the active plan server-side.

### Changes Required:

#### 1. Install the Gemini provider

**File**: `package.json`

**Intent**: Add the direct Google provider (replaces the Gateway path).

**Contract**: Add `@ai-sdk/google`. Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local`.

#### 2. Shared plan schemas

**File**: `src/lib/validation/plan-schema.ts`

**Intent**: One module, imported by both the route (`Output.object`) and the client (`useObject`), holding the form **input** schema and the generated-plan **output** schema. Single source of truth prevents drift.

**Contract**:
- **Input schema** — the 12 fields: `weight`, `height`, `age` (numbers, sensible min/max), `sex` (enum), `workMode` (enum: sedentary/active), `dailySteps` (number/bucket), `healthIssues` (string, free text, optional), `goal` (enum: weight-loss/muscle/strength/health-relief), `equipment` (enum or multi: none/home/gym), `frequency` (days/week number), `timePerSession` (minutes), `experience` (enum: beginner/intermediate/advanced). Error messages are **i18n keys** (mirror `auth.ts`, e.g. `"invalid_weight"`). Export `PlanInput` type.
- **Output schema** — fully structured: `goal` (label/chip), `summary` (AI recommendation text), `weeklySchedule` (array of `{ day, focus, isRest, exercises }` — **each non-rest day carries its own `exercises` array of `{ name, muscleGroup?, sets, reps, note? }`**; rest days have `isRest: true` and an empty/omitted `exercises`), `calorieTarget` (`{ kcal, note }`), `progression` (array of strings or `{ week, change }`), `timelineWeeks` (number) + `milestones` (array), `dietaryTips` (array of `{ title, body }`), `cardioGoal` (`{ targetMinutes, note }`), `disclaimer` (string). Export `GeneratedPlan` type. **This is the deepest the schema goes — per-day `exercises[]` nested in `weeklySchedule[]` is a deliberate richness/risk tradeoff (full interactive day tabs in Phase 4.2); it directly raises the free-model schema-adherence risk, so `safeParse` in `onFinish` (Phase 2.4) and the flatten fallback in Open Risks are load-bearing here, not optional.**

#### 3. Prompt builder

**File**: `src/lib/plan/build-prompt.ts`

**Intent**: Pure function turning validated inputs (+ a `locale` arg for S-03 readiness) into the generation prompt; kept out of the route per the helpers-in-separate-files rule.

**Contract**: `buildPlanPrompt(input: PlanInput, locale?: string): string` — a structured prompt that instructs the model to honor health constraints, equipment, frequency, and goal, and to reference the user's specific inputs (acceptance criterion). Includes the not-medical-advice framing so the model populates `disclaimer`.

#### 4. Generation route handler

**File**: `src/app/api/plan/generate/route.ts`

**Intent**: The streaming endpoint: authenticate, validate, generate structured output on Gemini, and persist the active plan server-side.

**Contract**: `POST` handler. `export const maxDuration` set generously. Flow: `getUser()` (401 if absent) → parse body, `inputSchema.safeParse` (400 with a localizable code on failure) → `streamText({ model: google('gemini-2.5-flash'), output: Output.object({ schema: outputSchema }), prompt: buildPlanPrompt(input) , onFinish })` → `return result.toTextStreamResponse()`. In `onFinish`: `const generated = await result.output` (in `try/catch`), `outputSchema.safeParse(generated)`, and on success call `saveActivePlan({ userId, plan, parameters: input, model })`; on `output` rejection / parse failure / DB failure, log and do not mutate the active plan. This is the only non-obvious ordering — see Critical Implementation Details.

#### 5. Error codes

**File**: `src/lib/plan/errors.ts`

**Intent**: Localizable plan-generation error codes, mirroring `src/lib/auth/errors.ts`.

**Contract**: Export a `PlanErrorCode` union (e.g. `"generation_failed"`, `"invalid_parameters"`, `"rate_limited"`, `"unauthenticated"`) consumed by the client to pick a toast message. Map provider/HTTP failures to these codes.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test` — input schema (valid passes; out-of-range/missing produce the expected i18n-key messages), output schema (representative object validates; malformed fails `safeParse`), `build-prompt` (includes goal/health/equipment + the disclaimer instruction).
- Integration tests pass: `npm run test` — `POST /api/plan/generate`: logged-out → 401; invalid body → 400 with code; valid → persists exactly one user-scoped active row; user A cannot read user B's active plan via `getActivePlan`.

#### Manual Verification:

- `curl -N` (or a REST client) POSTing valid params to `/api/plan/generate` while logged in streams a JSON object and, on completion, writes exactly one new active `plans` row scoped to the user.
- POSTing while logged out returns 401; posting invalid params returns a 400 with a localizable code.
- An intentionally interrupted request does not leave a partial/active plan written.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Parameter Form Wizard

### Overview

Build the 4-step wizard (12 validated fields) matching the design, plus its authenticated page and i18n copy. Submission wiring is deferred to Phase 5.

### Changes Required:

#### 1. shadcn components

**File**: `src/components/ui/*` (via shadcn CLI)

**Intent**: Add the inputs the wizard needs.

**Contract**: Add `select`, `slider`, `checkbox`, `textarea`, `card`, `progress`, `alert` (used by the Phase 4.3 disclaimer), and a toggle/radio primitive for the sex + binary toggles (e.g. `toggle-group` or `radio-group`) via the shadcn CLI (not npm). Use the shadcn MCP to resolve exact add commands.

#### 2. Wizard form component

**File**: `src/components/plan/parameter-form.tsx`

**Intent**: Client component owning one RHF form across 4 steps with per-step validation and a progress bar; presentational where possible (per smart/dumb split, the submit wiring is injected in Phase 5).

**Contract**: `"use client"`. `useForm({ resolver: zodResolver(inputSchema), defaultValues: <all 12 fields> })`. Steps: (1) basics — age, sex, weight slider, height slider; (2) lifestyle — workMode, dailySteps; (3) health — healthIssues textarea, goal; (4) preferences — equipment, frequency, timePerSession, experience. "Dalej" calls `form.trigger(<current step fields>)` and only advances on success; final step exposes submit. Progress bar reflects step N of 4. Inline field errors render via `tValidation(error.message)`. Accepts an `onGenerate(values)` callback prop (wired in Phase 5). `defaultValues` set for every field to avoid uncontrolled→controlled warnings.

Per the helpers rule, the step-field grouping (which fields validate per step) lives in a sibling file (e.g. `src/components/plan/wizard-steps.ts`), not inline business logic.

#### 3. Form page

**File**: `src/app/(app)/plan/new/page.tsx`

**Intent**: The authenticated entry point rendering the wizard.

**Contract**: Async server component. `getUser()` → redirect `/login` if absent (deny-by-default already covers it; explicit for clarity). `getTranslations("Plan")`. Renders `parameter-form` inside the design's centered card/heading layout.

#### 4. i18n copy

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Form labels, step titles, button copy, and validation messages in both locales.

**Contract**: Add a `Plan` namespace (titles, field labels, step names, buttons) and the new `Validation` keys referenced by the input schema. Keep `en` and `pl` in sync. Polish copy should match the design's wording where shown (e.g. "Stwórz swój profil treningowy", "Dalej", "Krok 1 z 4").

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Unit tests pass: `npm run test` — `wizard-steps` grouping: each step's field set matches the schema fields it validates (no field unassigned, none double-counted).

#### Manual Verification:

- `/plan/new` renders the 4-step wizard matching the design; unauthenticated access redirects to `/login`.
- Per-step validation blocks "Dalej" with localized inline errors; all 12 fields collect values; switching locale renders PL/EN copy.
- No uncontrolled→controlled React warnings in the console.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Active-Plan Display View

### Overview

Render the persisted active plan as the structured design view, with the mandatory health disclaimer and a nav entry. Read-only; reads the complete persisted row (no partials).

### Changes Required:

#### 1. Plan view page

**File**: `src/app/(app)/plan/page.tsx`

**Intent**: Authenticated page that loads and renders the user's active plan.

**Contract**: Async server component. `getUser()` → `getActivePlan(user.id)`. If no active plan, render an empty state linking to `/plan/new`. Otherwise pass the typed plan to the display components. `getTranslations("Plan")`.

#### 2. Plan display components

**File**: `src/components/plan/plan-view.tsx` (+ dumb sub-components in the same folder)

**Intent**: Presentational rendering of the structured plan matching the design.

**Contract**: Dumb components (props only, no fetching): goal chip, AI summary block, weekly-schedule day grid (`weeklySchedule`), **interactive day tabs — selecting a day renders that day's `weeklySchedule[i].exercises` list (name, sets/reps, note); the initially-selected day defaults to the first non-rest day (the design's "Trening na dziś")**, dietary-tips sidebar (`dietaryTips`), weekly cardio ring (`cardioGoal`), calorie target, progression, timeline. Rest days (`isRest`) render a regeneration state, not an exercise list. Each non-trivial sub-component lives in its own file per the helpers/dumb-component rules (e.g. `plan-view/cardio-ring.tsx`, `plan-view/weekly-schedule.tsx`, `plan-view/day-exercises.tsx`). Day selection is local UI state in the schedule component (`"use client"` pushed down to just that piece).

#### 3. Health disclaimer

**File**: `src/components/plan/plan-disclaimer.tsx`

**Intent**: Satisfy the PRD guardrail — health advice must carry a not-medical-advice disclaimer, visible on the results page.

**Contract**: A dumb component rendering the `disclaimer` field (with a localized fallback if the model omits it) prominently on `/plan`. Uses a shadcn `alert`/`card`.

#### 4. Navigation entry

**File**: `src/app/(app)/layout.tsx` (and/or header component)

**Intent**: Add the "Plan Treningowy" nav link from the design.

**Contract**: Add a link to `/plan` in the app shell header. Keep it minimal — the design's Dashboard/Plan/Postępy nav; only wire the routes that exist this slice.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Component tests pass: `npm run test` (RTL) — `plan-view` renders the weekly grid, per-day exercises on tab switch, dietary tips, cardio ring, calorie target, and the disclaimer from a fixture `GeneratedPlan`; the no-plan empty state renders its `/plan/new` link.

#### Manual Verification:

- With a seeded active plan, `/plan` renders the structured view (schedule, exercises, dietary tips, cardio ring, goal chip) matching the design and shows the disclaimer.
- With no plan, the empty state links to `/plan/new`.
- The plan persists across logout/login; another user's account shows no access to this plan.

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Streaming Generation Flow

### Overview

Wire the form to the generation route via `experimental_useObject`, show the abstract loader during streaming, navigate to `/plan` on success, and handle failures with a toast + preserved inputs. This ties Phases 2–4 into the end-to-end US-01 flow.

### Changes Required:

#### 1. Generation orchestrator (smart wrapper)

**File**: `src/components/plan/plan-generator.tsx`

**Intent**: Client smart component connecting the form, the streaming hook, the loader, and navigation.

**Contract**: `"use client"`. Uses `experimental_useObject({ api: "/api/plan/generate", schema: outputSchema, onFinish })` → `{ submit, isLoading, error, object }`. Renders `parameter-form` (passing `onGenerate={(values) => submit(values)}`); while `isLoading`, renders the abstract loader instead of the form. **On successful completion, render `plan-view` in place directly from the client-held final object** (the complete, schema-validated object surfaced by `useObject`'s `onFinish({ object })`) — **do not navigate to `/plan` and re-read the DB.** The server-side `onFinish` write (Phase 2.4) is the *durable* copy; it runs strictly after the stream is consumed (`await result.output`), so a `router.push("/plan")` here would read `getActivePlan` **before** the write commits and show the previous/empty plan (read-after-write race). Rendering from the object also means the post-generation view touches the *complete* object, not a `DeepPartial`. The `/plan` page (Phase 4.1) remains the from-DB entry point for cold loads, refresh, and re-login — where the write has long committed. The form unmounts on success (no `reset()`, sidesteps RHF #13110). On `error`, map to a `PlanErrorCode`, `toast.error(tPlanErrors(code))`, and fall back to the form with values intact.

#### 2. Abstract generation loader

**File**: `src/components/plan/generation-loader.tsx`

**Intent**: The design's full-screen generation screen.

**Contract**: Dumb component: centered card, circular progress ring (decorative/time-based animation — the free-tier stream gives no real %), rotating motivational quotes, and a status line. Driven purely by `isLoading`. Quote/status copy from i18n. The partial `object` is intentionally **not** rendered (abstract-loader UX decision).

#### 3. Use the orchestrator on the form page

**File**: `src/app/(app)/plan/new/page.tsx`

**Intent**: Swap the bare form for the orchestrator.

**Contract**: Render `plan-generator` (which internally renders the form) instead of `parameter-form` directly.

#### 4. Loader/error i18n copy

**File**: `src/i18n/messages/en.json`, `src/i18n/messages/pl.json`

**Intent**: Loader quotes/status + `PlanErrors` codes in both locales.

**Contract**: Add loader copy (status line, motivational quotes) and a `PlanErrors` namespace keyed by `PlanErrorCode`. Keep PL/EN in sync.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Component tests pass: `npm run test` (RTL, mocked `useObject`) — `plan-generator` shows the loader while `isLoading`, renders `plan-view` from the final `object` on finish (no navigation), and maps an `error` to a `PlanErrorCode` toast while preserving the form.

#### Manual Verification:

- Submitting the wizard shows the abstract loader within ~2s, then displays the structured plan rendered from the streamed result (no navigation/DB-read race) — generated plan references the user's stated goal, health issues, and equipment (acceptance criteria). Loading `/plan` directly (refresh / re-login) shows the same persisted plan.
- Generating again replaces the active plan (view updates; exactly one active row).
- A forced failure (e.g. invalid key / rate limit) shows a localized toast and returns to the form with inputs preserved; no partial plan persisted.
- Continuous progress is visible throughout generation (no blank/unresponsive state) — NFR.

**Implementation Note**: After automated verification passes, pause for final manual confirmation that the full US-01 flow works end-to-end.

---

## Testing Strategy

> Runner setup (vitest config + jsdom + `@testing-library/*`, plus the rolled-back test-DB strategy) is built in **Phase 1, step 7**. From there each phase's Automated Verification runs the tests below via `npm run test`, so the strategy is wired into the phases rather than aspirational.

### Unit Tests:

- Input schema: valid inputs pass; out-of-range/missing fields produce the expected i18n-key error messages.
- Output schema: a representative generated object validates; a malformed one fails `safeParse`.
- `build-prompt`: includes goal, health issues, and equipment from inputs; includes the disclaimer instruction.
- `wizard-steps` grouping: each step's field set matches the schema fields it validates.
- `saveActivePlan`: after two calls for the same user, exactly one `is_active = true` row (use a test/dev DB).

### Integration Tests:

- `POST /api/plan/generate`: unauthenticated → 401; invalid body → 400 with code; valid → streams and persists one active row scoped to the user.
- Isolation: user A cannot read user B's active plan via `getActivePlan`.

### Manual Testing Steps:

1. Log in, complete the 4-step wizard, submit; confirm loader within ~2s and navigation to `/plan`.
2. Confirm the plan references your goal/health/equipment and shows the disclaimer.
3. Log out and back in; confirm `/plan` still shows the plan.
4. Generate again; confirm the view updates and only one active plan exists.
5. Force a failure; confirm toast + preserved inputs + no partial persistence.
6. Toggle locale; confirm UI copy switches (generated-output locale is S-03).

## Performance Considerations

- Free-tier Gemini has RPM/RPD limits and can be slow; `maxDuration` must accommodate a full structured plan. The 2s-acknowledgment NFR is met by the stream opening, not completion.
- `prepare: false` on the pooler avoids prepared-statement errors but slightly reduces query plan caching — negligible at the stated small data volume / low QPS.
- The plan view reads a single row by `(user_id, is_active)` index — cheap.

## Migration Notes

- First-ever migration introduces `plans`; no existing data to migrate.
- Two connection strings required: pooler (`:6543`, runtime) and direct/session (migrations). Document both in env.

## References

- External research: `context/changes/plan-generation/research.md`
- PRD: `context/foundation/prd.md` (US-01, FR-003–006, guardrails, NFRs)
- Design: `context/foundation/design/{formularz_danych_profilowych,generowanie_planu_ai,wygenerowany_plan_treningowy}/`
- Patterns to mirror: `src/lib/auth/actions.ts`, `src/lib/validation/auth.ts`, `src/components/auth/auth-card.tsx`, `src/lib/supabase/server.ts`, `src/proxy.ts`
- Lessons: `context/foundation/lessons.md`
- AI SDK v6 object streaming (verified): https://ai-sdk.dev/docs/ai-sdk-ui/object-generation ; Google provider: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai

## Open Risks & Assumptions

- **Provider deviation from research:** research assumed the Vercel AI Gateway (`'provider/model'`, no provider package, prompt caching, failover). To stay free, this plan uses `@ai-sdk/google` directly on the free Google AI Studio tier. Consequences: lose Gateway failover/caching/observability; subject to free-tier rate limits; `GOOGLE_GENERATIVE_AI_API_KEY` instead of `AI_GATEWAY_API_KEY`. If quota becomes a problem, switching back to the Gateway (or OpenRouter) is a one-file model-string change in the route.
- **Free model + deep schema adherence:** the chosen schema nests per-day `exercises[]` inside `weeklySchedule[]` (full interactive day tabs), which is the deepest a smaller free model is asked to satisfy and the most likely violation point. Mitigations (load-bearing, not optional): `safeParse` in `onFinish` with a `generation_failed` path (never persist a partial); if violations recur, the first lever is **collapsing per-day exercises back to a single today's-exercises array + label-only `weeklySchedule`** (the shallower shape) before reaching for hybrid structured+prose — a localized change to the output schema + Phase 4.2 view.
- **Assumption:** the existing Supabase project exposes both a transaction-pooler (`:6543`) and a direct/session connection string; both must be added to env before Phase 1 migration.
- **RLS off:** isolation depends entirely on server-side `user_id` scoping. Acceptable per the chosen decision and documented; a future query that forgets the scope would be the failure mode to guard in review.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persistence Foundation

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — e966167
- [x] 1.2 Linting passes: `npm run lint` — e966167
- [x] 1.3 Migration generates without error: `npx drizzle-kit generate` — e966167
- [x] 1.4 Migration applies cleanly: `npx drizzle-kit migrate` — e966167
- [x] 1.5 Tests pass: `npm run test` — two `saveActivePlan` calls leave exactly one active row; `getActivePlan` returns it (rolled-back test DB) — e966167

#### Manual

- [x] 1.6 `plans` table exists with expected columns and index — e966167
- [x] 1.7 Insert + `getActivePlan` round-trips against the real dev database — e966167

### Phase 2: Shared Schemas + AI Generation Route

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Build succeeds: `npm run build`
- [x] 2.4 Unit tests pass: `npm run test` — input schema (i18n-key errors), output schema `safeParse`, `build-prompt` (goal/health/equipment + disclaimer instruction)
- [x] 2.5 Integration tests pass: `npm run test` — route 401 logged-out, 400 invalid (with code), valid → one user-scoped active row; A-can't-read-B isolation

#### Manual

- [x] 2.6 Valid POST to `/api/plan/generate` streams and persists one active row scoped to the user
- [x] 2.7 Logged-out → 401; invalid params → 400 with localizable code
- [x] 2.8 Interrupted request leaves no partial/active plan written

### Phase 3: Parameter Form Wizard

#### Automated

- [ ] 3.1 Type checking passes: `npx tsc --noEmit`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`
- [ ] 3.4 Unit tests pass: `npm run test` — `wizard-steps` grouping matches the schema fields each step validates

#### Manual

- [ ] 3.5 `/plan/new` renders the 4-step wizard matching design; unauth redirects to `/login`
- [ ] 3.6 Per-step validation blocks "Dalej" with localized errors; all 12 fields collect; PL/EN copy renders
- [ ] 3.7 No uncontrolled→controlled warnings

### Phase 4: Active-Plan Display View

#### Automated

- [ ] 4.1 Type checking passes: `npx tsc --noEmit`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Build succeeds: `npm run build`
- [ ] 4.4 Component tests pass: `npm run test` — `plan-view` renders weekly grid, per-day exercises on tab switch, dietary tips, cardio ring, calorie target, disclaimer from a fixture; no-plan empty state links to `/plan/new`

#### Manual

- [ ] 4.5 Seeded active plan renders the structured view matching design + disclaimer visible
- [ ] 4.6 No-plan empty state links to `/plan/new`
- [ ] 4.7 Plan persists across logout/login; no cross-account access

### Phase 5: Streaming Generation Flow

#### Automated

- [ ] 5.1 Type checking passes: `npx tsc --noEmit`
- [ ] 5.2 Linting passes: `npm run lint`
- [ ] 5.3 Build succeeds: `npm run build`
- [ ] 5.4 Component tests pass: `npm run test` — `plan-generator` shows loader while loading, renders `plan-view` from the final `object` on finish (no navigation), maps `error` → toast with form preserved

#### Manual

- [ ] 5.5 Submit → loader within ~2s → plan rendered from streamed result (no DB-read race); references goal/health/equipment; direct `/plan` load shows same persisted plan
- [ ] 5.6 Re-generating replaces the active plan (view updates; one active row)
- [ ] 5.7 Forced failure → localized toast + preserved inputs + no partial persisted
- [ ] 5.8 Continuous visible progress throughout generation (NFR)
