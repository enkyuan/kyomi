ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extracted_content_html" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extracted_content_text" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extracted_content_status" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extracted_content_error" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "extracted_content_updated_at" timestamp;
