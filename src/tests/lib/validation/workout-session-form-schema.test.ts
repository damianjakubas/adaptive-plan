import { describe, expect, it } from "vitest";

import {
  workoutSessionFormSchema,
  type WorkoutSessionFormValues,
} from "@/lib/validation/workout-session-form-schema";
import type { WorkoutSessionInput } from "@/lib/validation/workout-session-schema";

const validValues = {
  durationMinutes: 45,
  exercises: [
    {
      muscleGroup: "chest",
      name: "Bench press",
      sets: [
        { reps: "8-12", weight: 60 },
        { reps: "8-12", weight: undefined },
      ],
    },
  ],
  note: "felt strong",
  sessionName: "Upper body",
  sessionType: "Monday",
};

function firstMessage(input: unknown): string | undefined {
  const result = workoutSessionFormSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("workoutSessionFormSchema", () => {
  it("accepts valid form values", () => {
    expect(workoutSessionFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("parses to a WorkoutSessionInput subset (compile-time contract for the save action)", () => {
    const result = workoutSessionFormSchema.parse(validValues);
    const subset: Omit<WorkoutSessionInput, "performedAt" | "sourcePlanId"> = result;
    expect(subset).toEqual(result);
  });

  const keyedRejections: Array<[string, unknown, string]> = [
    [
      "an empty reps string",
      {
        ...validValues,
        exercises: [{ name: "Bench press", sets: [{ reps: "" }] }],
      },
      "invalid_reps",
    ],
    [
      "an empty exercise name",
      {
        ...validValues,
        exercises: [{ name: "", sets: [{ reps: "8" }] }],
      },
      "invalid_exercise_name",
    ],
    ["a missing duration", { ...validValues, durationMinutes: undefined }, "invalid_duration"],
    ["an empty-string duration", { ...validValues, durationMinutes: "" }, "invalid_duration"],
    ["a NaN duration (empty valueAsNumber input)", { ...validValues, durationMinutes: Number.NaN }, "invalid_duration"],
    ["a negative duration", { ...validValues, durationMinutes: -1 }, "invalid_duration"],
    ["a non-integer duration", { ...validValues, durationMinutes: 45.5 }, "invalid_duration"],
    ["a duration above 1440 minutes", { ...validValues, durationMinutes: 1441 }, "invalid_duration"],
    ["zero exercises", { ...validValues, exercises: [] }, "min_one_exercise"],
    [
      "an exercise with zero sets",
      {
        ...validValues,
        exercises: [{ name: "Bench press", sets: [] }],
      },
      "min_one_set",
    ],
    [
      "a non-numeric weight string (defensive branch)",
      {
        ...validValues,
        exercises: [{ name: "Bench press", sets: [{ reps: "8", weight: "abc" }] }],
      },
      "invalid_weight",
    ],
    [
      "a negative weight",
      {
        ...validValues,
        exercises: [{ name: "Bench press", sets: [{ reps: "8", weight: -60 }] }],
      },
      "invalid_weight",
    ],
  ];

  it.each(keyedRejections)("rejects %s with its exact i18n key", (_label, input, key) => {
    expect(firstMessage(input)).toBe(key);
  });

  it.each([
    ["an empty string", ""],
    ["NaN (empty valueAsNumber input)", Number.NaN],
    ["null", null],
  ])("normalizes a weight of %s to undefined", (_label, weight) => {
    const result = workoutSessionFormSchema.parse({
      ...validValues,
      exercises: [{ name: "Bench press", sets: [{ reps: "8", weight }] }],
    });
    expect(result.exercises[0].sets[0].weight).toBeUndefined();
  });

  it("coerces DOM number-input strings for durationMinutes and weight", () => {
    const result = workoutSessionFormSchema.parse({
      ...validValues,
      durationMinutes: "45",
      exercises: [{ name: "Bench press", sets: [{ reps: "8", weight: "62.5" }] }],
    });
    expect(result.durationMinutes).toBe(45);
    expect(result.exercises[0].sets[0].weight).toBe(62.5);
  });

  it("accepts zero durationMinutes (lower bound)", () => {
    expect(
      workoutSessionFormSchema.safeParse({ ...validValues, durationMinutes: 0 }).success
    ).toBe(true);
  });

  it("rejects an empty sessionName (rides through the form without an input — mapper guarantees it)", () => {
    expect(
      workoutSessionFormSchema.safeParse({ ...validValues, sessionName: "" }).success
    ).toBe(false);
  });

  it("accepts optional fields being absent (note, sessionType, muscleGroup, set weight)", () => {
    const minimal = {
      durationMinutes: 30,
      exercises: [{ name: "Plank", sets: [{ reps: "30s" }] }],
      sessionName: "Quick session",
    };
    expect(workoutSessionFormSchema.safeParse(minimal).success).toBe(true);
  });
});

// Compile-time guard in the other direction: a valid WorkoutSessionFormValues object
// must be expressible without the server-stamped fields.
const _formValues: WorkoutSessionFormValues = {
  durationMinutes: 45,
  exercises: [{ name: "Bench press", sets: [{ reps: "8" }] }],
  sessionName: "Upper body",
};
void _formValues;
