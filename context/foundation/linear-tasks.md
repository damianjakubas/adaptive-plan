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
- **Status:** Done (delivered; GitHub #9 closed)
- **Priority:** High
- **Labels:** Test, Bug, Feature
- **PRD refs:** FR-004, FR-005, FR-006 (Risk #1)
- **Blocked by:** — (builds on ADA-6, delivered)
- **Plan:** context/changes/testing-generation-flow-integrity/
- **GitHub mirror:** #9

### ADA-9 — [T-02] Safety & access-control contracts (Risk #2 + Risk #3)

- **URL:** https://linear.app/adaptive-plan/issue/ADA-9/t-02-safety-and-access-control-contracts-risk-2-risk-3
- **Status:** Done (delivered; GitHub #11 closed)
- **Priority:** High
- **Labels:** Test, Feature
- **PRD refs:** FR-003 (safety contract / disclaimer), FR-007 (access control) — Risk #2 + Risk #3
- **Blocked by:** ADA-8 (delivered)
- **Plan:** context/changes/testing-safety-access-control-contracts/
- **GitHub mirror:** #11

### ADA-10 — [T-03] UX resilience & locale output correctness (Risk #4 + Risk #5)

- **URL:** https://linear.app/adaptive-plan/issue/ADA-10/t-03-ux-resilience-and-locale-output-correctness-risk-4-risk-5
- **Status:** Done
- **Priority:** High
- **Labels:** Test, Feature
- **PRD refs:** FR-008 (locale) — Risk #4 (UX resilience / dropped-stream) + Risk #5 (locale output correctness)
- **Blocked by:** ADA-9 (delivered)
- **Plan:** context/changes/testing-ux-resilience-locale/
- **GitHub mirror:** #13

## Dependency Chain

```
ADA-5 (auth-flow) → ADA-6 (plan-generation) → ADA-7 (locale-support)
                        └─ ADA-8 (T-01 generation-flow integrity tests)
                                 └─ ADA-9 (T-02 safety & access-control contracts)
                                          └─ ADA-10 (T-03 UX resilience & locale output correctness)
```
