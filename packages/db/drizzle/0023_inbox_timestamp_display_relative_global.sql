ALTER TABLE "user_preferences"
  ALTER COLUMN "inbox_timestamp_display" SET DEFAULT 'relative';

UPDATE "user_preferences"
SET
  "inbox_timestamp_display" = 'relative',
  "updated_at" = NOW()
WHERE "inbox_timestamp_display" = 'absolute';
