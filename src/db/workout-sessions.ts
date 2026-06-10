import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import deriveMuscleGroups from "@/db/derive-muscle-groups";
import {
  workoutSessionExercises,
  workoutSessionSets,
  workoutSessions,
  type WorkoutSession,
  type WorkoutSessionExercise,
  type WorkoutSessionSet,
} from "@/db/schema";
import {
  workoutSessionInputSchema,
  type WorkoutSessionInput,
} from "@/lib/validation/workout-session-schema";

/**
 * `userId`-scoped data access over the workout-session aggregate
 * (`workout_sessions` → `workout_session_exercises` → `workout_session_sets`).
 *
 * Every function scopes by `user_id` on the aggregate root, because RLS is off —
 * server-side scoping is the only per-account isolation (mirrors `plans.ts`).
 * Multi-table writes run in a single `db.transaction` so a logged session is
 * atomic; inputs are Zod-validated *before* the transaction opens, so malformed
 * data never reaches the DB (mirrors the plan-generation route's guard).
 */

/**
 * Insert a session's exercises and their sets, stamping array index onto
 * `position` so the (meaningful) input order round-trips on read. Runs inside the
 * caller's transaction; shared by `createSession` and `updateSession`'s
 * replace-all path.
 */
async function insertExerciseTree(
  tx: Tx,
  sessionId: string,
  exercises: WorkoutSessionInput["exercises"]
): Promise<void> {
  for (const [exerciseIndex, exercise] of exercises.entries()) {
    const [exerciseRow] = await tx
      .insert(workoutSessionExercises)
      .values({
        muscleGroup: exercise.muscleGroup,
        name: exercise.name,
        note: exercise.note,
        position: exerciseIndex,
        sessionId,
      })
      .returning({ id: workoutSessionExercises.id });

    await tx.insert(workoutSessionSets).values(
      exercise.sets.map((set, setIndex) => ({
        exerciseId: exerciseRow.id,
        note: set.note,
        position: setIndex,
        reps: set.reps,
        weight: set.weight,
      }))
    );
  }
}

/**
 * Validate `input` against `workoutSessionInputSchema`, then in one transaction
 * insert the session row (with `userId` and advisory `sourcePlanId`), its
 * exercises, and each exercise's sets. Returns the new session id — a caller
 * needing the full tree re-fetches via `getSessionById`. Throws on invalid input
 * (before any write).
 */
async function createSession(input: CreateSessionInput): Promise<string> {
  const data = workoutSessionInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(workoutSessions)
      .values({
        durationMinutes: data.durationMinutes,
        note: data.note,
        performedAt: data.performedAt,
        sessionName: data.sessionName,
        sessionType: data.sessionType,
        sourcePlanId: data.sourcePlanId,
        userId: input.userId,
      })
      .returning({ id: workoutSessions.id });

    await insertExerciseTree(tx, session.id, data.exercises);

    return session.id;
  });
}

/**
 * Sessions for `userId`, newest-first by `performed_at`, with derived
 * `muscleGroups` (distinct non-null muscle groups across the session's
 * exercises, in `position` order). Deliberately does **not** load sets — keeps
 * the history list query light against the ~1s p95 guardrail. Pass `limit` to
 * bound the row scan when only the most recent few are needed (e.g. the
 * dashboard glance); omit it for the full history list.
 */
async function listSessions(userId: string, limit?: number): Promise<SessionListItem[]> {
  const rows = await db.query.workoutSessions.findMany({
    limit,
    orderBy: desc(workoutSessions.performedAt),
    where: eq(workoutSessions.userId, userId),
    with: {
      exercises: {
        columns: { muscleGroup: true },
        orderBy: asc(workoutSessionExercises.position),
      },
    },
  });

  return rows.map((row) => ({
    durationMinutes: row.durationMinutes,
    id: row.id,
    muscleGroups: deriveMuscleGroups(row.exercises),
    note: row.note,
    performedAt: row.performedAt,
    sessionName: row.sessionName,
    sessionType: row.sessionType,
    sourcePlanId: row.sourcePlanId,
  }));
}

/**
 * The full nested session tree for `userId`, or `null` if the session is not
 * owned/found. Nested collections are ordered explicitly by `position` —
 * Drizzle does not order nested relations by default, and the round-trip order
 * is part of the contract.
 */
async function getSessionById(
  userId: string,
  sessionId: string
): Promise<SessionWithTree | null> {
  const row = await db.query.workoutSessions.findFirst({
    where: and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)),
    with: {
      exercises: {
        orderBy: asc(workoutSessionExercises.position),
        with: {
          sets: {
            orderBy: asc(workoutSessionSets.position),
          },
        },
      },
    },
  });

  return row ?? null;
}

/**
 * Validate `input`, then in one transaction verify ownership, update the session
 * metadata, and **replace-all** children (delete exercises — cascade clears
 * their sets — then re-insert from the validated input). Returns `true` when the
 * session was owned and updated, `false` (no-op) when it is not owned by
 * `userId`. Throws on invalid input (before any write).
 */
async function updateSession(
  userId: string,
  sessionId: string,
  input: WorkoutSessionInput
): Promise<boolean> {
  const data = workoutSessionInputSchema.parse(input);

  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)));

    if (!owned) return false;

    await tx
      .update(workoutSessions)
      .set({
        durationMinutes: data.durationMinutes,
        note: data.note,
        performedAt: data.performedAt,
        sessionName: data.sessionName,
        sessionType: data.sessionType,
        sourcePlanId: data.sourcePlanId,
      })
      .where(eq(workoutSessions.id, sessionId));

    await tx
      .delete(workoutSessionExercises)
      .where(eq(workoutSessionExercises.sessionId, sessionId));

    await insertExerciseTree(tx, sessionId, data.exercises);

    return true;
  });
}

/**
 * Delete the session owned by `userId` (cascade removes its exercises and sets).
 * Returns whether a row was deleted — `false` when the session is not owned/found.
 */
async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const deleted = await db
    .delete(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .returning({ id: workoutSessions.id });

  return deleted.length > 0;
}

/** Drizzle transaction handle, derived from `db.transaction`'s callback param. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** `createSession` input: the validated write shape plus the owning `userId`. */
interface CreateSessionInput extends WorkoutSessionInput {
  userId: string;
}

/** Lightweight history-list row: session metadata + derived muscle groups, no sets. */
interface SessionListItem {
  durationMinutes: number;
  id: string;
  muscleGroups: string[];
  note: string | null;
  performedAt: Date;
  sessionName: string;
  sessionType: string | null;
  sourcePlanId: string | null;
}

/** Full nested aggregate returned by `getSessionById`. */
type SessionWithTree = WorkoutSession & {
  exercises: (WorkoutSessionExercise & { sets: WorkoutSessionSet[] })[];
};

export {
  createSession,
  deleteSession,
  getSessionById,
  listSessions,
  updateSession,
  type CreateSessionInput,
  type SessionListItem,
  type SessionWithTree,
};
