import type { SessionWithTree } from "@/db/workout-sessions";
import type { WorkoutSessionFormInput } from "@/lib/validation/workout-session-form-schema";

/**
 * The mirror image of `mapPlanDayToFormValues`: collapse a saved session's nested
 * tree (exercises → sets) back into the editor's form-input shape, so the same
 * editor renders a stored snapshot with zero editor changes (FR-020).
 *
 * - `durationMinutes` is coerced from the stored integer back to the string the
 *   number input round-trips through (`String(...)`) — the form's `z.input` face
 *   is the raw DOM string, not the parsed number.
 * - A set's nullable `weight` (bodyweight / not-yet-entered → `null` in the DB)
 *   maps to `undefined`, the optional-field face the form schema preprocesses.
 * - Nullable text columns (`muscleGroup`, exercise/set `note`, `sessionType`) map
 *   `null → undefined`: the form schema types them optional, never nullable.
 * - `performedAt` and `sourcePlanId` are intentionally dropped — the editor never
 *   surfaces them; the update action preserves them server-side (Phase 2).
 */
function mapSessionToFormValues(session: SessionWithTree): WorkoutSessionFormInput {
  return {
    durationMinutes: String(session.durationMinutes),
    exercises: session.exercises.map((exercise) => ({
      muscleGroup: exercise.muscleGroup ?? undefined,
      name: exercise.name,
      note: exercise.note ?? undefined,
      sets: exercise.sets.map((set) => ({
        note: set.note ?? undefined,
        reps: set.reps,
        weight: set.weight ?? undefined,
      })),
    })),
    note: session.note ?? undefined,
    sessionName: session.sessionName,
    sessionType: session.sessionType ?? undefined,
  };
}

export default mapSessionToFormValues;
