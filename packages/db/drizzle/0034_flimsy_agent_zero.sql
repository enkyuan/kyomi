CREATE TABLE "feed_category_backfill_status" (
	"feed_id" text NOT NULL,
	"classifier_method" text NOT NULL,
	"model_id" text NOT NULL,
	"taxonomy_version" text NOT NULL,
	"status" text NOT NULL,
	"feed_classifier_categories" integer DEFAULT 0 NOT NULL,
	"feed_classifier_fallback_suppressed" boolean DEFAULT false NOT NULL,
	"items_scanned" integer DEFAULT 0 NOT NULL,
	"items_with_classifier_categories" integer DEFAULT 0 NOT NULL,
	"item_classifier_abstentions" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"processed_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_cat_backfill_status_pk" PRIMARY KEY("feed_id","classifier_method","model_id","taxonomy_version")
);
--> statement-breakpoint
ALTER TABLE "feed_category_backfill_status" ADD CONSTRAINT "feed_category_backfill_status_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_cat_backfill_status_idx" ON "feed_category_backfill_status" USING btree ("classifier_method","model_id","taxonomy_version","status","feed_id");