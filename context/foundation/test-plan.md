# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-04

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
| 1 | Generation-flow integrity | Audit and re-oracle the untrusted generation tests; prove every corrupted-output face fails safe | #1 | hermetic stub + unit | change opened | context/changes/testing-generation-flow-integrity/ |
| 2 | Safety & access-control contracts | Prove the disclaimer reaches the user and another user's data is denied (IDOR + unauth) | #2, #3 | component + integration | not started | — |
| 3 | UX resilience & locale | Prove stuck/error states are handled and output renders in the selected locale | #4, #5 | component + eval/contract | not started | — |

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
| integration DB | Postgres (Supabase) | postgres 3.4.9 / drizzle-orm 0.45.2 | real-DB path needed for IDOR/ownership (Risk #3); setup TBD — see §3 Phase 2 |
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
| mutation testing (Stryker) | local (selective) | optional, after a risk phase | tests that execute code but assert nothing meaningful; narrow scope to the changed module |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: `src/tests/<area>/` mirroring the path under test (e.g. `src/tests/lib/plan/`).
- **Naming**: `<module>.test.ts(x)`.
- **Reference test**: `src/tests/lib/plan/build-prompt.test.ts` — but re-check its oracle before copying (governing principle, §1).
- **Run locally**: `npm test`.

### 6.2 Testing the generation flow (hermetic AI stub)

- TBD — see §3 Phase 1. Will document how to stub the Vercel AI SDK client to force each corrupted-output face (malformed/truncated JSON, schema violation, provider error, empty output) and assert fail-safe behaviour.

### 6.3 Testing access control / ownership (integration)

- TBD — see §3 Phase 2. Will document the real-DB setup and the IDOR/ownership assertion pattern.

### 6.4 Testing the generator UI states (component)

- TBD — see §3 Phase 3. Will document asserting pending/streaming/error states and the dropped-stream path.

### 6.5 Asserting locale-correct output

- TBD — see §3 Phase 3. Will document whether output-locale is checked deterministically or via an eval.

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, the implementing skill appends a 2–3
line note here capturing anything surprising the phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **shadcn/ui primitives (`src/components/ui`)** — vendored; the registry is the test. Note: this is the #1 churn directory (15 commits/30d) but churn there is copy/config noise, not hand-authored logic. Re-evaluate only if a primitive is forked and given custom logic. (Source: Phase 2 interview Q5.)
- **The existing LLM-generated suite is not trusted as protection** — it is audited and re-oracled per phase, not deleted wholesale and not relied upon as-is. (Source: Phase 2 interview Q4.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-04
- Stack versions last verified: 2026-06-04
- AI-native tool references last verified: 2026-06-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
