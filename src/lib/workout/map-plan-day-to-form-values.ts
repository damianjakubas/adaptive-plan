import type { GeneratedPlan } from "@/lib/validation/plan-schema";
import type { WorkoutSessionFormInput } from "@/lib/validation/workout-session-form-schema";

/**
 * The FR-011 pre-fill rule as a pure function: expand a plan day's template
 * (one `reps` string + a set count) into the editor's per-set actuals.
 *
 * - Each exercise emits `sets` rows clamped to [1, 20] (truncated to an integer —
 *   the plan schema leaves `sets` unbounded, and an LLM-sized outlier must not
 *   explode the field array), every row seeded with the plan's `reps` string
 *   (so "8-12" carries over losslessly) and an empty weight.
 * - `sessionName` falls back to `day.day`, then to a literal `"Workout"` — the
 *   plan schema puts no `min(1)` on `focus`/`day`, the write schema requires a
 *   non-empty `sessionName`, and the form renders no input for it, so an empty
 *   value must not surface as an invisible validation failure.
 * - `durationMinutes` is left for the user: `""` is the DOM's natural empty
 *   number-input face, normalized to a required-field error by the form schema.
 * - A day without `exercises` maps to an empty list (callers filter unloggable
 *   days, but the mapper must not throw).
 */
function mapPlanDayToFormValues(day: PlanDay): WorkoutSessionFormInput {
  return {
    durationMinutes: "",
    exercises: (day.exercises ?? []).map((exercise) => ({
      muscleGroup: exercise.muscleGroup,
      name: exercise.name,
      note: exercise.note,
      sets: Array.from(
        { length: Math.min(Math.max(Math.trunc(exercise.sets), 1), 20) },
        () => ({
          reps: exercise.reps,
          weight: undefined,
        }),
      ),
    })),
    note: "",
    sessionName: day.focus || day.day || "Workout",
    sessionType: day.day,
  };
}

type PlanDay = GeneratedPlan["weeklySchedule"][number];

export { type PlanDay };
export default mapPlanDayToFormValues;
