CREATE TABLE "feed_item_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_item_id" text NOT NULL,
	"source_content_hash" text NOT NULL,
	"source_language" text NOT NULL,
	"target_language" text NOT NULL,
	"source_text" text NOT NULL,
	"translated_text" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'cloudflare' NOT NULL,
	"model_id" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp,
	"lease_token" text,
	"last_attempt_at" timestamp,
	"error_code" text,
	"error_message" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_item_translations_status_check" CHECK ("feed_item_translations"."status" IN ('queued', 'processing', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "feed_item_translations" ADD CONSTRAINT "feed_item_translations_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_translations_identity_unique" ON "feed_item_translations" USING btree ("feed_item_id","source_content_hash","source_language","target_language","model_id");--> statement-breakpoint
CREATE INDEX "feed_item_translations_feed_lookup_idx" ON "feed_item_translations" USING btree ("feed_item_id","target_language","updated_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "feed_item_translations_claim_idx" ON "feed_item_translations" USING btree ("status","lease_expires_at");