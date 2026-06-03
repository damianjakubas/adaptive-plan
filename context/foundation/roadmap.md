---
project: "AdaptivePlan"
version: 1
status: draft
created: 2026-05-28
updated: 2026-06-03
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: AdaptivePlan

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

No affordable tool generates truly personalized training plans that account for individual body parameters, health constraints, and real-world lifestyle. Existing fitness apps use rigid templates that ignore health problems and don't consider work mode, daily activity level, or equipment access. AdaptivePlan addresses this by treating health issues as first-class inputs and incorporating full lifestyle context (work mode, daily steps, equipment access) into AI-generated training plans.

## North star

**S-02: User submits parameters and receives a personalized training plan** — the single capability that proves the product idea works. It maps directly to the primary Success Criterion and the only user story (US-01). Everything else (auth, locale) exists to support this flow.

> "North star" in this roadmap means: the smallest end-to-end slice whose successful
> delivery would prove the product's core idea — placed as early as its prerequisites
> allow because nothing else matters if this doesn't work.

## At a glance

| ID   | Change ID       | Outcome (user can …)                                                                     | Prerequisites | PRD refs                              | Status   |
| ---- | --------------- | ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------- | -------- |
| S-01 | auth-flow       | register, log in, and log out                                                            | —             | FR-001, FR-002, FR-007                | ready    |
| S-02 | plan-generation | fill in a parameter form and receive a personalized training plan with streaming display  | S-01          | US-01, FR-003, FR-004, FR-005, FR-006 | done     |
| S-03 | locale-support  | switch language (PL/EN); UI and generated plan render in selected locale                 | S-02          | FR-008                                | proposed |

## Baseline

What's already in place in the codebase as of 2026-05-28 (auto-researched + user-confirmed).

- **Frontend:** partial — Next.js 16 + React 19 + Tailwind CSS 4 scaffold in place; no custom components or pages beyond placeholder (`src/app/page.tsx`)
- **Backend / API:** absent — no API routes, server actions, or middleware
- **Data:** partial — Supabase configured (`supabase/config.toml`, PostgreSQL v17); no ORM, migrations, or schema
- **Auth:** absent — no auth packages, middleware, or login/register pages
- **Deploy / infra:** partial — `.vercel/` linked to Vercel project; no `vercel.json`, CI/CD, or container config
- **Observability:** absent — no logging, error tracking, or metrics

## Foundations

No foundations required. All technical scaffolding is introduced progressively inside the first vertical slice that needs it: Supabase in S-01, Drizzle and Vercel AI SDK in S-02. The project is small enough and the dependency chain linear enough that cross-cutting enablers would add ceremony without unlocking parallelism.

## Slices

### S-01: Auth flow

- **Outcome:** user can register with email and password, log in, and log out
- **Change ID:** auth-flow
- **PRD refs:** FR-001, FR-002, FR-007
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Supabase Auth is a managed service so integration risk is low; main cost is middleware configuration and login/register page UI within the after-hours time constraint
- **Status:** ready

### S-02: Plan generation

- **Outcome:** user can fill in a parameter form (body stats, lifestyle, health issues, goals, preferences) and receive a personalized training plan with training routine, calorie recommendation, progression, and timeline — displayed with streaming progress; latest plan automatically becomes the active plan
- **Change ID:** plan-generation
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** S-01 (user must be authenticated; plan persistence requires user identity)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** AI prompt quality determines plan quality; streaming UX requires Vercel AI SDK + client-side state coordination; the 12-field form needs validation (Zod + RHF). Sequenced after auth because the PRD gates generation behind login and persistence requires user identity.
- **Status:** done

### S-03: Locale support

- **Outcome:** user can select a locale (Polish or English) from the navbar; both the UI and the generated training plan render in the selected language
- **Change ID:** locale-support
- **PRD refs:** FR-008
- **Prerequisites:** S-02 (locale must be passed to both the UI layer and the generation prompt; both must exist before locale can modify them)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which i18n approach for Next.js App Router — URL-based routing (`/pl/...`, `/en/...`) vs client-side locale state? — Owner: user. Block: no.
- **Risk:** i18n in Next.js App Router requires choosing a routing strategy; the change touches all existing UI pages plus the generation prompt template. Sequenced last because it's a cross-cutting modification easier to apply once pages and generation pipeline exist.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID       | Suggested issue title                           | Ready for `/10x-plan` | Notes                     |
| ---------- | --------------- | ----------------------------------------------- | --------------------- | ------------------------- |
| S-01       | auth-flow       | Auth flow: registration, login, logout          | yes                   | Run `/10x-plan auth-flow` |
| S-02       | plan-generation | Plan generation: form, AI, display, persistence | yes                   | S-01 done; run `/10x-plan plan-generation` |
| S-03       | locale-support  | Locale support: PL/EN for UI and generation     | no                    | Requires S-02             |

## Open Roadmap Questions

No blocking open questions. The PRD's Open Questions section is empty ("No blocking open questions were identified during shaping"), and the framing interview did not surface cross-cutting unknowns.

Design decision recorded during roadmap generation: **AI model generates training plans directly from user parameters without a pre-built exercise database.** Rationale: building and tagging an exercise database exceeds the 3-week time budget; LLMs have sufficient exercise knowledge; a reference database can be added post-MVP for validation or session mode. Prompt-level constraints replace a structured database lookup.

## Parked

- **Training session mode** — Why parked: PRD §Non-Goals; MVP generates plans only.
- **Diet or meal planning** — Why parked: PRD §Non-Goals; calorie target is shown but no meal plans, recipes, or food tracking.
- **Progress tracking over time** — Why parked: PRD §Non-Goals; no logging, no before/after comparisons, no graphs.
- **Social features** — Why parked: PRD §Non-Goals; no sharing, community, or trainer-client relationships.
- **Plan history** — Why parked: PRD §FR-006 resolution; one active plan per user; history deferred to post-MVP (YAGNI).
- **Pre-built exercise database** — Why parked: design decision during roadmap generation; LLM generates directly from parameters; database deferred to post-MVP for validation or session mode support.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)
