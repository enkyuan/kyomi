ALTER TABLE "article_clips" ADD COLUMN "content_html" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_markdown" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_status" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_source" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extraction_error_code" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extraction_error_message" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_html" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_markdown" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_status" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_source" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extraction_error_code" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extraction_error_message" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "refresh_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_refresh_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_refresh_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_refresh_succeeded_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_refresh_failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_refresh_error" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "etag" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_modified" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "next_refresh_at" timestamp;