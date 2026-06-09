# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-08

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the ground
   truth.

**Governing principle for this rollout (Phase 2 interview Q4):** the
existing suite is LLM-generated and is treated as *untrusted input*, not as
protection. By file count the project is `meaningful` (10 test files across
`db/`, `components/`, `lib/`, `app/api/`), but the assertions may be
oracle-problem mirror tests — they can pass against current behaviour
including bugs. Every rollout phase therefore **audits the existing tests in
its area first**, re-derives the oracle from the PRD/contract, then
replaces or extends. Coverage that already "passes" does not count as
protection until its oracle is re-established.

Hot-spot scope used for likelihood weighting: `src/` (excluding
`node_modules`, build output, and test files).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|--------------------------|--------|------------|--------------------------------|
| 1 | LLM returns invalid/corrupted output (malformed or truncated JSON, schema-violating object, provider error/timeout mid-stream, empty output) and it breaks the core generation flow — a partial or garbage plan is persisted, or the user is left stuck | High | High | interview Q1 + Q3 (top fear and lowest-confidence area); PRD FR-004, FR-005; hot-spot dirs `src/lib/plan` (3 commits/30d), `src/app/(app)/plan` (3 commits/30d) |
| 2 | Generated plan silently violates the safety contract — it ignores a stated health issue, or the not-medical-advice disclaimer is missing from the results the user sees | High | Medium | PRD Success Criteria guardrails; PRD US-01 acceptance ("disclaimer visible on results page"); hot-spot dir `src/lib/plan` (3 commits/30d) |
| 3 | Cross-user data exposure — a user reads or writes another user's plan, body stats, or health issues (IDOR), or an unauthenticated request reaches a gated route | High | Medium | PRD NFR + guardrail ("must not leak between accounts"); `lessons.md` deny-by-default rule; abuse lens; hot-spot dirs `src/lib/auth` (3 commits/30d), `src/proxy.ts` (3 commits/30d) |
| 4 | Generation leaves the user with no visible progress — blank screen, no acknowledgment within 2s, or a dropped stream that spins forever instead of surfacing an error | Medium | Medium | PRD NFR (continuous visible progress within 2s); interview Q1 (stuck flow is a face of corrupted response); hot-spot dirs `src/components/plan/plan-view` (10 commits/30d), `src/components/plan` (10 commits/30d) |
| 5 | Generated plan output is not rendered in the user's selected locale (PL vs EN) | Medium | Medium | PRD FR-008 + NFR; roadmap S-03 (accepted limitation: no retranslation after switch); hot-spot dirs `src/lib/plan` (3 commits/30d), `src/i18n/messages` (8 commits/30d) |

