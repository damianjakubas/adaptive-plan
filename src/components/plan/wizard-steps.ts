import { type PlanInput } from "@/lib/validation/plan-schema";

export type WizardStep = {
  id: string;
  titleKey: string;
  fields: (keyof PlanInput)[];
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "basics",
    titleKey: "step_basics",
    fields: ["age", "sex", "weight", "height"],
  },
  {
    id: "lifestyle",
    titleKey: "step_lifestyle",
    fields: ["workMode", "dailySteps"],
  },
  {
    id: "health",
    titleKey: "step_health",
    fields: ["healthIssues", "goal"],
  },
  {
    id: "preferences",
    titleKey: "step_preferences",
    fields: ["equipment", "frequency", "timePerSession", "experience"],
  },
];
