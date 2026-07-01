CREATE INDEX IF NOT EXISTS "feeds_refresh_due_idx"
  ON "feeds" ("next_refresh_at", "id")
  WHERE "refresh_status" NOT IN ('running', 'queued');

CREATE INDEX IF NOT EXISTS "feeds_refresh_status_idx"
  ON "feeds" ("refresh_status", "id");

CREATE INDEX IF NOT EXISTS "feed_subscriptions_feed_id_idx"
  ON "feed_subscriptions" ("feed_id");

CREATE INDEX IF NOT EXISTS "feed_items_published_id_idx"
  ON "feed_items" ("published_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "feed_items_feed_published_id_idx"
  ON "feed_items" ("feed_id", "published_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "feed_item_user_state_saved_idx"
  ON "feed_item_user_state" ("user_id", "is_saved", "feed_item_id")
  WHERE "is_saved" IS TRUE;

CREATE INDEX IF NOT EXISTS "article_clips_user_saved_created_idx"
  ON "article_clips" ("user_id", "is_saved", "created_at" DESC, "id" DESC)
  WHERE "is_saved" IS TRUE;
