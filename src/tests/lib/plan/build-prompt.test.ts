import { describe, expect, it } from "vitest";

import buildPlanPrompt from "@/lib/plan/build-prompt";
import type { PlanInput } from "@/lib/validation/plan-schema";

const baseInput: PlanInput = {
  age: 42,
  dailySteps: 3000,
  equipment: "home",
  experience: "beginner",
  frequency: 3,
  goal: "weight-loss",
  healthIssues: "knee injury",
  height: 170,
  sex: "female",
  timePerSession: 45,
  weight: 72,
  workMode: "sedentary",
};

describe("buildPlanPrompt", () => {
  it("references the user's goal, health issues, and equipment", () => {
    const prompt = buildPlanPrompt(baseInput);
    expect(prompt).toContain("weight-loss");
    expect(prompt).toContain("knee injury");
    expect(prompt).toContain("home");
  });

  it("includes a not-medical-advice disclaimer instruction", () => {
    const prompt = buildPlanPrompt(baseInput).toLowerCase();
    expect(prompt).toContain("disclaimer");
    expect(prompt).toContain("not medical advice");
  });

  it("renders 'none reported' when health issues are omitted", () => {
    const { healthIssues, ...rest } = baseInput;
    void healthIssues;
    const prompt = buildPlanPrompt(rest);
    expect(prompt).toContain("none reported");
  });

  it("appends a locale instruction only when a locale is provided", () => {
    expect(buildPlanPrompt(baseInput)).not.toContain("Respond in locale");
    expect(buildPlanPrompt(baseInput, "pl")).toContain("Respond in locale: pl");
  });
});
