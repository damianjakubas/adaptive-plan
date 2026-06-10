import { NextIntlClientProvider } from "next-intl";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WorkoutSessionEditor from "@/components/workout/workout-session-editor";
import enMessages from "@/i18n/messages/en.json";
import type {
  WorkoutSessionFormInput,
  WorkoutSessionFormValues,
} from "@/lib/validation/workout-session-form-schema";

const tLogWorkout = enMessages.LogWorkout;
const tValidation = enMessages.Validation;

/**
 * Plan-day-shaped defaults (what `mapPlanDayToFormValues` emits): per-set rows
 * seeded with the plan's reps string, empty weights, "" duration (the empty
 * number-input face), no rendered input for sessionName/sessionType.
 */
function makeDefaultValues(): WorkoutSessionFormInput {
  return {
    durationMinutes: "",
    exercises: [
      {
        muscleGroup: "Chest",
        name: "Bench Press",
        sets: [
          { reps: "8-12", weight: undefined },
          { reps: "8-12", weight: undefined },
          { reps: "8-12", weight: undefined },
        ],
      },
      {
        muscleGroup: "Back",
        name: "Deadlift",
        sets: [{ reps: "5", weight: undefined }],
      },
    ],
    note: "",
    sessionName: "Upper Strength",
    sessionType: "Mon",
  };
}

function renderEditor(overrides?: { onSave?: () => Promise<void>; saving?: boolean }) {
  const onDiscard = vi.fn();
  const onSave = vi.fn();
  // Radix AlertDialog toggles pointer-events on <body>, which jsdom does not
  // model — disable user-event's pointer-events check for dialog interactions.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WorkoutSessionEditor
        defaultValues={makeDefaultValues()}
        onDiscard={onDiscard}
        onSave={overrides?.onSave ?? onSave}
        saving={overrides?.saving}
      />
    </NextIntlClientProvider>,
  );
  return { onDiscard, onSave, user };
}

