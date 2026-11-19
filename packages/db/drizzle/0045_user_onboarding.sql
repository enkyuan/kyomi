CREATE TABLE "user_onboarding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"username" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "user_onboarding_username_key" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Existing accounts keep access. New accounts start without an onboarding row.
INSERT INTO "user_onboarding" ("user_id", "completed_at") SELECT "id", now() FROM "users";
