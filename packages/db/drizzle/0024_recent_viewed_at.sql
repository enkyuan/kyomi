ALTER TABLE "feed_item_user_state"
  ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp;

ALTER TABLE "article_clips"
  ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp;

UPDATE "feed_item_user_state"
SET "last_viewed_at" = "updated_at"
WHERE "last_viewed_at" IS NULL AND "read_override" IS TRUE;

UPDATE "article_clips"
SET "last_viewed_at" = "updated_at"
WHERE "last_viewed_at" IS NULL AND "is_read" IS TRUE;

CREATE INDEX IF NOT EXISTS "feed_item_user_state_viewed_idx"
  ON "feed_item_user_state" ("user_id", "last_viewed_at" DESC, "feed_item_id" DESC)
  WHERE "last_viewed_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "article_clips_user_viewed_idx"
  ON "article_clips" ("user_id", "last_viewed_at" DESC, "id" DESC)
  WHERE "last_viewed_at" IS NOT NULL;
