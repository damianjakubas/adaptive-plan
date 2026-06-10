import { loadEnv } from "vite";
import { afterEach, describe, expect, it } from "vitest";

// Load the dev env files (`.env`, `.env.local`, `.env.development`,
// `.env.development.local`) into process.env at the top of the file — before
// `hasDb`/`skipIf` are evaluated during collection. `@next/env` can't be used here:
// vitest sets NODE_ENV=test, which makes it force test-mode and skip `.env.local` /
// `.env.development.local`. Vite's `loadEnv` (prefix "" = all vars) has no such
// special-casing. Without a database configured the suite self-skips (e.g. CI).
Object.assign(process.env, loadEnv("development", process.cwd(), ""));

/**
 * DB-touching tests for the active-plan helpers. They require a reachable Postgres
 * via `DATABASE_URL` (the Supabase pooler), so they self-skip when it is unset.
 *
 * Isolation strategy: each test uses a throwaway random `userId` (the helpers scope
 * every query by `userId`, so this never touches other rows) and deletes that user's
 * rows in `afterEach`, so assertions never pollute dev data.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("active-plan helpers", () => {
  // Evaluated once per process — UUID uniqueness prevents cross-run conflicts; afterEach scopes all writes.
  const userId = crypto.randomUUID();

  afterEach(async () => {
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(plans).where(eq(plans.userId, userId));
  });

  it("leaves exactly one active row after two saves, and getActivePlan returns the latest", async () => {
    const { getActivePlan, saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");

    await saveActivePlan({
      model: "test-model",
      parameters: { goal: "muscle" },
      plan: { summary: "first" },
      userId,
    });

    const second = await saveActivePlan({
      model: "test-model",
      parameters: { goal: "weight-loss" },
      plan: { summary: "second" },
      userId,
    });

    const activeRows = await db
      .select()
      .from(plans)
      .where(and(eq(plans.userId, userId), eq(plans.isActive, true)));
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].id).toBe(second.id);

    const active = await getActivePlan(userId);
    expect(active?.id).toBe(second.id);
    expect(active?.plan).toEqual({ summary: "second" });
  });

  it("hasActivePlan tracks existence and pins the isActive filter", async () => {
    const { hasActivePlan, saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    expect(await hasActivePlan(userId)).toBe(false);

    await saveActivePlan({
      model: "test-model",
      parameters: {},
      plan: { summary: "mine" },
      userId,
    });

    expect(await hasActivePlan(userId)).toBe(true);
    // A different user never sees this row (eq(userId) scoping).
    expect(await hasActivePlan(crypto.randomUUID())).toBe(false);

    // Deactivating the row must flip the check — pins eq(isActive), not mere row existence.
    await db.update(plans).set({ isActive: false }).where(eq(plans.userId, userId));
    expect(await hasActivePlan(userId)).toBe(false);
  });

  it("isolates users — getActivePlan never returns another user's active plan", async () => {
    const { getActivePlan, saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const otherUserId = crypto.randomUUID();

    try {
      await saveActivePlan({
        model: "test-model",
        parameters: {},
        plan: { summary: "theirs" },
        userId: otherUserId,
      });

      expect(await getActivePlan(userId)).toBeNull();
      expect((await getActivePlan(otherUserId))?.plan).toEqual({ summary: "theirs" });
    } finally {
      await db.delete(plans).where(eq(plans.userId, otherUserId));
    }
  });

  it("isolates users both directions when both have active plans — pins eq(userId) against orderBy/limit", async () => {
    const { getActivePlan, saveActivePlan } = await import("@/db/plans");
    const { db } = await import("@/db");
    const { plans } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const otherUserId = crypto.randomUUID();

    try {
      await saveActivePlan({
        model: "test-model",
        parameters: {},
        plan: { summary: "mine" },
        userId,
      });

      await saveActivePlan({
        model: "test-model",
        parameters: {},
        plan: { summary: "theirs" },
        userId: otherUserId,
      });

      const mine = await getActivePlan(userId);
      const theirs = await getActivePlan(otherUserId);

      expect(mine?.plan).toEqual({ summary: "mine" });
      expect(mine?.userId).toBe(userId);
      expect(theirs?.plan).toEqual({ summary: "theirs" });
      expect(theirs?.userId).toBe(otherUserId);
    } finally {
      await db.delete(plans).where(eq(plans.userId, otherUserId));
      // userId rows cleaned by afterEach
    }
  });
});
