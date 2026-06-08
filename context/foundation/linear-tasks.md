---
project: AdaptivePlan
source: context/foundation/roadmap.md
created: 2026-05-28
workspace: adaptive-plan
team: Adaptive-plan
---

# Linear Tasks

## Labels

| Label     | Color     | Description                      |
| --------- | --------- | -------------------------------- |
| `Slice`   | `#1D76DB` | Vertical roadmap slice           |
| `Feature` | `#BB87FC` | New feature or request (default) |
| `Bug`     | `#EB5757` | Bug fix                          |
| `Test`    | `#5319E7` | Test rollout phase / QA          |

## Issues

### ADA-5 — [S-01] Auth flow: registration, login, logout

- **URL:** https://linear.app/adaptive-plan/issue/ADA-5/s-01-auth-flow-registration-login-logout
- **Status:** Todo
- **Priority:** High
- **Labels:** Slice, Feature
- **PRD refs:** FR-001, FR-002, FR-007
- **Blocked by:** —
- **GitHub mirror:** #3

### ADA-6 — [S-02] Plan generation: form, AI, display, persistence

- **URL:** https://linear.app/adaptive-plan/issue/ADA-6/s-02-plan-generation-form-ai-display-persistence
- **Status:** Done (delivered; GitHub #4 closed)
- **Priority:** Urgent
- **Labels:** Slice, Feature
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006
- **Blocked by:** ADA-5
- **GitHub mirror:** #4

### ADA-7 — [S-03] Locale support: PL/EN for UI and generation

- **URL:** https://linear.app/adaptive-plan/issue/ADA-7/s-03-locale-support-plen-for-ui-and-generation
- **Status:** Done (delivered via S-01 + S-02; no dedicated implementation)
- **Priority:** Medium
- **Labels:** Slice, Feature
- **PRD refs:** FR-008
- **Blocked by:** ADA-6
- **GitHub mirror:** #5

## Test Rollout (context/foundation/test-plan.md §3)

### ADA-8 — [T-01] Generation-flow integrity: corrupted-output tests (Risk #1)

- **URL:** https://linear.app/adaptive-plan/issue/ADA-8/t-01-generation-flow-integrity-corrupted-output-tests-risk-1
- **Status:** Backlog
- **Priority:** High
- **Labels:** Test, Bug, Feature
- **PRD refs:** FR-004, FR-005, FR-006 (Risk #1)
- **Blocked by:** — (builds on ADA-6, delivered)
- **Plan:** context/changes/testing-generation-flow-integrity/
- **GitHub mirror:** #9

## Dependency Chain

```
ADA-5 (auth-flow) → ADA-6 (plan-generation) → ADA-7 (locale-support)
                        └─ ADA-8 (T-01 generation-flow integrity tests)
```
