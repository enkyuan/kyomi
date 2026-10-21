ALTER TABLE "article_clips" ADD COLUMN "content_raw" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extracted_content_raw" text;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ADD COLUMN "raw_html" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_raw" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_content_raw" text;