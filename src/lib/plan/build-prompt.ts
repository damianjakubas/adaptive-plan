import type { PlanInput } from "@/lib/validation/plan-schema";

/**
 * Pure function turning validated parameter-form inputs into the generation prompt.
 * Kept out of the route per the helpers-in-separate-files rule. Accepts an optional
 * `locale` for S-03 readiness (output-locale selection is a later slice); for now it
 * only annotates the requested response language without changing the default.
 *
 * The prompt instructs the model to honor the user's health constraints, equipment,
 * training frequency, and goal, to reference the user's specific inputs, and to
 * populate a not-medical-advice `disclaimer` — all acceptance criteria for US-01.
 */
function buildPlanPrompt(input: PlanInput, locale?: string): string {
  const health = input.healthIssues?.trim()
    ? input.healthIssues.trim()
    : "none reported";

  const localeLine = locale ? `\nRespond in locale: ${locale}.` : "";

  return `You are an expert personal trainer and nutrition coach. Generate a personalized training plan tailored to this individual. Reference their specific inputs in your recommendations — do not produce a generic plan.

User profile:
- Age: ${input.age}
- Sex: ${input.sex}
- Weight: ${input.weight} kg
- Height: ${input.height} cm
- Work mode: ${input.workMode}
- Daily steps: ${input.dailySteps}
- Health issues / constraints: ${health}
- Goal: ${input.goal}
- Available equipment: ${input.equipment}
- Training frequency: ${input.frequency} days per week
- Time per session: ${input.timePerSession} minutes
- Experience level: ${input.experience}

Requirements:
- Honor the stated health issues and constraints — never prescribe exercises that conflict with them. If constraints are reported, explicitly adapt around them.
- Use only the equipment available (${input.equipment}).
- Match the weekly schedule to the requested frequency (${input.frequency} days) and time per session (${input.timePerSession} min); fill the remaining days as rest days (isRest: true).
- Tailor intensity and exercise selection to the ${input.experience} experience level and the ${input.goal} goal.
- For each non-rest day, list concrete exercises with sets and reps. For rest days, mark isRest true and omit exercises.
- Provide a realistic calorie target, weekly cardio goal, progression guidance, a timeline in weeks with milestones, and practical dietary tips.
- Always include a clear disclaimer stating this is not medical advice and that the user should consult a healthcare professional before starting a new program.${localeLine}`;
}

export default buildPlanPrompt;
