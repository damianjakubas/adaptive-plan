---
change_id: dashboard-post-auth-landing
roadmap_id: S-05
status: implemented
created: 2026-06-11
updated: 2026-06-11
prd_refs: [FR-009, FR-023]
---

# Dashboard as Post-Auth Landing (S-05)

After logging in or registering, the user is taken to the welcome dashboard (`/dashboard`)
instead of the current `/plan` target. The single slice that touches the shipped auth flow:
three redirect sites — `signIn`, `signUp`, and the proxy's authenticated-on-`/login` bounce —
flip to the dashboard behind one shared constant. Every other auth behavior
(error mapping, route gating, logout) is preserved and gated by its existing tests.

PRD refs: FR-009 (post-auth redirect target), FR-023 (existing auth preserved).
Prerequisite: S-04 (`welcome-dashboard`, done — dashboard renders cleanly for new users).
