"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  workoutSessionFormSchema,
  type WorkoutSessionFormInput,
  type WorkoutSessionFormValues,
} from "@/lib/validation/workout-session-form-schema";
import asEmptyableNumericValue from "./as-emptyable-numeric-value";
import DiscardDialog from "./discard-dialog";
import ExerciseCard from "./exercise-card";

/**
 * The shared presentational workout-session editor — a pure function of
 * `defaultValues` + callbacks. It owns the RHF form and never knows whether the
 * data came from a plan day (S-01 log-from-plan) or a saved snapshot (S-03
 * session curation): S-03 reuses this exact Props contract and adds only a
 * mapper and a route.
 *
 * - `sessionName`/`sessionType` ride through the form values without rendered
 *   inputs this slice.
 * - Discard: a dirty form opens the confirm dialog; a pristine form calls
 *   `onDiscard` directly.
 * - Exercises may be removed down to zero; saving then surfaces the
 *   `min_one_exercise` validation message rather than silently disabling save.
 * - Validation messages are rendered manually with the `Validation` namespace —
 *   shadcn's `FormMessage` prints the raw `error.message` (our i18n key) when
 *   an error is present, ignoring translated children.
 */
function WorkoutSessionEditor({ defaultValues, onDiscard, onSave, saving = false }: Props) {
  const t = useTranslations("LogWorkout");
  const tValidation = useTranslations("Validation");
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Three-generic form: the schema's preprocessed fields make z.input ≠ z.output,
  // so RHF tracks raw DOM values (input) while handleSubmit delivers parsed values
  // (output) — exactly what `onSave` receives.
  const form = useForm<WorkoutSessionFormInput, unknown, WorkoutSessionFormValues>({
    defaultValues,
    resolver: zodResolver(workoutSessionFormSchema),
  });
  const { append, fields, remove } = useFieldArray({
    control: form.control,
    name: "exercises",
  });

  // Destructured during render on purpose: RHF's formState is a lazy Proxy and
  // only tracks fields read in the render phase — reading isDirty solely inside
  // the discard click handler would never subscribe it and it would stay false.
  const { errors, isDirty, isSubmitting } = form.formState;
  const exercisesErrorKey = errors.exercises?.root?.message ?? errors.exercises?.message;

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-stack-lg"
        onSubmit={form.handleSubmit(async (values) => {
          // handleSubmit re-throws callback errors into a promise React never
          // awaits — a rejecting onSave must not escape as an unhandledrejection.
          try {
            await onSave(values);
          } catch {
            // Error feedback is parent-owned (the editor has no toast access);
            // the form simply stays editable.
          }
        })}
      >
        <div className="space-y-stack-md">
          {fields.map((exerciseField, exerciseIndex) => (
            <ExerciseCard
              key={exerciseField.id}
              exerciseIndex={exerciseIndex}
              onRemoveExercise={() => remove(exerciseIndex)}
            />
          ))}
        </div>

        <button
          type="button"
          className="flex w-full cursor-pointer flex-col items-center gap-stack-sm rounded-lg border border-dashed border-surface-container-highest bg-surface-container-lowest p-container-margin text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          onClick={() =>
            append({
              muscleGroup: undefined,
              name: "",
              note: undefined,
              sets: [{ reps: "", weight: undefined }],
            })
          }
        >
          <Plus className="size-5" />
          <span className="font-label-md text-label-md">{t("addExercise")}</span>
        </button>

        {exercisesErrorKey && (
          <p className="text-sm text-destructive">{tValidation(exercisesErrorKey as never)}</p>
        )}

        <FormField
          control={form.control}
          name="durationMinutes"
          render={({ field, fieldState }) => (
            <FormItem className="max-w-xs">
              <FormLabel>{t("durationLabel")}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder={t("durationPlaceholder")}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={asEmptyableNumericValue(field.value)}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm text-destructive">
                  {tValidation(fieldState.error.message as never)}
                </p>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notesLabel")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("notesPlaceholder")}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex flex-wrap gap-stack-sm">
          <Button type="submit" disabled={saving || isSubmitting}>
            {t("save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || isSubmitting}
            onClick={() => (isDirty ? setDiscardDialogOpen(true) : onDiscard())}
          >
            {t("discard")}
          </Button>
        </div>
      </form>
      <DiscardDialog
        open={discardDialogOpen}
        onClose={() => setDiscardDialogOpen(false)}
        onConfirm={onDiscard}
      />
    </Form>
  );
}

interface Props {
  defaultValues: WorkoutSessionFormInput;
  onDiscard: () => void;
  /** May reject — the editor swallows rejections; error feedback is parent-owned. */
  onSave: (values: WorkoutSessionFormValues) => Promise<void> | void;
  saving?: boolean;
}

export default WorkoutSessionEditor;
