ALTER TABLE "feed_items" ADD COLUMN "content_html" text;
ALTER TABLE "feed_items" ADD COLUMN "content_text" text;
ALTER TABLE "feed_items" ADD COLUMN "content_markdown" text;
ALTER TABLE "feed_items" ADD COLUMN "content_status" text;
ALTER TABLE "feed_items" ADD COLUMN "content_source" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_error_code" text;
ALTER TABLE "feed_items" ADD COLUMN "extraction_error_message" text;

ALTER TABLE "article_clips" ADD COLUMN "content_html" text;
ALTER TABLE "article_clips" ADD COLUMN "content_text" text;
ALTER TABLE "article_clips" ADD COLUMN "content_markdown" text;
ALTER TABLE "article_clips" ADD COLUMN "content_status" text;
ALTER TABLE "article_clips" ADD COLUMN "content_source" text;
ALTER TABLE "article_clips" ADD COLUMN "extraction_error_code" text;
ALTER TABLE "article_clips" ADD COLUMN "extraction_error_message" text;
