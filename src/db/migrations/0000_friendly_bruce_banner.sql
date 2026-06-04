CREATE TABLE "plans" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"model" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plans_user_active_idx" ON "plans" USING btree ("user_id","is_active");