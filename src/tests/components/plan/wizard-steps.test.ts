import { describe, it, expect } from "vitest";
import { WIZARD_STEPS } from "@/components/plan/wizard-steps";
import { planInputSchema } from "@/lib/validation/plan-schema";

describe("WIZARD_STEPS", () => {
  it("includes all schema fields exactly once across all steps", () => {
    const schemaFields = Object.keys(planInputSchema.shape).sort();
    const stepFields = WIZARD_STEPS.flatMap((step) => step.fields).sort();

    expect(stepFields).toEqual(schemaFields);
  });
});
