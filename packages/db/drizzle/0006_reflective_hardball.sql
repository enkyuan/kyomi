ALTER TABLE "feed_subscriptions" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp;
