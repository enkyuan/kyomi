-- Raw source columns hold untrusted, often large HTML that is read only for recompiles.
-- lz4 compresses and decompresses faster than the default pglz for TOASTed text.
-- SET COMPRESSION is metadata-only: it applies to values written from now on and rewrites nothing.
ALTER TABLE "feed_items" ALTER COLUMN "content_raw" SET COMPRESSION lz4;--> statement-breakpoint
ALTER TABLE "feed_items" ALTER COLUMN "extracted_content_raw" SET COMPRESSION lz4;--> statement-breakpoint
ALTER TABLE "article_clips" ALTER COLUMN "content_raw" SET COMPRESSION lz4;--> statement-breakpoint
ALTER TABLE "article_clips" ALTER COLUMN "extracted_content_raw" SET COMPRESSION lz4;--> statement-breakpoint
ALTER TABLE "article_extraction_cache" ALTER COLUMN "raw_html" SET COMPRESSION lz4;
