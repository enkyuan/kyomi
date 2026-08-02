ALTER TABLE "article_clips" ADD COLUMN "content_sanitizer_version" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extracted_content_sanitizer_version" text;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ADD COLUMN "sanitizer_version" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_sanitizer_version" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_content_sanitizer_version" text;