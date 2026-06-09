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

  // Checks prompt-template contract only (not user-visible output).
  // User-visible disclaimer is covered by plan-disclaimer.test.tsx.
  // See test-plan §6.6 for the deterministic/eval split rationale.
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

  it("renders 'none reported' for whitespace-only healthIssues", () => {
    const prompt = buildPlanPrompt({ ...baseInput, healthIssues: "   " });
    expect(prompt).toContain("none reported");
  });

  it("trims surrounding whitespace from healthIssues before injecting into prompt", () => {
    const prompt = buildPlanPrompt({ ...baseInput, healthIssues: "  knee injury  " });
    expect(prompt).toContain("knee injury");
    expect(prompt).not.toContain("  knee injury  ");
  });

  // Deterministic half of Risk #2's health-respect contract: the prompt must carry
  // an instruction to honor the stated constraints. (Whether the generated plan
  // actually honors them is eval-shaped and deferred — see test-plan §6.6.)
  it("instructs the model to honor the stated health issues", () => {
    const prompt = buildPlanPrompt(baseInput).toLowerCase();
    expect(prompt).toContain("honor the stated health issues");
  });

  // Proves locale is *threaded into the prompt* (PL ≠ EN, default = EN).
  // This does NOT prove the LLM obeyed the instruction — rendered-output language
  // is eval-shaped and deferred (see test-plan §6.6 Phase 3 residual risks).
  it("threads the locale into the prompt (pl differs from en; default equals en)", () => {
    const plPrompt = buildPlanPrompt(baseInput, "pl");
    const enPrompt = buildPlanPrompt(baseInput, "en");
    const defaultPrompt = buildPlanPrompt(baseInput);
    expect(plPrompt).not.toBe(enPrompt);
    expect(defaultPrompt).toBe(enPrompt);
    // Assert the resolved language word — proves correct threading, not the verbatim instruction sentence.
    expect(plPrompt).toContain("Polish");
    expect(enPrompt).toContain("English");
  });
});
