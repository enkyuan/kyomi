CREATE TABLE "article_reading_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feed_item_id" text,
	"clip_id" text,
	"progress" real DEFAULT 0 NOT NULL,
	"max_progress" real DEFAULT 0 NOT NULL,
	"anchor" jsonb,
	"content_key" text NOT NULL,
	"content_words" integer,
	"active_read_ms" integer DEFAULT 0 NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"last_session_id" text,
	"last_session_active_ms" integer DEFAULT 0 NOT NULL,
	"client_updated_at" timestamp,
	"first_read_at" timestamp NOT NULL,
	"last_read_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"state" text DEFAULT 'reading' NOT NULL,
	"due_at" timestamp,
	"interval_days" real DEFAULT 1 NOT NULL,
	"ease" real DEFAULT 2 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_impression_at" timestamp,
	"dismissed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "article_reading_state_one_article_check" CHECK (num_nonnulls("article_reading_state"."feed_item_id", "article_reading_state"."clip_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "reader_remember_position" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "article_reading_state" ADD CONSTRAINT "article_reading_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_reading_state" ADD CONSTRAINT "article_reading_state_feed_item_id_feed_items_id_fk" FOREIGN KEY ("feed_item_id") REFERENCES "public"."feed_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_reading_state" ADD CONSTRAINT "article_reading_state_clip_id_article_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."article_clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_reading_state_user_feed_item_unique" ON "article_reading_state" USING btree ("user_id","feed_item_id") WHERE "article_reading_state"."feed_item_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "article_reading_state_user_clip_unique" ON "article_reading_state" USING btree ("user_id","clip_id") WHERE "article_reading_state"."clip_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "article_reading_state_user_due_idx" ON "article_reading_state" USING btree ("user_id","due_at") WHERE "article_reading_state"."state" IN ('reading', 'resurfacing');