**Impact × Likelihood rubric.** Both axes scored coarse High / Medium / Low.
Protect High × High first (Risk #1).

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | On each bad-output face (malformed/truncated JSON, schema violation, provider error, empty output) the flow persists **nothing**, surfaces a clean error, and never presents a half-plan as success | "validation failed → no persist" already passing means #1 is covered — the existing route test is LLM-generated and may assert the implementation, not the contract | Where output is validated, whether the save is atomic or a non-atomic sequence, what the client receives on each failure face | Hermetic (stub the AI client to force each failure) — a real provider cannot trigger these on demand | Mirror-implementation; happy-path-only; "stream returned 200 means success" |
| #2 | The disclaimer reaches the user's results regardless of LLM output (deterministic); the plan-content path respects stated health input | "the prompt contains the disclaimer instruction" ≠ "the disclaimer reaches the user" — asserting the prompt string is a mirror test | Whether the disclaimer is a static results component or LLM-emitted; the two faces — one deterministic-cheap, one needing an eval | Disclaimer: component/integration (deterministic). Health-respect: research decides (may need an eval) | Asserting prompt text instead of user-visible behaviour |
| #3 | A request for another user's plan id is **denied** (not merely that unauthenticated requests are denied); gated routes deny-by-default | "user-scoped write + a 401 test = safe" — write-scoping and login checks do NOT prove read-authorization (IDOR) | The read/fetch path for a plan — is it filtered by owner, or only by login? proxy deny-by-default behaviour | Integration (real DB / RLS) for ownership; route test for unauth | Testing only the happy owner; over-mocking the auth boundary |
| #4 | The user sees acknowledgment ≤2s and progress while streaming; a dead stream surfaces an error, not an infinite spinner | "a loading spinner exists" ≠ "the stuck/error state is handled" | The generator state machine — states for pending/streaming/error; how a dropped stream is detected | Component test of the generator states | Meaningless snapshot; happy-stream-only |
| #5 | The output rendered to the user is in the selected locale (PL vs EN), not merely that the prompt asked for it | "the prompt forces the language" is a mirror of build-prompt; it never checks the output | Whether locale correctness is assertable deterministically or needs an eval/heuristic; where UI strings vs generated content are localized | Research decides (likely a small eval or contract check); UI-string locale = component | Asserting the prompt instead of the output; mirror test |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|----------------|------------|--------|----------------|
| 1 | Generation-flow integrity | Audit and re-oracle the untrusted generation tests; prove every corrupted-output face fails safe | #1 | hermetic stub + unit | complete | context/changes/testing-generation-flow-integrity/ |
| 2 | Safety & access-control contracts | Prove the disclaimer reaches the user and another user's data is denied (IDOR + unauth) | #2, #3 | component + integration | complete | context/changes/testing-safety-access-control-contracts/ |
| 3 | UX resilience & locale | Prove stuck/error states are handled and output renders in the selected locale | #4, #5 | component + eval/contract | complete | context/changes/testing-ux-resilience-locale/ |

**Status vocabulary** (fixed — parser literals):

| Value | Meaning |
|-------|---------|
| `not started` | No change folder for this rollout phase yet. |
| `change opened` | `context/changes/<id>/` exists with `change.md`; research not done. |
| `researched` | `research.md` exists in the change folder. |
| `planned` | `plan.md` exists with a `## Progress` section. |
| `implementing` | Progress section has at least one `[x]` and at least one `[ ]`. |
| `complete` | Progress section is fully `[x]`. |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 3.2.4 | configured (`vitest.config.ts`); `npm test` |
| component (React) | @testing-library/react + jsdom | 16.3.2 / 27.0.1 | `src/tests/setup.ts` stubs ResizeObserver, auto-cleanup |
| DOM matchers | @testing-library/jest-dom | 6.9.1 | imported in setup |
| user interaction | @testing-library/user-event | 14.6.1 | for form/interaction tests |
| AI client stubbing | (in-repo, hermetic) | n/a | Vercel AI SDK (`ai`, `@ai-sdk/google`) — stub the model/client to force corrupted-output faces; see Phase 1 |
| integration DB | Postgres (Supabase) | postgres 3.4.9 / drizzle-orm 0.45.2 | real-DB path needed for IDOR/ownership (Risk #3); self-skip on missing `DATABASE_URL` (see §6.3) |
| e2e | none yet | — | not required by current risks; out of Lesson 2 scope |
| accessibility | none yet | — | not in current risk map |

**Stack grounding tools (current session):**
- Docs: Context7 — available; not queried during planning (no version-specific API question raised); checked: 2026-06-04
- Search: Exa.ai — available; not queried during planning; checked: 2026-06-04
- Runtime/browser: Playwright MCP — not available in current session; checked: 2026-06-04
- Provider/platform: Supabase / GitHub MCP — not available in current session (Vercel and shadcn MCPs present but not quality-gate relevant); checked: 2026-06-04

Use docs MCPs (Context7) for current Vercel AI SDK / Drizzle / next-intl
APIs when a phase needs version-specific test setup. Do not use MCP
docs/search to infer code failure anchors; those belong in per-phase
`/10x-research`.

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift (`npm run lint`, `npx tsc --noEmit`) |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions in the generation flow |
| integration (real DB) | local (ad hoc) | required after §3 Phase 2 | authorization / ownership regressions; run ad hoc — local Supabase is expensive |
| mutation testing (Stryker) | local (selective) | optional, after a risk phase | tests that execute code but assert nothing meaningful; narrow scope to the changed module; Phase 1 first run: `--mutate "src/lib/plan/errors.ts"` |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: `src/tests/<area>/` mirroring the path under test (e.g. `src/tests/lib/plan/`).
- **Naming**: `<module>.test.ts(x)`.
- **Reference test**: `src/tests/lib/plan/build-prompt.test.ts` — but re-check its oracle before copying (governing principle, §1).
- **Run locally**: `npm test`.

### 6.2 Testing the generation flow (hermetic AI stub)

The shared stub helper lives at `src/tests/helpers/ai-stub.ts`. It exports two
controller factory functions — one for the server seam (`streamText`) and one
for the client seam (`experimental_useObject`) — plus canonical fixtures.

**Critical constraint — `vi.mock` hoisting.** `vi.mock` factories are hoisted
above module imports by Vitest; they cannot close over ordinary module-scope
variables. Every consuming test must therefore instantiate the controller inside
`vi.hoisted(...)` and pass it into the factory. The helper centralises the
*shape and behaviour*; the test owns the hoisted instance.

**Server seam (`streamText`):**

```typescript
import type { StreamTextController } from "@/tests/helpers/ai-stub";
import { validPlan } from "@/tests/helpers/ai-stub";

// Step 1 — hoist the controller (MUST be hoisted, not module-scope)
const ctrl = vi.hoisted((): StreamTextController => ({
  capturedOnError: null,
  capturedOnFinish: null,
  outputPromise: Promise.resolve(validPlan),
  streamText: vi.fn(),
}));

// Step 2 — wire the mock using the factory
vi.mock("ai", async () => {
  const { createStreamTextMock } = await import("@/tests/helpers/ai-stub");
  return createStreamTextMock(ctrl);
});

// Step 3 — in tests, mutate ctrl before POST and drive onFinish explicitly
it("does not persist when output is empty", async () => {
  ctrl.outputPromise = Promise.resolve({});
  await POST(request);
  await ctrl.capturedOnFinish?.();   // drive the post-stream callback
  expect(saveActivePlan).not.toHaveBeenCalled();
});
```

`ctrl.capturedOnError` captures the `onError` handler — call it to simulate a
mid-stream transport error. `ctrl.capturedOnFinish` captures the `onFinish`
callback — call it after `POST(...)` to exercise the validate→persist gate.

**Client seam (`experimental_useObject`):**

```typescript
import type { UseObjectController } from "@/tests/helpers/ai-stub";

const useObjectCtrl = vi.hoisted((): UseObjectController => ({
  capturedOnFinish: undefined,
  error: undefined,
  isLoading: false,
  object: undefined,
  submit: vi.fn(),
}));

vi.mock("@ai-sdk/react", async () => {
  const { createUseObjectMock } = await import("@/tests/helpers/ai-stub");
  return createUseObjectMock(useObjectCtrl);
});

// Drive finish with no valid object (schema-validation failure face):
act(() => {
  useObjectCtrl.capturedOnFinish?.({
    error: new Error("Output validation failed"),
    object: undefined,
  });
});
```

**`useObject` two-channel error semantics (resolved in Phase 1):**
- `onFinish({ object: undefined, error })` — fires when the *assembled* object
  fails schema validation. `object` is `undefined`; `error` is set.
- The hook's returned `error` *state* — fires only on transport / fetch failure.
Listening to one channel only silently drops the other face. Assert both.

**Key exports:** `validPlan` (canonical valid `GeneratedPlan`), `schemaViolatingPlan`
(missing required fields), `StreamTextController`, `UseObjectController`.

**Reference implementations:** `src/tests/app/api/plan/generate/route.test.ts`
(server seam full example), `src/tests/components/plan/plan-generator.test.tsx`
(client seam full example).

### 6.3 Testing access control / ownership

Two patterns cover Risk #3: a real-DB integration test for ownership isolation and a hermetic test for the proxy deny-by-default gate.

#### Real-DB ownership (integration)

Run only when `DATABASE_URL` points at a reachable Postgres (Supabase pooler). The suite self-skips in CI via `describe.skipIf(!hasDb)`.

**Bootstrap** — load env before the skip decision:

```typescript
import { loadEnv } from "vite";
Object.assign(process.env, loadEnv("development", process.cwd(), ""));
const hasDb = Boolean(process.env.DATABASE_URL);
```

`vite`'s `loadEnv` (not `@next/env`) is used here because Vitest sets `NODE_ENV=test`, which causes `@next/env` to skip `.env.local` / `.env.development.local`.

**Harness — throwaway IDs + scoped cleanup:**

```typescript
describe.skipIf(!hasDb)("active-plan helpers", () => {
  const userId = crypto.randomUUID();

  afterEach(async () => {
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(plans).where(eq(plans.userId, userId));
  });

  it("isolates users both directions when both have active plans", async () => {
    const { getActivePlan, saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const otherUserId = crypto.randomUUID();

    try {
      await saveActivePlan({ /* ... */ userId });
      await saveActivePlan({ /* ... */ userId: otherUserId });

      const mine = await getActivePlan(userId);
      const theirs = await getActivePlan(otherUserId);

      expect(mine?.userId).toBe(userId);
      expect(theirs?.userId).toBe(otherUserId);
    } finally {
      await db.delete(plans).where(eq(plans.userId, otherUserId));
      // userId rows cleaned by afterEach
    }
  });
});
```

The **both-directions** assertion is the ownership mutation-killer: it pins the
`eq(plans.userId, ...)` filter against the `orderBy desc / limit 1` ordering so
a dropped filter is caught even when the querying user also has an active row.
Extra users are created inside individual tests and cleaned in `finally`; the
primary `userId` is cleaned by `afterEach`.

**Run:** `DATABASE_URL=<pooler-url> npm test src/tests/db/plans.test.ts` — or
just `npm test` (self-skips without a DB).

**Reference:** `src/tests/db/plans.test.ts`.

#### Proxy deny-by-default (hermetic)

Control auth state by mocking the `updateSession` seam from
`@/lib/supabase/middleware` — no DB, no network.

**Seam mock:**

```typescript
const updateSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

import { proxy } from "@/proxy";

function makeSession(user: { id: string } | null, cookies: [string, string][] = []) {
  const response = NextResponse.next();
  cookies.forEach(([name, value]) => response.cookies.set(name, value));
  return { response, user };
}
```

**Key contracts to assert:**
- `null` user + gated page → 307, `Location` ends `/login`
- `null` user + `/api/*` → 401, body `{ code: "unauthenticated" }`
- `null` user + **unlisted** route → 307 → `/login` (deny-by-default regression guard)
- `null` user + public routes (`/`, `/login`) → 200, no redirect
- authed user + `/login` → 307 → `/plan`
- `Set-Cookie` headers from `updateSession` are preserved on redirect and 401 responses

The **unlisted-route** assertion (a route absent from `PUBLIC_ROUTES`) is the
regression guard against reverting to a protected-prefix allowlist (see
`lessons.md` deny-by-default rule).

**Reference:** `src/tests/proxy.test.ts`.

### 6.4 Testing the generator UI states (component)

- **Seam**: the `UseObjectController` from `src/tests/helpers/ai-stub.ts` (see
  §6.2). Set `isLoading`, `error`, and `object` on the controller *before*
  `render`; drive `capturedOnFinish` inside `act(...)` to simulate stream
  completion.
- **State contract oracle**: after any terminal event (`onFinish` or `error`)
  the component must show exactly one of: (a) a rendered plan, (b) a toast +
  form (retry path), or (c) a loader — never a spinner without a terminal path
  out. This "no spinner-forever" invariant is the key assertion.
- **Covered (Phase 1)**: `isLoading=true` → loader shown; `onFinish` with valid
  object → plan rendered; transport `error` state → toast + form; `onFinish`
  with `object: undefined` (schema-validation face) → toast + form. See
  `src/tests/components/plan/plan-generator.test.tsx`.
- **Phase 3 — hung-stream pin (gap caveat)**: The `isLoading=true` / no
  `onFinish` / no `error` face (stream open but delivering no bytes and never
  closing) is **pinned as a documented gap**, not a recovery path. The test
  asserts the *current* behavior: loader present, no toast, form absent. This
  is intentional — `experimental_useObject` has no client-side timeout or
  `AbortController`; the stream never reaches the `close()` callback that would
  flip `isLoading` false. See §6.6 Phase 3 residual risks and the hung-stream
  follow-up in `context/foundation/github-issues.md` (#13).

### 6.5 Asserting locale-correct output

Three deterministic patterns cover the assertable faces of Risk #5; generated-content
language remains eval-deferred (see §6.6 Phase 3).

**1. Catalog deep-parity (unit test)**
- Oracle: the *opposite* catalog is the expected shape — never a hard-coded key list.
- Assert: key sets equal both directions (no key in one and not the other); leaf
  `typeof` matches; `Array.isArray` matches; array lengths match.
- Explicitly covers the consumed arrays `Plan.loaderStatuses` (length 6) and
  `Plan.loaderQuotes` (length 5) which `generation-loader.tsx` reads via `t.raw(...)`.
- Reference: `src/tests/i18n/catalog-parity.test.ts`.

**2. UI-string locale render (component test)**
- Oracle: the `Plan.viewTitle` value from the active locale's catalog (static chrome,
  not generated content).
- Pattern: render `<PlanView>` inside `<NextIntlClientProvider locale="pl" messages={plMessages}>`,
  assert `screen.getByText(plMessages.Plan.viewTitle)`; repeat for EN. Add
  `expect(plMessages.Plan.viewTitle).not.toBe(enMessages.Plan.viewTitle)` to guard
  against catalogs collapsing to one string.
- Reference: `src/tests/components/plan/plan-view.test.tsx`.

**3. LocaleToggle cookie / guard / aria-pressed (component test)**
- Mocks: `next-intl` `useLocale`; `next/navigation` `useRouter`; spy on `setLocaleCookie`
  from `@/i18n/config`. `startTransition` runs synchronously in tests.
- Three assertions: (a) inactive-locale click → `setLocaleCookie("<other>")` called +
  `router.refresh()` called; (b) active-locale click → no-op (guard at `:16`); (c)
  active button has `aria-pressed="true"`, other `"false"`.
- Reference: `src/tests/components/locale-toggle.test.tsx`.

**Prompt-level locale assertions prove threading only.**
`buildPlanPrompt(input,"pl") !== buildPlanPrompt(input,"en")` confirms the locale
argument changes the prompt; it does **not** prove the LLM obeyed the instruction.
Rendered-output language (whether `summary`, `disclaimer`, tips, etc. actually come
back in the selected language) is eval-shaped and has no deterministic oracle —
deferred as a residual risk (§6.6 Phase 3).

### 6.6 Per-rollout-phase notes

**Phase 1 — Generation-flow integrity (`testing-generation-flow-integrity`, 2026-06-08):**
- `useObject` exposes *two* error channels that must both be handled: `onFinish.error`
  fires on Zod schema-validation failure (the assembled object didn't match); the hook's
  returned `error` state fires only on transport failure. Listening to only one silently
  drops the other face — this was the root of the silent-fallback bug fixed in Phase 4.
- The route was swallowing both `streamText.onError` and the `onFinish` catch silently.
  Introducing `logGenerationError` as a dedicated, spy-able seam proved observability
  without coupling tests to print format or requiring a real logger.
- Stryker on `errors.ts` killed all meaningful mutants; a `statusCode: 500` assertion was
  added after the first run surfaced one survivor (the else-branch for non-429 codes).

**Phase 2 — Safety & access-control contracts (`testing-safety-access-control-contracts`, 2026-06-08):**
- **Disclaimer fallback** (`src/tests/components/plan/plan-disclaimer.test.tsx`): the
  load-bearing safety net is `plan-disclaimer.tsx:14` — the static i18n fallback when the
  LLM omits or empties the disclaimer field. The existing `plan-view` test covered only the
  happy path; the new test covers `undefined`, `""`, and `"   "` via `it.each`, plus the
  always-static title. Oracle: i18n message value from the `next-intl` provider — never the
  prompt string (anti-pattern per §2 Risk #2).
- **Proxy deny-by-default** (`src/tests/proxy.test.ts`): `src/proxy.ts` had zero tests.
  The hermetic suite mocks `updateSession` from `@/lib/supabase/middleware` (the auth seam),
  drives every gating branch, and includes the **unlisted-route assertion** — a route absent
  from `PUBLIC_ROUTES` is denied — which guards against regressing to a protected-prefix
  list (see `lessons.md`). `Set-Cookie` preservation is also asserted; an addendum added
  `status: 200` assertions to pass-through tests and a new authed pass-through branch
  (`/plan` for an authenticated user).
- **Ownership hardening** (`src/tests/db/plans.test.ts`): the both-users-active test was
  added so a dropped `eq(plans.userId, …)` is caught even when the querying user also has
  an active row (the prior test seeded only the other user, masking that gap).
- **Residual risk — health eval deferred:** Risk #2 has two faces. The deterministic face
  (prompt carries the health input + honor instruction) is covered by
  `src/tests/lib/plan/build-prompt.test.ts`. The behavioural face ("the generated plan
  actually respects the stated health issues") has no deterministic oracle and requires an
  LLM-judge eval. This was intentionally deferred out of Phase 2 scope and remains an
  unproven residual risk. Do **not** treat Risk #2 as fully closed after Phase 2.

**Phase 3 — UX resilience & locale (`testing-ux-resilience-locale`, 2026-06-09):**

Five tests shipped across two risks:
- `src/tests/components/plan/plan-generator.test.tsx` — hung-stream pin (Risk #4)
- `src/tests/i18n/catalog-parity.test.ts` — catalog pl/en deep parity (Risk #5)
- `src/tests/components/plan/plan-view.test.tsx` — UI-string locale render, PL + EN (Risk #5)
- `src/tests/components/locale-toggle.test.tsx` — cookie write, no-op guard, `aria-pressed` (Risk #5)
- `src/tests/lib/plan/build-prompt.test.ts` — locale threading assertion, mirror replaced (Risk #5)

Residual risks — do **not** treat Risk #4 or Risk #5 as fully closed after Phase 3:

1. **Risk #4 hung-stream is an unhandled gap (pinned, not fixed).** A 200-OK stream
   that opens then delivers no bytes and never closes leaves `isLoading` stuck `true`
   forever. `experimental_useObject` flips `isLoading` false only in `close()` or
   `catch()`; a hung-but-open stream reaches neither. The client has no timeout or
   `AbortController`. The Phase 3 test pins this current (gap) behavior; it does NOT
   prove a recovery path. Fixing this requires client-side timeout/abort wiring — a
   future bug-fix slice (Lesson 5). See `context/foundation/github-issues.md` #13 for
   the follow-up stub.

2. **Risk #5 generated-content language is eval-deferred.** Whether the LLM's
   free-text fields (`summary`, `disclaimer`, notes, tips, etc.) actually come back
   in the selected language is LLM-judge / language-detection territory and has no
   deterministic oracle. The prompt-level threading assertion (`pl ≠ en`) does NOT
   prove the model obeyed the instruction.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **shadcn/ui primitives (`src/components/ui`)** — vendored; the registry is the test. Note: this is the #1 churn directory (15 commits/30d) but churn there is copy/config noise, not hand-authored logic. Re-evaluate only if a primitive is forked and given custom logic. (Source: Phase 2 interview Q5.)
- **The existing LLM-generated suite is not trusted as protection** — it is audited and re-oracled per phase, not deleted wholesale and not relied upon as-is. (Source: Phase 2 interview Q4.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-08
- Stack versions last verified: 2026-06-04
- AI-native tool references last verified: 2026-06-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
