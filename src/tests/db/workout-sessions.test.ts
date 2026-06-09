import { loadEnv } from "vite";
import { afterEach, describe, expect, it } from "vitest";

import type { WorkoutSessionInput } from "@/lib/validation/workout-session-schema";

// Load the dev env files (`.env`, `.env.local`, `.env.development`,
// `.env.development.local`) into process.env at the top of the file — before
// `hasDb`/`skipIf` are evaluated during collection. `@next/env` can't be used here:
// vitest sets NODE_ENV=test, which makes it force test-mode and skip `.env.local` /
// `.env.development.local`. Vite's `loadEnv` (prefix "" = all vars) has no such
// special-casing. Without a database configured the suite self-skips (e.g. CI).
Object.assign(process.env, loadEnv("development", process.cwd(), ""));

/**
 * Real-DB integration tests for the workout-session aggregate data access. They
 * require a reachable Postgres via `DATABASE_URL` (the Supabase pooler), so they
 * self-skip when it is unset (e.g. CI without DB env), per the project's ad-hoc
 * integration gate.
 *
 * Isolation strategy mirrors `plans.test.ts`: each run uses a throwaway random
 * `userId` (every data-access function scopes by `userId`, so this never touches
 * other rows) and `afterEach` deletes that user's sessions — the internal cascade
 * FKs clear exercises and sets — plus any plans created by the FR-024 test.
 *
 * Oracle is the PRD/roadmap (FR-012 session shape, FR-024 decoupling, per-account
 * isolation), not the implementation.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * A valid logged-session write payload. Two ordered exercises (distinct muscle
 * groups) with ordered sets, so position round-trip and derived `muscleGroups`
 * are observable. `overrides` lets a test bend exactly one field (e.g. an invalid
 * value, a different `performedAt`) without restating the whole tree.
 */
function buildInput(overrides: Partial<WorkoutSessionInput> = {}): WorkoutSessionInput {
  return {
    durationMinutes: 45,
    exercises: [
      {
        muscleGroup: "chest",
        name: "Bench Press",
        sets: [
          { reps: "8-12", weight: 60 },
          { reps: "8", weight: 65 },
        ],
      },
      {
        muscleGroup: "back",
        name: "Row",
        sets: [{ reps: "10", weight: 50 }],
      },
    ],
    note: "felt strong",
    performedAt: new Date("2026-06-01T10:00:00Z"),
    sessionName: "Push Day",
    sessionType: "strength",
    sourcePlanId: null,
    ...overrides,
  };
}

