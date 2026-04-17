ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "favicon_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "favicon_source" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "favicon_fetched_at" timestamp;
