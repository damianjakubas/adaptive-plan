import type { GeneratedPlan } from "@/lib/validation/plan-schema";
import type { WorkoutSessionFormValues } from "@/lib/validation/workout-session-form-schema";

/**
 * The FR-011 pre-fill rule as a pure function: expand a plan day's template
 * (one `reps` string + a set count) into the editor's per-set actuals.
 *
 * - Each exercise emits `max(sets, 1)` rows, every row seeded with the plan's
 *   `reps` string (so "8-12" carries over losslessly) and an empty weight.
 * - `sessionName` falls back to `day.day` when `focus` is empty — the write schema
 *   requires a non-empty `sessionName` but the form renders no input for it, so an
 *   empty `focus` must not surface as an opaque server-side `invalid_input`.
 * - `durationMinutes` is left for the user: `NaN` is the form's "empty number
 *   input" face, normalized to a required-field error by the form schema.
 * - A day without `exercises` maps to an empty list (callers filter unloggable
 *   days, but the mapper must not throw).
 */
function mapPlanDayToFormValues(day: PlanDay): WorkoutSessionFormValues {
  return {
    durationMinutes: Number.NaN,
    exercises: (day.exercises ?? []).map((exercise) => ({
      muscleGroup: exercise.muscleGroup,
      name: exercise.name,
      note: exercise.note,
      sets: Array.from({ length: Math.max(exercise.sets, 1) }, () => ({
        reps: exercise.reps,
        weight: undefined,
      })),
    })),
    note: "",
    sessionName: day.focus || day.day,
    sessionType: day.day,
  };
}

type PlanDay = GeneratedPlan["weeklySchedule"][number];

export { type PlanDay };
export default mapPlanDayToFormValues;
