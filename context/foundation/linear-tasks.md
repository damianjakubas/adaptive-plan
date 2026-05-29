---
project: AdaptivePlan
source: context/foundation/roadmap.md
created: 2026-05-28
workspace: adaptive-plan
team: Adaptive-plan
---

# Linear Tasks

## Labels

| Label | Color | Description |
|-------|-------|-------------|
| `Slice` | `#1D76DB` | Vertical roadmap slice |
| `Feature` | `#BB87FC` | New feature or request (default) |

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
- **Status:** Backlog
- **Priority:** Urgent
- **Labels:** Slice, Feature
- **PRD refs:** US-01, FR-003, FR-004, FR-005, FR-006
- **Blocked by:** ADA-5
- **GitHub mirror:** #4

### ADA-7 — [S-03] Locale support: PL/EN for UI and generation

- **URL:** https://linear.app/adaptive-plan/issue/ADA-7/s-03-locale-support-plen-for-ui-and-generation
- **Status:** Backlog
- **Priority:** Medium
- **Labels:** Slice, Feature
- **PRD refs:** FR-008
- **Blocked by:** ADA-6
- **GitHub mirror:** #5

## Dependency Chain

```
ADA-5 (auth-flow) → ADA-6 (plan-generation) → ADA-7 (locale-support)
```
