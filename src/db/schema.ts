import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * `plans` models the product rule "one active plan per user, latest replaces
 * previous". A new generation inserts a row with `isActive = true` after the
 * user's prior active rows are flipped to `false` (see `saveActivePlan`), so the
 * `(user_id, is_active)` index serves the single hot read on `/plan`.
 *
 * `plan` stores the generated structured plan; `parameters` stores a snapshot of
 * the 12 form inputs for explainability. Both are typed loosely here and tightened
 * to the shared Zod-inferred shapes once those land in Phase 2.
 */
export const plans = pgTable(
  "plans",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    id: uuid("id").primaryKey().defaultRandom(),
    isActive: boolean("is_active").notNull().default(true),
    model: text("model").notNull(),
    parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
    plan: jsonb("plan").$type<Record<string, unknown>>().notNull(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [index("plans_user_active_idx").on(table.userId, table.isActive)]
);

export type NewPlan = typeof plans.$inferInsert;
export type Plan = typeof plans.$inferSelect;
