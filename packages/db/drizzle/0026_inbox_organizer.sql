ALTER TABLE "feed_item_user_state" ADD COLUMN "saved_at" timestamp;
ALTER TABLE "article_clips" ADD COLUMN "saved_at" timestamp;

UPDATE "feed_item_user_state"
SET "saved_at" = "updated_at"
WHERE "is_saved" IS TRUE AND "saved_at" IS NULL;

UPDATE "article_clips"
SET "saved_at" = "created_at"
WHERE "is_saved" IS TRUE AND "saved_at" IS NULL;

CREATE INDEX "feed_item_user_state_saved_at_idx"
  ON "feed_item_user_state" ("user_id", "saved_at" ASC, "feed_item_id")
  WHERE "is_saved" IS TRUE AND "saved_at" IS NOT NULL;

CREATE INDEX "article_clips_user_saved_at_idx"
  ON "article_clips" ("user_id", "saved_at" ASC, "id")
  WHERE "is_saved" IS TRUE AND "saved_at" IS NOT NULL;

CREATE TABLE "article_view_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "feed_item_id" text,
  "clip_id" text,
  "feed_id" text,
  "article_type" text NOT NULL,
  "is_first_view" boolean DEFAULT false NOT NULL,
  "viewed_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "article_view_events"
  ADD CONSTRAINT "article_view_events_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "article_view_events"
  ADD CONSTRAINT "article_view_events_feed_item_id_feed_items_id_fk"
  FOREIGN KEY ("feed_item_id") REFERENCES "feed_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "article_view_events"
  ADD CONSTRAINT "article_view_events_clip_id_article_clips_id_fk"
  FOREIGN KEY ("clip_id") REFERENCES "article_clips"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "article_view_events"
  ADD CONSTRAINT "article_view_events_feed_id_feeds_id_fk"
  FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "article_view_events_user_viewed_idx"
  ON "article_view_events" ("user_id", "viewed_at" DESC, "id" DESC);

CREATE INDEX "article_view_events_user_feed_viewed_idx"
  ON "article_view_events" ("user_id", "feed_id", "viewed_at" DESC)
  WHERE "feed_id" IS NOT NULL;

CREATE TABLE "feed_user_stats" (
  "user_id" text NOT NULL,
  "feed_id" text NOT NULL,
  "viewed_item_count" integer DEFAULT 0 NOT NULL,
  "last_viewed_at" timestamp NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "feed_user_stats_user_id_feed_id_pk" PRIMARY KEY ("user_id", "feed_id")
);

ALTER TABLE "feed_user_stats"
  ADD CONSTRAINT "feed_user_stats_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "feed_user_stats"
  ADD CONSTRAINT "feed_user_stats_feed_id_feeds_id_fk"
  FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "feed_user_stats_user_rank_idx"
  ON "feed_user_stats" ("user_id", "viewed_item_count" DESC, "last_viewed_at" DESC, "feed_id");

INSERT INTO "feed_user_stats" (
  "user_id",
  "feed_id",
  "viewed_item_count",
  "last_viewed_at",
  "updated_at"
)
SELECT
  fus."user_id",
  fi."feed_id",
  count(*)::int AS "viewed_item_count",
  max(fus."last_viewed_at") AS "last_viewed_at",
  now() AS "updated_at"
FROM "feed_item_user_state" fus
INNER JOIN "feed_items" fi ON fi."id" = fus."feed_item_id"
WHERE fus."last_viewed_at" IS NOT NULL
GROUP BY fus."user_id", fi."feed_id"
ON CONFLICT ("user_id", "feed_id") DO UPDATE SET
  "viewed_item_count" = excluded."viewed_item_count",
  "last_viewed_at" = excluded."last_viewed_at",
  "updated_at" = excluded."updated_at";