describe("WorkoutSessionEditor", () => {
  it("renders the pre-filled exercises, seeded set rows and empty duration from defaultValues", () => {
    renderEditor();

    expect(screen.getByDisplayValue("Bench Press")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Deadlift")).toBeInTheDocument();
    // FR-011 seeding: 3 set rows each carrying the plan's "8-12" reps string.
    expect(screen.getAllByDisplayValue("8-12")).toHaveLength(3);
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    // The "" duration seed renders as an empty input.
    expect(screen.getByLabelText(tLogWorkout.durationLabel)).toHaveValue(null);
    expect(screen.getByText(tLogWorkout.save)).toBeInTheDocument();
  });

  it("appends an empty set row to the clicked exercise on add-set (FR-012)", async () => {
    const { user } = renderEditor();

    // 3 sets (Bench) + 1 set (Deadlift) = 4 remove-set buttons.
    expect(screen.getAllByLabelText(tLogWorkout.removeSet)).toHaveLength(4);

    await user.click(screen.getAllByRole("button", { name: tLogWorkout.addSet })[0]);

    expect(screen.getAllByLabelText(tLogWorkout.removeSet)).toHaveLength(5);
    // The appended row is empty, not another plan seed.
    expect(screen.getAllByDisplayValue("8-12")).toHaveLength(3);
  });

  it("removes the clicked set row (FR-012)", async () => {
    const { user } = renderEditor();

    await user.click(screen.getAllByLabelText(tLogWorkout.removeSet)[0]);

    expect(screen.getAllByDisplayValue("8-12")).toHaveLength(2);
    expect(screen.getAllByLabelText(tLogWorkout.removeSet)).toHaveLength(3);
  });

  it("disables remove-set on an exercise's last remaining set", () => {
    renderEditor();

    const removeSetButtons = screen.getAllByLabelText(tLogWorkout.removeSet);
    // Bench Press rows (3 sets) stay removable.
    expect(removeSetButtons[0]).toBeEnabled();
    expect(removeSetButtons[1]).toBeEnabled();
    expect(removeSetButtons[2]).toBeEnabled();
    // Deadlift's single set cannot be removed (write schema requires min 1 set).
    expect(removeSetButtons[3]).toBeDisabled();
  });

  it("appends a blank exercise card with one empty set on add-exercise (FR-014)", async () => {
    const { user } = renderEditor();

    await user.click(screen.getByRole("button", { name: tLogWorkout.addExercise }));

    const nameInputs = screen.getAllByLabelText(tLogWorkout.exerciseNameLabel);
    expect(nameInputs).toHaveLength(3);
    expect(nameInputs[2]).toHaveValue("");
    // The new exercise starts with exactly one (disabled-to-remove) set row.
    const removeSetButtons = screen.getAllByLabelText(tLogWorkout.removeSet);
    expect(removeSetButtons).toHaveLength(5);
    expect(removeSetButtons[4]).toBeDisabled();
  });

  it("removes a whole exercise card (FR-014)", async () => {
    const { user } = renderEditor();

    await user.click(screen.getAllByLabelText(tLogWorkout.removeExercise)[0]);

    expect(screen.queryByDisplayValue("Bench Press")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Deadlift")).toBeInTheDocument();
  });

  it("calls onSave with the edited, parsed values on a valid submit", async () => {
    const { onSave, user } = renderEditor();

    await user.type(screen.getAllByLabelText(tLogWorkout.weightHeader)[0], "20");
    await user.type(screen.getByLabelText(tLogWorkout.durationLabel), "60");
    await user.type(screen.getByLabelText(tLogWorkout.notesLabel), "Felt strong");
    await user.click(screen.getByRole("button", { name: tLogWorkout.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const values = onSave.mock.calls[0][0] as WorkoutSessionFormValues;
    // Numbers arrive parsed (schema coercion), strings stay verbatim.
    expect(values.durationMinutes).toBe(60);
    expect(values.note).toBe("Felt strong");
    expect(values.exercises[0].sets[0]).toEqual({ reps: "8-12", weight: 20 });
    expect(values.exercises[0].sets[1]).toEqual({ reps: "8-12", weight: undefined });
    // sessionName/sessionType ride through without rendered inputs.
    expect(values.sessionName).toBe("Upper Strength");
    expect(values.sessionType).toBe("Mon");
  });

  it("shows the translated min_one_exercise message and does not save when all exercises are removed", async () => {
    const { onSave, user } = renderEditor();

    await user.click(screen.getAllByLabelText(tLogWorkout.removeExercise)[0]);
    await user.click(screen.getAllByLabelText(tLogWorkout.removeExercise)[0]);
    await user.type(screen.getByLabelText(tLogWorkout.durationLabel), "60");
    await user.click(screen.getByRole("button", { name: tLogWorkout.save }));

    expect(await screen.findByText(tValidation.min_one_exercise)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows translated field errors and does not save when a reps field is cleared", async () => {
    const { onSave, user } = renderEditor();

    await user.clear(screen.getAllByDisplayValue("8-12")[0]);
    await user.type(screen.getByLabelText(tLogWorkout.durationLabel), "60");
    await user.click(screen.getByRole("button", { name: tLogWorkout.save }));

    expect(await screen.findByText(tValidation.invalid_reps)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onDiscard directly without a dialog when the form is pristine", async () => {
    const { onDiscard, user } = renderEditor();

    await user.click(screen.getByRole("button", { name: tLogWorkout.discard }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(tLogWorkout.discardDialogTitle)).not.toBeInTheDocument();
  });

  it("opens the confirm dialog on a dirty discard; confirm calls onDiscard", async () => {
    const { onDiscard, user } = renderEditor();

    await user.type(screen.getAllByLabelText(tLogWorkout.exerciseNameLabel)[0], "X");
    await user.click(screen.getByRole("button", { name: tLogWorkout.discard }));

    expect(await screen.findByText(tLogWorkout.discardDialogTitle)).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: tLogWorkout.discardDialogConfirm }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("keeps editing on dialog cancel: no onDiscard, dialog closes, edits intact", async () => {
    const { onDiscard, user } = renderEditor();

    await user.type(screen.getAllByLabelText(tLogWorkout.exerciseNameLabel)[0], "X");
    await user.click(screen.getByRole("button", { name: tLogWorkout.discard }));
    expect(await screen.findByText(tLogWorkout.discardDialogTitle)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: tLogWorkout.discardDialogCancel }));

    await waitFor(() =>
      expect(screen.queryByText(tLogWorkout.discardDialogTitle)).not.toBeInTheDocument(),
    );
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Bench PressX")).toBeInTheDocument();
  });

  it("fires onSave once on two rapid save clicks (isSubmitting guard)", async () => {
    let resolveSave: () => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { user } = renderEditor({ onSave });

    await user.type(screen.getByLabelText(tLogWorkout.durationLabel), "60");
    const saveButton = screen.getByRole("button", { name: tLogWorkout.save });
    await user.click(saveButton);
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeDisabled();

    resolveSave();
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it("swallows a rejecting onSave and keeps the form editable", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network down"));
    const { user } = renderEditor({ onSave });

    await user.type(screen.getByLabelText(tLogWorkout.durationLabel), "60");
    await user.click(screen.getByRole("button", { name: tLogWorkout.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // The rejection must not escape as an unhandledrejection; the form stays
    // interactive (error feedback is parent-owned).
    expect(screen.getByRole("button", { name: tLogWorkout.save })).toBeEnabled();
    expect(screen.getByDisplayValue("Bench Press")).toBeInTheDocument();
  });

  it("disables save and discard while saving", () => {
    renderEditor({ saving: true });

    expect(screen.getByRole("button", { name: tLogWorkout.save })).toBeDisabled();
    expect(screen.getByRole("button", { name: tLogWorkout.discard })).toBeDisabled();
  });
});
