ALTER TABLE "feed_item_user_state" ADD COLUMN "hidden_at" timestamp;

CREATE INDEX "feed_item_user_state_hidden_idx"
  ON "feed_item_user_state" ("user_id", "hidden_at", "feed_item_id")
  WHERE "hidden_at" IS NOT NULL;

CREATE TABLE "article_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "article_id" text NOT NULL,
  "article_type" text NOT NULL,
  "feed_item_id" text,
  "clip_id" text,
  "reason" text NOT NULL,
  "details" text,
  "article_title" text NOT NULL,
  "article_url" text NOT NULL,
  "feed_title" text,
  "feed_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_feed_item_id_feed_items_id_fk"
  FOREIGN KEY ("feed_item_id") REFERENCES "feed_items"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "article_reports"
  ADD CONSTRAINT "article_reports_clip_id_article_clips_id_fk"
  FOREIGN KEY ("clip_id") REFERENCES "article_clips"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "article_reports_user_created_idx"
  ON "article_reports" ("user_id", "created_at" DESC);

CREATE INDEX "article_reports_article_created_idx"
  ON "article_reports" ("article_id", "created_at" DESC);
