import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/**
 * `workout_sessions` is the aggregate root of a logged workout. It carries
 * `user_id` — the only per-account isolation key (RLS is off, mirroring `plans`) —
 * and the session-level metadata the history list reads.
 *
 * `source_plan_id` is deliberately a plain nullable `uuid` with **no FK to `plans`**:
 * it records advisory provenance only. A live reference (or cascade) would let plan
 * regeneration/deletion alter or orphan history, violating FR-024. Internal cascade
 * FKs link the three workout-session tables to each other; none ever points at `plans`.
 */
export const workoutSessions = pgTable(
  "workout_sessions",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    durationMinutes: integer("duration_minutes").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    note: text("note"),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
    sessionName: text("session_name").notNull(),
    sessionType: text("session_type"),
    sourcePlanId: uuid("source_plan_id"),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    index("workout_sessions_user_performed_idx").on(table.userId, table.performedAt.desc()),
  ]
);

/**
 * Exercises within a logged session. `position` preserves the (meaningful) plan
 * exercise order so reads round-trip it. The `session_id` FK cascades on delete, so
 * removing a session removes its exercises — the cascade lives strictly inside the
 * aggregate.
 */
export const workoutSessionExercises = pgTable(
  "workout_session_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    muscleGroup: text("muscle_group"),
    name: text("name").notNull(),
    note: text("note"),
    position: integer("position").notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
  },
  (table) => [index("workout_session_exercises_session_idx").on(table.sessionId)]
);

/**
 * Per-set actuals for an exercise. `reps` is **text** so pre-fill can seed the plan's
 * `"8-12"` range strings losslessly (actuals like `"8"` are also valid text). `weight`
 * is a nullable `real` (bodyweight / not-yet-entered → null); `real` round-trips as a
 * TS `number`, matching the Zod `weight?: number` contract — `numeric` would map to a
 * TS `string` and break it. `position` preserves set order; the `exercise_id` FK cascades.
 */
export const workoutSessionSets = pgTable(
  "workout_session_sets",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => workoutSessionExercises.id, { onDelete: "cascade" }),
    id: uuid("id").primaryKey().defaultRandom(),
    note: text("note"),
    position: integer("position").notNull(),
    reps: text("reps").notNull(),
    weight: real("weight"),
  },
  (table) => [index("workout_session_sets_exercise_idx").on(table.exerciseId)]
);

export const workoutSessionsRelations = relations(workoutSessions, ({ many }) => ({
  exercises: many(workoutSessionExercises),
}));

export const workoutSessionExercisesRelations = relations(
  workoutSessionExercises,
  ({ many, one }) => ({
    session: one(workoutSessions, {
      fields: [workoutSessionExercises.sessionId],
      references: [workoutSessions.id],
    }),
    sets: many(workoutSessionSets),
  })
);

export const workoutSessionSetsRelations = relations(workoutSessionSets, ({ one }) => ({
  exercise: one(workoutSessionExercises, {
    fields: [workoutSessionSets.exerciseId],
    references: [workoutSessionExercises.id],
  }),
}));

export type NewWorkoutSession = typeof workoutSessions.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSessionExercise = typeof workoutSessionExercises.$inferInsert;
export type WorkoutSessionExercise = typeof workoutSessionExercises.$inferSelect;
export type NewWorkoutSessionSet = typeof workoutSessionSets.$inferInsert;
export type WorkoutSessionSet = typeof workoutSessionSets.$inferSelect;
