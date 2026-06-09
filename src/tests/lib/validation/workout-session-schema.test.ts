import { describe, expect, it } from "vitest";

import {
  workoutSessionInputSchema,
  type WorkoutSessionInput,
} from "@/lib/validation/workout-session-schema";

const validSession: WorkoutSessionInput = {
  durationMinutes: 45,
  exercises: [
    {
      muscleGroup: "chest",
      name: "Bench press",
      note: "controlled tempo",
      sets: [
        { note: "warmup", reps: "12", weight: 40 },
        { reps: "8-10", weight: 60 },
      ],
    },
  ],
  note: "felt strong",
  performedAt: new Date("2026-06-09T18:00:00.000Z"),
  sessionName: "Upper A",
  sessionType: "strength",
  sourcePlanId: "11111111-1111-4111-8111-111111111111",
};

describe("workoutSessionInputSchema", () => {
  it("accepts a fully valid nested session", () => {
    expect(workoutSessionInputSchema.safeParse(validSession).success).toBe(true);
  });

  it("coerces an ISO datetime string into a Date for performedAt", () => {
    const result = workoutSessionInputSchema.safeParse({
      ...validSession,
      performedAt: "2026-06-09T18:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.performedAt).toBeInstanceOf(Date);
    }
  });

  it("accepts a session with no sourcePlanId (plan-decoupled provenance is optional)", () => {
    const { sourcePlanId, ...rest } = validSession;
    void sourcePlanId;
    expect(workoutSessionInputSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts optional metadata being absent (sessionType, note, exercise/set notes)", () => {
    const minimal = {
      durationMinutes: 0,
      exercises: [{ name: "Plank", sets: [{ reps: "30s" }] }],
      performedAt: new Date("2026-06-09T18:00:00.000Z"),
      sessionName: "Quick session",
    };
    expect(workoutSessionInputSchema.safeParse(minimal).success).toBe(true);
  });

  const rejectionCases: Array<[string, unknown]> = [
    ["missing sessionName", { ...validSession, sessionName: undefined }],
    ["empty sessionName", { ...validSession, sessionName: "" }],
    ["negative durationMinutes", { ...validSession, durationMinutes: -1 }],
    ["non-integer durationMinutes", { ...validSession, durationMinutes: 45.5 }],
    [
      "a set without reps",
      {
        ...validSession,
        exercises: [{ name: "Bench press", sets: [{ weight: 60 }] }],
      },
    ],
    [
      "an empty reps string",
      {
        ...validSession,
        exercises: [{ name: "Bench press", sets: [{ reps: "" }] }],
      },
    ],
    ["an empty exercises array", { ...validSession, exercises: [] }],
    [
      "an exercise with an empty sets array",
      {
        ...validSession,
        exercises: [{ name: "Bench press", sets: [] }],
      },
    ],
    [
      "an exercise without a name",
      {
        ...validSession,
        exercises: [{ sets: [{ reps: "8" }] }],
      },
    ],
    ["a non-uuid sourcePlanId", { ...validSession, sourcePlanId: "not-a-uuid" }],
    [
      "a non-numeric weight",
      {
        ...validSession,
        exercises: [{ name: "Bench press", sets: [{ reps: "8", weight: "60" }] }],
      },
    ],
    ["null", null],
    ["empty object", {}],
  ];

  it.each(rejectionCases)("rejects %s", (_label, input) => {
    expect(workoutSessionInputSchema.safeParse(input).success).toBe(false);
  });
});
