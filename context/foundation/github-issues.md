---
project: AdaptivePlan
source: context/foundation/roadmap.md
created: 2026-05-28
repo: damianjakubas/adaptive-plan
---

# GitHub Issues

## Labels

| Label      | Color     | Description              |
| ---------- | --------- | ------------------------ |
| `slice`    | `#1D76DB` | Vertical roadmap slice   |
| `ready`    | `#0E8A16` | Ready for implementation |
| `proposed` | `#FBCA04` | Proposed, not yet ready  |
| `test`     | `#5319E7` | Test rollout phase / QA  |

## Issues

### #3 — [S-01] Auth flow: registration, login, logout

- **URL:** https://github.com/damianjakubas/adaptive-plan/issues/3
- **Labels:** `slice`, `ready`
- **PRD refs:** FR-001, FR-002, FR-007
- **Prerequisites:** None
- **Linear mirror:** ADA-5

### #4 — [S-02] Plan generation: form, AI, display, persistence

- **URL:** https://github.com/damianjakubas/adaptive-plan/issues/4
- **Labels:** `slice`, `ready`
- **Status:** Closed (delivered)
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** Depends on #3
- **Linear mirror:** ADA-6

### #5 — [S-03] Locale support: PL/EN for UI and generation

- **URL:** https://github.com/damianjakubas/adaptive-plan/issues/5
- **Labels:** `slice`, `proposed`
- **Status:** Closed (delivered via S-01 + S-02; no dedicated implementation)
- **PRD refs:** FR-008
- **Prerequisites:** Depends on #4
- **Linear mirror:** ADA-7

## Test Rollout (context/foundation/test-plan.md §3)

### #9 — [T-01] Generation-flow integrity: corrupted-output tests (Risk #1)

- **URL:** https://github.com/damianjakubas/adaptive-plan/issues/9
- **Labels:** `test`, `ready`, `bug`
- **PRD refs:** FR-004, FR-005, FR-006 (Risk #1)
- **Prerequisites:** Builds on #4 (plan-generation, delivered)
- **Plan:** context/changes/testing-generation-flow-integrity/
- **Linear mirror:** ADA-8

## Dependency Chain

```
#3 (auth-flow) → #4 (plan-generation) → #5 (locale-support)
                      └─ #9 (T-01 generation-flow integrity tests)
```
