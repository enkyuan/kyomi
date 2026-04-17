ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "content_html" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "content_text" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "content_markdown" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "content_status" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "content_source" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "extraction_error_code" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN IF NOT EXISTS "extraction_error_message" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "content_html" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "content_text" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "content_markdown" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "content_status" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "content_source" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extraction_error_code" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extraction_error_message" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "refresh_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_refresh_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_refresh_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_refresh_succeeded_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_refresh_failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_refresh_error" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "etag" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "last_modified" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN IF NOT EXISTS "next_refresh_at" timestamp;