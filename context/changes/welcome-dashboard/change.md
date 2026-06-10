---
change_id: welcome-dashboard
roadmap_id: S-04
status: planned
created: 2026-06-10
updated: 2026-06-10
prd_refs: [FR-010, FR-025]
---

# Welcome Dashboard (S-04)

State-aware welcome dashboard: a new authenticated `/dashboard` page reachable from the
navbar, whose primary CTA adapts to the user's plan state (no plan → generate; has plan →
log a workout / view plan), rendering cleanly for a brand-new user with no plan and no
history. Adds a leftmost "Dashboard" navbar entry. Does **not** flip the post-auth redirect
— that is S-05 (`dashboard-post-auth-landing`).

PRD refs: FR-010 (state-aware CTA), FR-025 (locale parity), Business Logic rule 4
(dashboard-state rule). Prerequisite: S-01 (`log-workout-from-plan`, done).
