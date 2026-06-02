import { describe, expect, it } from "vitest";

import {
  planInputSchema,
  planOutputSchema,
  type GeneratedPlan,
  type PlanInput,
} from "@/lib/validation/plan-schema";

/** Collect the first error message per field from a failed safeParse result. */
function fieldErrors(result: {
  success: false;
  error: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    if (!(key in map)) {
      map[key] = issue.message;
    }
  }
  return map;
}

const validInput: PlanInput = {
  age: 30,
  dailySteps: 6000,
  equipment: "gym",
  experience: "intermediate",
  frequency: 4,
  goal: "muscle",
  healthIssues: "mild lower back pain",
  height: 180,
  sex: "male",
  timePerSession: 60,
  weight: 80,
  workMode: "sedentary",
};

const validPlan: GeneratedPlan = {
  calorieTarget: { kcal: 2400, note: "slight surplus" },
  cardioGoal: { note: "zone 2", targetMinutes: 90 },
  dietaryTips: [{ body: "spread across meals", title: "Protein" }],
  disclaimer: "This is not medical advice.",
  goal: "Build muscle",
  milestones: ["Week 4: +2kg"],
  progression: ["Add reps weekly"],
  summary: "A 4-day hypertrophy split.",
  timelineWeeks: 12,
  weeklySchedule: [
    {
      day: "Monday",
      exercises: [{ muscleGroup: "chest", name: "Bench press", note: "controlled", reps: "8-12", sets: 4 }],
      focus: "Upper",
      isRest: false,
    },
    { day: "Tuesday", focus: "Rest", isRest: true },
  ],
};

describe("planInputSchema", () => {
  it("accepts a fully valid set of 12 inputs", () => {
    expect(planInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a missing optional healthIssues", () => {
    const { healthIssues, ...rest } = validInput;
    void healthIssues;
    expect(planInputSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects an out-of-range weight with the invalid_weight key", () => {
    const result = planInputSchema.safeParse({ ...validInput, weight: 5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).weight).toBe("invalid_weight");
    }
  });

  it("rejects an invalid goal enum with the invalid_goal key", () => {
    const result = planInputSchema.safeParse({ ...validInput, goal: "teleport" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).goal).toBe("invalid_goal");
    }
  });

  it("rejects a missing required enum field with its i18n key", () => {
    const { sex, ...rest } = validInput;
    void sex;
    const result = planInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).sex).toBe("invalid_sex");
    }
  });

  it("rejects a frequency above 7 days with the invalid_frequency key", () => {
    const result = planInputSchema.safeParse({ ...validInput, frequency: 9 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result).frequency).toBe("invalid_frequency");
    }
  });
});

describe("planOutputSchema", () => {
  it("validates a representative generated plan", () => {
    expect(planOutputSchema.safeParse(validPlan).success).toBe(true);
  });

  it("fails safeParse on a malformed plan (missing weeklySchedule)", () => {
    const { weeklySchedule, ...rest } = validPlan;
    void weeklySchedule;
    expect(planOutputSchema.safeParse(rest).success).toBe(false);
  });

  it("fails safeParse when a non-rest day's exercise is missing required fields", () => {
    const broken = {
      ...validPlan,
      weeklySchedule: [{ day: "Monday", exercises: [{ name: "Bench press" }], focus: "Upper", isRest: false }],
    };
    expect(planOutputSchema.safeParse(broken).success).toBe(false);
  });
});
