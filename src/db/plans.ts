import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { plans, type Plan } from "@/db/schema";

/**
 * Read the user's single active plan, or `null` if none exists. Scoped by
 * `userId` because RLS is off — server-side scoping is the only isolation.
 */
async function getActivePlan(userId: string): Promise<Plan | null> {
  const rows = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.isActive, true)))
    .orderBy(desc(plans.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Replace the user's active plan in a single transaction: deactivate any existing
 * active rows for the user, then insert the new active row. Returning the inserted
 * row. Scoped by `userId` (RLS is off) so the deactivate never touches other users.
 */
async function saveActivePlan(input: SaveActivePlanInput): Promise<Plan> {
  return db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ isActive: false })
      .where(and(eq(plans.userId, input.userId), eq(plans.isActive, true)));

    const [row] = await tx
      .insert(plans)
      .values({
        isActive: true,
        model: input.model,
        parameters: input.parameters,
        plan: input.plan,
        userId: input.userId,
      })
      .returning();

    return row;
  });
}

interface SaveActivePlanInput {
  model: string;
  parameters: Record<string, unknown>;
  plan: Record<string, unknown>;
  userId: string;
}

export { getActivePlan, saveActivePlan, type SaveActivePlanInput };
