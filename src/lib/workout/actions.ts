"use server";

import { getActivePlan } from "@/db/plans";
import { createSession } from "@/db/workout-sessions";
import { createClient } from "@/lib/supabase/server";
import { type WorkoutSessionFormValues } from "@/lib/validation/workout-session-form-schema";
import { workoutSessionInputSchema } from "@/lib/validation/workout-session-schema";
import { logWorkoutError } from "@/lib/workout/log-workout-error";

/**
 * Save a logged workout session (FR-016). The single mutation entry point for
 * S-01: authenticates, re-checks the active-plan gating rule (defense in depth —
 * the page guard alone is bypassable by a direct POST), stamps the server-side
 * fields (`performedAt` = server clock, `sourcePlanId` = the user's active plan;
 * neither is accepted from the client), validates against the write schema, and
 * persists via `createSession`. Returns `{ ok, code }` like the auth actions —
 * the client owns toast + redirect.
 */
export async function saveWorkoutSession(
  values: WorkoutSessionFormValues
): Promise<SaveWorkoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "unauthenticated" };
  }

  const activePlan = await getActivePlan(user.id);
  if (!activePlan) {
    return { ok: false, code: "no_active_plan" };
  }

  const parsed = workoutSessionInputSchema.safeParse({
    ...values,
    performedAt: new Date(),
    sourcePlanId: activePlan.id,
  });

  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  try {
    await createSession({ ...parsed.data, userId: user.id });
  } catch (error) {
    logWorkoutError({ error, stage: "create-session" });
    return { ok: false, code: "save_failed" };
  }

  return { ok: true };
}

type WorkoutErrorCode = "unauthenticated" | "no_active_plan" | "invalid_input" | "save_failed";

type SaveWorkoutResult = { ok: true } | { ok: false; code: WorkoutErrorCode };

export { type SaveWorkoutResult, type WorkoutErrorCode };
