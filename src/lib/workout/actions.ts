"use server";

import { getActivePlan } from "@/db/plans";
import {
  createSession,
  deleteSession,
  getSessionById,
  updateSession,
} from "@/db/workout-sessions";
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

  let activePlan;
  try {
    activePlan = await getActivePlan(user.id);
  } catch (error) {
    logWorkoutError({ error, stage: "active-plan-check" });
    return { ok: false, code: "save_failed" };
  }
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

/**
 * Persist edits to an existing session (FR-020). Unlike {@link saveWorkoutSession},
 * this preserves the session's original `performedAt` and `sourcePlanId` — both
 * sourced from the stored row, never the editor (which surfaces neither) and never
 * re-stamped to `now`, so editing reps never reorders history (FR-024). The same
 * owner-scoped `getSessionById` fetch doubles as the ownership gate (`null` →
 * `not_found`, no write). Deliberately **not** gated on an active plan: FR-020
 * requires edit to work after the plan has changed or been removed.
 */
export async function updateWorkoutSession(
  sessionId: string,
  values: WorkoutSessionFormValues
): Promise<UpdateWorkoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "unauthenticated" };
  }

  let original;
  try {
    original = await getSessionById(user.id, sessionId);
  } catch (error) {
    logWorkoutError({ error, stage: "load-session" });
    return { ok: false, code: "save_failed" };
  }
  if (!original) {
    return { ok: false, code: "not_found" };
  }

  const parsed = workoutSessionInputSchema.safeParse({
    ...values,
    performedAt: original.performedAt,
    sourcePlanId: original.sourcePlanId,
  });

  if (!parsed.success) {
    return { ok: false, code: "invalid_input" };
  }

  let updated;
  try {
    updated = await updateSession(user.id, sessionId, parsed.data);
  } catch (error) {
    logWorkoutError({ error, stage: "update-session" });
    return { ok: false, code: "save_failed" };
  }
  if (!updated) {
    return { ok: false, code: "not_found" };
  }

  return { ok: true };
}

/**
 * Permanently delete a session owned by the current user (FR-021). The
 * owner-scoped `deleteSession` cascades to exercises and sets; `false` means the
 * session was missing or not owned (`not_found`). No soft-delete or recovery —
 * permanence is the contract, gated only by the client-side confirmation step.
 */
export async function deleteWorkoutSession(
  sessionId: string
): Promise<DeleteWorkoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "unauthenticated" };
  }

  let deleted;
  try {
    deleted = await deleteSession(user.id, sessionId);
  } catch (error) {
    logWorkoutError({ error, stage: "delete-session" });
    return { ok: false, code: "delete_failed" };
  }
  if (!deleted) {
    return { ok: false, code: "not_found" };
  }

  return { ok: true };
}

type WorkoutErrorCode = "unauthenticated" | "no_active_plan" | "invalid_input" | "save_failed";

type SaveWorkoutResult = { ok: true } | { ok: false; code: WorkoutErrorCode };

type UpdateErrorCode = "unauthenticated" | "not_found" | "invalid_input" | "save_failed";

type UpdateWorkoutResult = { ok: true } | { ok: false; code: UpdateErrorCode };

type DeleteErrorCode = "unauthenticated" | "not_found" | "delete_failed";

type DeleteWorkoutResult = { ok: true } | { ok: false; code: DeleteErrorCode };

export {
  type DeleteErrorCode,
  type DeleteWorkoutResult,
  type SaveWorkoutResult,
  type UpdateErrorCode,
  type UpdateWorkoutResult,
  type WorkoutErrorCode,
};
