UPDATE "user_preferences"
SET "reader_content_width" = 'wide'
WHERE "reader_content_width" = 'medium';

ALTER TABLE "user_preferences"
ALTER COLUMN "reader_content_width" SET DEFAULT 'wide';
