import { describe, expect, it } from "vitest";

import mapPlanDayToFormValues, {
  type PlanDay,
} from "@/lib/workout/map-plan-day-to-form-values";

/**
 * Oracle: FR-011 — picking a plan day pre-fills that day's exercises, sets, and
 * reps. The plan is a template (`sets: number` + one `reps` string); the editor
 * needs per-set actuals, each seeded with the plan's reps and an empty weight.
 */

const trainingDay: PlanDay = {
  day: "Monday",
  exercises: [
    {
      muscleGroup: "chest",
      name: "Bench press",
      note: "controlled tempo",
      reps: "8-12",
      sets: 3,
    },
    { name: "Plank", reps: "30s", sets: 2 },
  ],
  focus: "Upper body",
  isRest: false,
};

describe("mapPlanDayToFormValues", () => {
  it("expands sets: 3 with reps \"8-12\" into exactly 3 rows seeded with the plan's reps and no weight", () => {
    const values = mapPlanDayToFormValues(trainingDay);

    expect(values.exercises[0].sets).toEqual([
      { reps: "8-12", weight: undefined },
      { reps: "8-12", weight: undefined },
      { reps: "8-12", weight: undefined },
    ]);
  });

  it("copies name, muscleGroup, and note onto each exercise", () => {
    const values = mapPlanDayToFormValues(trainingDay);

    expect(values.exercises[0]).toMatchObject({
      muscleGroup: "chest",
      name: "Bench press",
      note: "controlled tempo",
    });
    expect(values.exercises[1]).toMatchObject({
      muscleGroup: undefined,
      name: "Plank",
      note: undefined,
    });
  });

  it("emits at least one set row even when the plan prescribes sets: 0", () => {
    const values = mapPlanDayToFormValues({
      ...trainingDay,
      exercises: [{ name: "Stretching", reps: "60s", sets: 0 }],
    });

    expect(values.exercises[0].sets).toEqual([{ reps: "60s", weight: undefined }]);
  });

  it("clamps an outsized sets count to 20 rows and truncates non-integers", () => {
    const values = mapPlanDayToFormValues({
      ...trainingDay,
      exercises: [
        { name: "Burpees", reps: "10", sets: 100_000 },
        { name: "Rows", reps: "8", sets: 2.5 },
      ],
    });

    expect(values.exercises[0].sets).toHaveLength(20);
    expect(values.exercises[1].sets).toHaveLength(2);
  });

  it("maps sessionName from the day's focus and sessionType from the day label", () => {
    const values = mapPlanDayToFormValues(trainingDay);

    expect(values.sessionName).toBe("Upper body");
    expect(values.sessionType).toBe("Monday");
  });

  it("falls back to the day label as sessionName when focus is empty (write schema requires min(1))", () => {
    const values = mapPlanDayToFormValues({ ...trainingDay, focus: "" });

    expect(values.sessionName).toBe("Monday");
  });

  it("falls back to the literal \"Workout\" when both focus and the day label are empty", () => {
    const values = mapPlanDayToFormValues({ ...trainingDay, day: "", focus: "" });

    expect(values.sessionName).toBe("Workout");
  });

  it("maps a day without exercises to an empty list instead of throwing", () => {
    const values = mapPlanDayToFormValues({
      day: "Sunday",
      focus: "Rest",
      isRest: true,
    });

    expect(values.exercises).toEqual([]);
  });

  it("leaves durationMinutes empty (NaN — the empty number-input face) and note blank for the user", () => {
    const values = mapPlanDayToFormValues(trainingDay);

    expect(Number.isNaN(values.durationMinutes)).toBe(true);
    expect(values.note).toBe("");
  });
});
