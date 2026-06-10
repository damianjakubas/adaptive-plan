"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { WorkoutSessionFormInput } from "@/lib/validation/workout-session-form-schema";
import asEmptyableNumericValue from "./as-emptyable-numeric-value";

/**
 * One exercise's editable card: muscle-group badge, name input, per-set actuals
 * table (set | reps | weight | action), add-set button, remove-exercise icon.
 * Lives as its own component because the sets-level `useFieldArray` must be
 * instantiated per exercise — a parent cannot call hooks in a loop.
 *
 * The remove-set button is disabled on the last remaining set (the write schema
 * requires min(1) set per exercise; removing the whole exercise is how you drop
 * it). Reps is a text input on purpose: it accepts plan-seeded ranges ("8-12")
 * as well as typed actuals.
 *
 * Validation messages are rendered manually with the `Validation` namespace —
 * shadcn's `FormMessage` prints the raw `error.message` (our i18n key) when an
 * error is present, ignoring translated children.
 */
function ExerciseCard({ exerciseIndex, onRemoveExercise }: Props) {
  const t = useTranslations("LogWorkout");
  const tValidation = useTranslations("Validation");
  const { control, getValues } = useFormContext<WorkoutSessionFormInput>();
  const { append, fields, remove } = useFieldArray({
    control,
    name: `exercises.${exerciseIndex}.sets`,
  });

  const muscleGroup = getValues(`exercises.${exerciseIndex}.muscleGroup`);

  return (
    <div className="rounded-lg border border-surface-container-highest bg-surface-container-low p-container-margin">
      <div className="mb-stack-md flex items-start justify-between gap-stack-sm">
        <div className="flex-1 space-y-2">
          {muscleGroup && (
            <span className="inline-block rounded-full bg-surface-container-highest px-2 py-0.5 font-label-md text-label-md uppercase text-on-surface-variant">
              {muscleGroup}
            </span>
          )}
          <FormField
            control={control}
            name={`exercises.${exerciseIndex}.name`}
            render={({ field, fieldState }) => (
              <FormItem>
                <FormControl>
                  <Input
                    aria-label={t("exerciseNameLabel")}
                    placeholder={t("exerciseNamePlaceholder")}
                    {...field}
                    value={field.value ?? ""}
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
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("removeExercise")}
          onClick={onRemoveExercise}
        >
          <Trash2 />
        </Button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left font-label-md text-label-md text-on-surface-variant">
            <th className="py-2 pr-2 font-medium">{t("setHeader")}</th>
            <th className="px-2 py-2 font-medium">{t("repsHeader")}</th>
            <th className="px-2 py-2 font-medium">{t("weightHeader")}</th>
            <th className="py-2 pl-2 text-right font-medium">{t("actionHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((setField, setIndex) => (
            <tr key={setField.id} className="border-t border-surface-container-highest">
              <td className="py-2 pr-2 text-on-surface-variant">{setIndex + 1}</td>
              <td className="px-2 py-2">
                <FormField
                  control={control}
                  name={`exercises.${exerciseIndex}.sets.${setIndex}.reps`}
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          aria-label={t("repsHeader")}
                          {...field}
                          value={field.value ?? ""}
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
              </td>
              <td className="px-2 py-2">
                <FormField
                  control={control}
                  name={`exercises.${exerciseIndex}.sets.${setIndex}.weight`}
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          aria-label={t("weightHeader")}
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
              </td>
              <td className="py-2 pl-2 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeSet")}
                  disabled={fields.length === 1}
                  onClick={() => remove(setIndex)}
                >
                  <Trash2 />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button
        type="button"
        variant="ghost"
        className="mt-stack-sm text-primary-container"
        onClick={() => append({ reps: "", weight: undefined })}
      >
        <Plus />
        {t("addSet")}
      </Button>
    </div>
  );
}

interface Props {
  exerciseIndex: number;
  onRemoveExercise: () => void;
}

export default ExerciseCard;
