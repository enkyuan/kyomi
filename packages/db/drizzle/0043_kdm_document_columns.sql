ALTER TABLE "article_clips" ADD COLUMN "content_document" jsonb;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_document_version" integer;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "content_compiler_version" text;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extracted_content_document" jsonb;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extracted_content_document_version" integer;--> statement-breakpoint
ALTER TABLE "article_clips" ADD COLUMN "extracted_content_compiler_version" text;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ADD COLUMN "document" jsonb;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ADD COLUMN "document_version" integer;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ADD COLUMN "compiler_version" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_document" jsonb;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_document_version" integer;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_compiler_version" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_content_document" jsonb;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_content_document_version" integer;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_content_compiler_version" text;