import { z } from "zod";

/**
 * Single source of truth for a logged workout session's **write** shape — the
 * nested input that `createSession`/`updateSession` validate before opening the
 * persistence transaction (mirrors how the plan-generation route guards its
 * inputs with `safeParse` before any write).
 *
 * This is intentionally richer than the plan's exercise shape: the plan carries
 * `sets: number` + a single `reps` string and no weight, whereas a logged session
 * needs per-set actuals (`reps`, `weight?`). The DB-row *read* types live in
 * `src/db/schema.ts`; this file owns the *write/validation* contract only.
 *
 * No i18n message keys here (unlike `plan-schema.ts`): this is a server-side data
 * contract with no user-facing form surface in this foundation slice.
 */

/** One logged set's actuals. `reps` is text so a plan's "8-12" range seeds losslessly. */
const setInputSchema = z.object({
  note: z.string().optional(),
  reps: z.string().min(1),
  weight: z.number().optional(),
});

/** One logged exercise: ordered, with at least one set. */
const exerciseInputSchema = z.object({
  muscleGroup: z.string().optional(),
  name: z.string().min(1),
  note: z.string().optional(),
  sets: z.array(setInputSchema).min(1),
});

/**
 * A logged session as written by S-01 (log-from-plan) and S-03 (curate). A session
 * must have at least one exercise, and each exercise at least one set (FR-012 /
 * roadmap session definition) — empty drafts are out of scope for this slice.
 *
 * `sourcePlanId` is advisory provenance only (no FK to `plans`); `performedAt` is
 * coerced from an ISO string or `Date` so callers can pass either.
 */
export const workoutSessionInputSchema = z.object({
  durationMinutes: z.number().int().min(0),
  exercises: z.array(exerciseInputSchema).min(1),
  note: z.string().optional(),
  performedAt: z.coerce.date(),
  sessionName: z.string().min(1),
  sessionType: z.string().optional(),
  sourcePlanId: z.string().uuid().nullish(),
});

export type SetInput = z.infer<typeof setInputSchema>;
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;
export type WorkoutSessionInput = z.infer<typeof workoutSessionInputSchema>;
