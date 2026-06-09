CREATE TABLE "workout_session_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"muscle_group" text,
	"name" text NOT NULL,
	"note" text,
	"position" integer NOT NULL,
	"session_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_session_sets" (
	"exercise_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note" text,
	"position" integer NOT NULL,
	"reps" text NOT NULL,
	"weight" real
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_minutes" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note" text,
	"performed_at" timestamp with time zone NOT NULL,
	"session_name" text NOT NULL,
	"session_type" text,
	"source_plan_id" uuid,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_session_sets" ADD CONSTRAINT "workout_session_sets_exercise_id_workout_session_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."workout_session_exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_session_exercises_session_idx" ON "workout_session_exercises" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "workout_session_sets_exercise_idx" ON "workout_session_sets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_sessions_user_performed_idx" ON "workout_sessions" USING btree ("user_id","performed_at" DESC NULLS LAST);