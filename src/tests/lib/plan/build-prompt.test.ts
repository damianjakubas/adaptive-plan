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

  // Deterministic half of Risk #2's health-respect contract: the prompt must carry
  // an instruction to honor the stated constraints. (Whether the generated plan
  // actually honors them is eval-shaped and deferred — see test-plan §6.6.)
  it("instructs the model to honor the stated health issues", () => {
    const prompt = buildPlanPrompt(baseInput).toLowerCase();
    expect(prompt).toContain("honor the stated health issues");
  });

  it("forces the output language to match the locale (defaulting to English)", () => {
    expect(buildPlanPrompt(baseInput, "pl")).toContain("Write ALL natural-language text in Polish");
    expect(buildPlanPrompt(baseInput, "en")).toContain("Write ALL natural-language text in English");
    expect(buildPlanPrompt(baseInput)).toContain("Write ALL natural-language text in English");
  });
});
