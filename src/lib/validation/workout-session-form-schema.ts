import { z } from "zod";

/**
 * Client-side form contract for the workout-session editor — what RHF validates on
 * save (S-01 log-from-plan; reused by S-03 curate). Mirrors the structure of the
 * server write schema (`workout-session-schema.ts`) minus the server-stamped fields
 * (`performedAt`, `sourcePlanId`), and carries **i18n message keys** (mirrors
 * `plan-schema.ts`) resolved by the consumer via the next-intl `Validation` namespace.
 *
 * Number inputs arrive from the DOM as strings ("", "60") or NaN (an empty field
 * read via `valueAsNumber`). Both number fields normalize those empty faces to
 * `undefined` before coercion: `weight` is optional so it stays `undefined`, while
 * `durationMinutes` is required and fails with `invalid_duration`.
 */

/** "", null, and NaN are all the DOM's faces of "the user typed nothing". */
const emptyNumericInputToUndefined = (value: unknown): unknown =>
  value === "" || value === null || (typeof value === "number" && Number.isNaN(value))
    ? undefined
    : value;

/**
 * One set's editable actuals. The `weight` coercion message is defensive only — a
 * `type="number"` input cannot produce a non-empty, non-numeric string.
 */
const setFormSchema = z.object({
  note: z.string().optional(),
  reps: z.string().min(1, { message: "invalid_reps" }),
  weight: z.preprocess(
    emptyNumericInputToUndefined,
    z.coerce
      .number({ message: "invalid_weight" })
      .min(0, { message: "invalid_weight" })
      .optional()
  ),
});

const exerciseFormSchema = z.object({
  muscleGroup: z.string().optional(),
  name: z.string().min(1, { message: "invalid_exercise_name" }),
  note: z.string().optional(),
  sets: z.array(setFormSchema).min(1, { message: "min_one_set" }),
});

/**
 * `sessionName` carries no i18n key: it rides through the form without a rendered
 * input this slice, and the plan-day mapper guarantees it is non-empty.
 */
export const workoutSessionFormSchema = z.object({
  durationMinutes: z.preprocess(
    emptyNumericInputToUndefined,
    z.coerce
      .number({ message: "invalid_duration" })
      .int({ message: "invalid_duration" })
      .min(0, { message: "invalid_duration" })
      .max(1440, { message: "invalid_duration" })
  ),
  exercises: z.array(exerciseFormSchema).min(1, { message: "min_one_exercise" }),
  note: z.string().optional(),
  sessionName: z.string().min(1),
  sessionType: z.string().optional(),
});

/**
 * What RHF tracks while the user types (the three-generic form's first type
 * parameter): preprocessed number fields are `unknown` because the DOM hands
 * over raw strings. `defaultValues` and `useFormContext` must use this type —
 * the parsed `WorkoutSessionFormValues` only exists after a successful submit.
 */
export type WorkoutSessionFormInput = z.input<typeof workoutSessionFormSchema>;
export type WorkoutSessionFormValues = z.infer<typeof workoutSessionFormSchema>;
