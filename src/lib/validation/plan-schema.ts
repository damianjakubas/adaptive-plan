import { z } from "zod";

/**
 * Single source of truth for the plan-generation contract, imported by both the
 * generation route (`Output.object`) and the streaming client (`useObject`) so the
 * input and output shapes never drift.
 *
 * Error messages are **i18n keys** (mirrors `src/lib/validation/auth.ts`), resolved
 * to localized strings by the consumer via the next-intl `Validation` namespace.
 */

/** The 12 parameter-form inputs the user fills before generation. */
export const planInputSchema = z.object({
  age: z.number({ message: "invalid_age" }).int().min(13, { message: "invalid_age" }).max(100, { message: "invalid_age" }),
  dailySteps: z.number({ message: "invalid_daily_steps" }).int().min(0, { message: "invalid_daily_steps" }).max(60000, { message: "invalid_daily_steps" }),
  equipment: z.enum(["none", "home", "gym"], { message: "invalid_equipment" }),
  experience: z.enum(["beginner", "intermediate", "advanced"], { message: "invalid_experience" }),
  frequency: z.number({ message: "invalid_frequency" }).int().min(1, { message: "invalid_frequency" }).max(7, { message: "invalid_frequency" }),
  goal: z.enum(["weight-loss", "muscle", "strength", "health-relief"], { message: "invalid_goal" }),
  healthIssues: z.string().max(1000, { message: "invalid_health_issues" }).optional(),
  height: z.number({ message: "invalid_height" }).min(100, { message: "invalid_height" }).max(250, { message: "invalid_height" }),
  sex: z.enum(["male", "female"], { message: "invalid_sex" }),
  timePerSession: z.number({ message: "invalid_time_per_session" }).int().min(10, { message: "invalid_time_per_session" }).max(240, { message: "invalid_time_per_session" }),
  weight: z.number({ message: "invalid_weight" }).min(30, { message: "invalid_weight" }).max(300, { message: "invalid_weight" }),
  workMode: z.enum(["sedentary", "active"], { message: "invalid_work_mode" }),
});

/** A single exercise within a training day. `reps` is a string to allow ranges ("8-12"). */
const exerciseSchema = z.object({
  muscleGroup: z.string().optional(),
  name: z.string(),
  note: z.string().optional(),
  reps: z.string(),
  sets: z.number(),
});

/** One day of the weekly schedule. Rest days set `isRest: true` and omit `exercises`. */
const scheduleDaySchema = z.object({
  day: z.string(),
  exercises: z.array(exerciseSchema).optional(),
  focus: z.string(),
  isRest: z.boolean(),
});

/**
 * The fully-structured generated plan. The deepest point is per-day `exercises[]`
 * nested in `weeklySchedule[]` (the interactive day tabs) — a deliberate
 * richness/risk tradeoff guarded by `safeParse` in the route's `onFinish`.
 */
export const planOutputSchema = z.object({
  calorieTarget: z.object({
    kcal: z.number(),
    note: z.string(),
  }),
  cardioGoal: z.object({
    note: z.string(),
    targetMinutes: z.number(),
  }),
  dietaryTips: z.array(
    z.object({
      body: z.string(),
      title: z.string(),
    })
  ),
  disclaimer: z.string(),
  goal: z.string(),
  milestones: z.array(z.string()),
  progression: z.array(z.string()),
  summary: z.string(),
  timelineWeeks: z.number(),
  weeklySchedule: z.array(scheduleDaySchema),
});

export type PlanInput = z.infer<typeof planInputSchema>;
export type GeneratedPlan = z.infer<typeof planOutputSchema>;
