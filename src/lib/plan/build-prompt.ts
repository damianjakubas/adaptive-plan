import type { PlanInput } from "@/lib/validation/plan-schema";

/**
 * Pure function turning validated parameter-form inputs into the generation prompt.
 * Kept out of the route per the helpers-in-separate-files rule. Accepts an optional
 * `locale` (the active UI locale) and maps it to a language name so the model writes
 * every free-text field in the user's selected language.
 *
 * The prompt instructs the model to honor the user's health constraints, equipment,
 * training frequency, and goal, to reference the user's specific inputs, and to
 * populate a not-medical-advice `disclaimer` — all acceptance criteria for US-01.
 */
function buildPlanPrompt(input: PlanInput, locale?: string): string {
  const health = input.healthIssues?.trim()
    ? input.healthIssues.trim()
    : "none reported";

  const language = locale === "pl" ? "Polish" : "English";
  const localeLine = `\n\nLanguage requirement: Write ALL natural-language text in ${language} — the summary, the goal label, day names, focus labels, exercise names and notes, dietary tip titles and bodies, progression steps, milestones, the calorie note, the cardio note, and the disclaimer. Do not use any other language for any human-readable text. Keep the structural/enum-like values unchanged: numbers (kcal, minutes, sets, reps, weeks), the isRest booleans, and the JSON field names stay exactly as specified.`;

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
