# Review follow-ups — log-workout-from-plan

Queued from `/10x-impl-review` triage (phase 3, 2026-06-10). Items here are out of
this change's scope but were surfaced by the review.

## F6 — Add `.max()` bounds to the workout-session write schema

- **Source**: impl-review-phase-3.md, finding F6 (OBSERVATION, Safety & Quality)
- **Where**: `src/lib/validation/workout-session-schema.ts` (pre-existing, shipped with F-01)
- **Problem**: Neither the form schema nor the server write schema caps array or
  string lengths — `exercises`, `sets`, and `note` are unbounded, so the editor's
  add-exercise/add-set buttons plus the save action accept arbitrarily large payloads.
- **Proposed fix**: Add `.max()` bounds to the server write schema (e.g. exercises
  ≤ 50, sets per exercise ≤ 50, note/name strings ≤ a sane length), mirrored in the
  client form schema with i18n keys. The plan-day mapper already clamps seeded sets
  to 20, so bounds ≥ 20 are safe for pre-fill.
- **Constraint**: The S-01 plan forbids schema changes in this change — do this in a
  separate follow-up change (S-03 session curation touches the same contract and is a
  natural host).

## F7 — parameter-form likely renders raw i18n keys on validation error

- **Source**: impl-review-phase-3.md, finding F7 (OBSERVATION, Pattern Consistency)
- **Where**: `src/components/plan/parameter-form.tsx` (pre-existing plan-generation UI)
- **Problem**: shadcn's `FormMessage` prefers raw `error.message` over children when
  an error is present, and this codebase stores i18n *keys* in Zod messages — so
  `<FormMessage>{cond && tValidation(...)}` likely shows the untranslated key (e.g.
  `invalid_age`) to the user. The phase-3 workout editor avoided the trap by
  rendering translated errors manually (documented in its docblock).
- **Proposed fix**: Verify in the browser, then either render translated text via a
  path `FormMessage` won't override, or replicate the workout editor's manual
  `<p>{tValidation(error.message)}</p>` approach in parameter-form.

