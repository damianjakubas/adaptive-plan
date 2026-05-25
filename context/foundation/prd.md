---
project: "AdaptivePlan"
version: 1
status: draft
created: 2026-05-25
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-06-30
  after_hours_only: true
---

## Vision & Problem Statement

No affordable, accessible tool generates truly personalized training plans that account for individual body parameters, health constraints, and real-world lifestyle. Existing fitness apps use rigid templates that ignore health problems and don't consider work mode, daily activity level, or equipment access — users either pay for a personal trainer or follow generic programs that risk injury or stagnation.

The insight: two things existing fitness apps miss. First, health issues as first-class inputs — back pain, joint problems, and other conditions shape the entire training plan, not just a footnote. Second, full lifestyle context — work mode (sedentary vs active), daily steps, and real-world constraints inform the plan alongside gym preferences.

## User & Persona

### Primary persona

The user themselves — a person who trains (or wants to start) and has specific health issues and a work-life context that generic programs ignore. Building for themselves first, then potentially for others. Reaches for the product when they need a training plan that respects their current health problems, their sedentary/active work mode, and their specific goals — and the existing apps just hand them a cookie-cutter template.

## Success Criteria

### Primary
- User submits their parameters and receives a personalized training plan that accounts for all inputs (health issues, goals, equipment, lifestyle).

### Secondary
- User's latest generated plan is persisted as their active plan and accessible across sessions.

### Guardrails
- Health-related advice must carry a disclaimer (not medical advice).
- User data (health issues, body stats) must not leak between accounts.
- Generated plan must visibly reference the user's specific inputs (not a generic template).

## User Stories

### US-01: User generates a personalized training plan

- **Given** a logged-in user on the parameter form page
- **When** they fill in all parameters (body stats, work mode, steps, health issues, goal, equipment access, training frequency, time per session, experience level) and submit
- **Then** they see a personalized training plan that includes: a training routine, progression suggestions, calorie recommendation, and a realistic timeline — all visibly tied to their specific inputs

#### Acceptance Criteria
- Plan must reference at least the user's stated goal, health issues, and equipment access
- Health disclaimer is visible on the results page
- Latest plan automatically becomes the active plan (no manual save step)

## Functional Requirements

### Authentication

- FR-001: User can register with email and password. Priority: must-have
  > Socrates: No counter-argument. Registration is needed to save plans per-user. Stands as written.

- FR-002: User can log in with email and password. Priority: must-have
  > Socrates: No counter-argument. Login is essential. Stands as written.

- FR-007: User can log out. Priority: must-have
  > Socrates: No counter-argument. Logout is basic security hygiene. Stands as written.

### Plan generation

- FR-003: User can fill in a parameter form (weight, height, age, sex, work mode, daily steps, health issues, goal, equipment access, training frequency, time per session, experience level). Priority: must-have
  > Socrates: Counter-argument considered: "missing key parameters — training frequency, available time per session, and experience level are important for a useful plan." Resolution: added training frequency (days/week), time per session, and experience level (beginner/intermediate/advanced) to the form.

- FR-004: User can submit parameters and receive a personalized training plan. Priority: must-have
  > Socrates: Counter-argument considered: "output is unpredictable — bad generation = bad plans." Resolution: kept; generation prompt will be structured and written by the developer, parameters are passed into a controlled template. Risk is negligible.

- FR-005: User can view the generated plan (training routine, progression, calorie recommendation, timeline). Priority: must-have
  > Socrates: No counter-argument. All four elements are needed to make the plan actionable. Stands as written.

### Plan persistence

- FR-006: User has one active plan (latest generation replaces previous). Priority: must-have
  > Socrates: Counter-argument considered: "one active plan is enough — saving multiple creates clutter without value." Resolution: simplified from multiple saved plans to one active plan. Plan history deferred to post-MVP (YAGNI — old plans without progress tracking context are noise).

### Localization

- FR-008: User can select a locale (Polish or English) from the navbar; the selected locale applies to both the UI and the generated output. Priority: must-have

## Non-Functional Requirements

- Continuous visible progress during plan generation — the user must see acknowledgment within 2 seconds of submission and ongoing progress indication while the generation is in progress (no blank screen or unresponsive state during generation).
- User health data (body stats, health issues, goals) must not be shared with, leaked to, or accessible by other users or any party beyond the plan generation process itself.
- The app supports two locales (Polish and English). Both the UI and generated output render in the user's selected locale.

## Business Logic

Given a user's body parameters, health constraints, lifestyle context, goals, and preferences, the app generates a personalized training plan with routine, calorie intake target, progression instructions, and guidance.

The rule consumes user-facing inputs across five categories: body stats (weight, height, age, sex), lifestyle (work mode, daily steps), health (current issues as free text), goals (weight loss, muscle building, strength, health issue relief), and preferences (equipment access, training frequency, time per session, experience level). The selected locale (Polish or English) determines the language of the generated output.

The output is a comprehensive training plan comprising: a training routine (exercises, sets, reps, weekly schedule), a calorie intake recommendation aligned with the stated goal, a progression plan describing how to advance over time, a realistic timeline estimate for reaching the goal, and contextual guidance and instructions. Every element of the output is shaped by the user's specific inputs — health constraints modify exercise selection, work mode informs recovery recommendations, equipment access determines exercise availability.

## Access Control

Email + password registration and login. Flat user model — all users are equal, everyone sees the same app. Each user has their own account to store personal parameters and generated training plans. No admin role in MVP.

Unauthenticated users are redirected to the login/register page. All plan generation and plan viewing routes are gated behind authentication.

## Non-Goals

- No training session mode (timers, rep counting, workout execution) — MVP generates plans only. Session mode is post-MVP.
- No diet or meal planning — calorie intake target is shown, but no meal plans, recipes, or food tracking.
- No progress tracking over time — no logging workouts done, no before/after comparisons, no graphs. Just the plan.
- No social features — no sharing plans, no community, no trainer-client relationships.

## Open Questions

No blocking open questions were identified during shaping (quality check: accepted).