describe.skipIf(!hasDb)("workout-session data access", () => {
  // Evaluated once per process — UUID uniqueness prevents cross-run conflicts; afterEach scopes all writes.
  const userId = crypto.randomUUID();

  afterEach(async () => {
    const { db } = await import("@/db");
    const { plans, workoutSessions } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    // Deleting sessions cascades to exercises and sets (internal FKs).
    await db.delete(workoutSessions).where(eq(workoutSessions.userId, userId));
    await db.delete(plans).where(eq(plans.userId, userId));
  });

  it("create + read round-trip: getSessionById returns the full tree in position order with metadata intact", async () => {
    const { createSession, getSessionById } = await import("@/db/workout-sessions");

    const input = buildInput();
    const id = await createSession({ ...input, userId });
    const tree = await getSessionById(userId, id);

    expect(tree).not.toBeNull();
    if (!tree) return;

    expect(tree.userId).toBe(userId);
    expect(tree.sessionName).toBe("Push Day");
    expect(tree.sessionType).toBe("strength");
    expect(tree.durationMinutes).toBe(45);
    expect(tree.note).toBe("felt strong");
    expect(tree.performedAt.getTime()).toBe(input.performedAt.getTime());

    expect(tree.exercises.map((exercise) => exercise.name)).toEqual(["Bench Press", "Row"]);
    expect(tree.exercises.map((exercise) => exercise.position)).toEqual([0, 1]);
    expect(tree.exercises[0].sets.map((set) => set.reps)).toEqual(["8-12", "8"]);
    expect(tree.exercises[0].sets.map((set) => set.weight)).toEqual([60, 65]);
    expect(tree.exercises[0].sets.map((set) => set.position)).toEqual([0, 1]);
    expect(tree.exercises[1].sets).toHaveLength(1);
    expect(tree.exercises[1].sets[0].reps).toBe("10");
  });

  it("per-account isolation: another user cannot read, update, or delete a session, and never lists it", async () => {
    const { createSession, deleteSession, getSessionById, listSessions, updateSession } =
      await import("@/db/workout-sessions");
    const { db } = await import("@/db");
    const { workoutSessions } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const otherUserId = crypto.randomUUID();

    try {
      const id = await createSession({ ...buildInput(), userId });
      const otherId = await createSession({
        ...buildInput({ sessionName: "Theirs" }),
        userId: otherUserId,
      });

      expect(await getSessionById(otherUserId, id)).toBeNull();
      expect(await updateSession(otherUserId, id, buildInput({ sessionName: "Hijacked" }))).toBe(
        false
      );
      expect(await deleteSession(otherUserId, id)).toBe(false);

      // Bidirectional: each user's list shows only their own session, never the other's.
      expect((await listSessions(userId)).map((item) => item.id)).toEqual([id]);
      expect((await listSessions(otherUserId)).map((item) => item.id)).toEqual([otherId]);

      // A's session is untouched by B's failed update/delete.
      const stillMine = await getSessionById(userId, id);
      expect(stillMine?.sessionName).toBe("Push Day");
    } finally {
      await db.delete(workoutSessions).where(eq(workoutSessions.userId, otherUserId));
    }
  });

  it("listSessions returns sessions newest-first by performedAt with derived muscleGroups, no sets", async () => {
    const { createSession, listSessions } = await import("@/db/workout-sessions");

    const olderId = await createSession({
      ...buildInput({ performedAt: new Date("2026-01-01T00:00:00Z"), sessionName: "Older" }),
      userId,
    });
    const newerId = await createSession({
      ...buildInput({ performedAt: new Date("2026-03-01T00:00:00Z"), sessionName: "Newer" }),
      userId,
    });

    const list = await listSessions(userId);

    expect(list.map((item) => item.id)).toEqual([newerId, olderId]);
    // Distinct, non-null muscle groups in exercise (position) order.
    expect(list[0].muscleGroups).toEqual(["chest", "back"]);
  });

  it("listSessions derives muscleGroups as distinct, non-null values (dedup + null filtering)", async () => {
    const { createSession, listSessions } = await import("@/db/workout-sessions");

    // chest / null / chest → the dedup and null-filter branches must collapse this to ["chest"].
    await createSession({
      ...buildInput({
        exercises: [
          { muscleGroup: "chest", name: "Bench Press", sets: [{ reps: "5" }] },
          { name: "Plank", sets: [{ reps: "30s" }] },
          { muscleGroup: "chest", name: "Incline Press", sets: [{ reps: "8" }] },
        ],
      }),
      userId,
    });

    const list = await listSessions(userId);
    expect(list[0].muscleGroups).toEqual(["chest"]);
  });

  it("updateSession replace-all: re-fetched tree reflects the new children only", async () => {
    const { createSession, getSessionById, updateSession } = await import("@/db/workout-sessions");

    const id = await createSession({ ...buildInput(), userId });

    const updated = await updateSession(
      userId,
      id,
      buildInput({
        exercises: [{ muscleGroup: "legs", name: "Squat", sets: [{ reps: "5", weight: 100 }] }],
        sessionName: "Leg Day",
      })
    );
    expect(updated).toBe(true);

    const tree = await getSessionById(userId, id);
    expect(tree).not.toBeNull();
    if (!tree) return;

    expect(tree.sessionName).toBe("Leg Day");
    expect(tree.exercises.map((exercise) => exercise.name)).toEqual(["Squat"]);
    expect(tree.exercises[0].sets.map((set) => set.reps)).toEqual(["5"]);
  });

  it("deleteSession removes the session and cascades to its exercises and sets (no orphans)", async () => {
    const { createSession, deleteSession, getSessionById } = await import("@/db/workout-sessions");
    const { db } = await import("@/db");
    const { workoutSessionExercises, workoutSessionSets } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");

    const id = await createSession({ ...buildInput(), userId });

    const before = await getSessionById(userId, id);
    expect(before).not.toBeNull();
    if (!before) return;
    const exerciseIds = before.exercises.map((exercise) => exercise.id);
    const setIds = before.exercises.flatMap((exercise) => exercise.sets.map((set) => set.id));

    expect(await deleteSession(userId, id)).toBe(true);
    expect(await getSessionById(userId, id)).toBeNull();

    const orphanExercises = await db
      .select()
      .from(workoutSessionExercises)
      .where(inArray(workoutSessionExercises.id, exerciseIds));
    const orphanSets = await db
      .select()
      .from(workoutSessionSets)
      .where(inArray(workoutSessionSets.id, setIds));
    expect(orphanExercises).toHaveLength(0);
    expect(orphanSets).toHaveLength(0);
  });

  it("FR-024 decoupling: a saved session survives deletion of its source plan, full tree intact", async () => {
    const { createSession, getSessionById } = await import("@/db/workout-sessions");
    const { saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const plan = await saveActivePlan({
      model: "test-model",
      parameters: {},
      plan: { summary: "source" },
      userId,
    });
    const id = await createSession({ ...buildInput({ sourcePlanId: plan.id }), userId });

    // Delete the plan entirely — no FK/cascade may touch the session (FR-024).
    await db.delete(plans).where(eq(plans.userId, userId));

    const tree = await getSessionById(userId, id);
    expect(tree).not.toBeNull();
    if (!tree) return;

    // Advisory provenance is preserved even though the plan row is gone.
    expect(tree.sourcePlanId).toBe(plan.id);
    expect(tree.exercises).toHaveLength(2);
    expect(tree.exercises[0].sets).toHaveLength(2);
    expect(tree.exercises[1].sets).toHaveLength(1);
  });

  // Each malformed input is type-valid but violates the Zod write-contract, so
  // validation throws *before* the transaction opens — no partial rows land.
  const invalidCases: { label: string; override: Partial<WorkoutSessionInput> }[] = [
    { label: "missing sessionName", override: { sessionName: "" } },
    { label: "negative durationMinutes", override: { durationMinutes: -1 } },
    {
      label: "set without reps",
      override: { exercises: [{ name: "X", sets: [{ reps: "" }] }] },
    },
    { label: "empty exercises array", override: { exercises: [] } },
    { label: "exercise with empty sets", override: { exercises: [{ name: "X", sets: [] }] } },
  ];

  it.each(invalidCases)(
    "createSession rejects $label and writes no rows (validation precedes the transaction)",
    async ({ override }) => {
      const { createSession, listSessions } = await import("@/db/workout-sessions");

      await expect(createSession({ ...buildInput(override), userId })).rejects.toThrow();
      expect(await listSessions(userId)).toHaveLength(0);
    }
  );
});
