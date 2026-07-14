CREATE TABLE "article_extraction_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"url_key" text NOT NULL,
	"source_url" text NOT NULL,
	"final_url" text,
	"content_hash" text,
	"content_html" text,
	"content_text" text,
	"status" text NOT NULL,
	"error_code" text,
	"error_message" text,
	"fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "article_extraction_cache_url_key_unique" ON "article_extraction_cache" USING btree ("url_key");--> statement-breakpoint
CREATE INDEX "article_extraction_cache_content_hash_idx" ON "article_extraction_cache" USING btree ("content_hash");