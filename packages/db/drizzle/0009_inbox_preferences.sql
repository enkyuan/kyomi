ALTER TABLE "user_preferences"
  ADD COLUMN "inbox_default_view" text DEFAULT 'today' NOT NULL,
  ADD COLUMN "inbox_mark_read_behavior" text DEFAULT 'on-open' NOT NULL,
  ADD COLUMN "inbox_timestamp_display" text DEFAULT 'absolute' NOT NULL,
  ADD COLUMN "inbox_timestamp_hour_cycle" text DEFAULT '12h' NOT NULL,
  ADD COLUMN "inbox_show_recents" boolean DEFAULT false NOT NULL;

UPDATE "user_preferences"
SET
  "inbox_density" = COALESCE("inbox_density", 'comfortable'),
  "article_open_behavior" = COALESCE("article_open_behavior", 'split')
WHERE "inbox_density" IS NULL OR "article_open_behavior" IS NULL;

ALTER TABLE "user_preferences"
  ALTER COLUMN "inbox_density" SET DEFAULT 'comfortable',
  ALTER COLUMN "inbox_density" SET NOT NULL,
  ALTER COLUMN "article_open_behavior" SET DEFAULT 'split',
  ALTER COLUMN "article_open_behavior" SET NOT NULL;
