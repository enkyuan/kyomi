ALTER TABLE "feed_category_assignments" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "feed_category_assignments" ADD COLUMN "taxonomy_version" text;--> statement-breakpoint
ALTER TABLE "feed_item_category_assignments" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "feed_item_category_assignments" ADD COLUMN "taxonomy_version" text;--> statement-breakpoint
-- Backfill: any existing classifier row was produced by the keyword classifier against
-- the v1 taxonomy; stamp it so a future re-classify pass (e.g. when the embedding
-- classifier rolls in) knows which rows are stale vs already-current-model. The
-- `model_id IS NULL` guard makes this safe to re-run without stomping newer generations.
UPDATE "feed_category_assignments"
  SET "model_id" = 'keyword-v1', "taxonomy_version" = 'v1'
  WHERE "provenance" = 'classifier' AND "model_id" IS NULL;--> statement-breakpoint
UPDATE "feed_item_category_assignments"
  SET "model_id" = 'keyword-v1', "taxonomy_version" = 'v1'
  WHERE "provenance" = 'classifier' AND "model_id" IS NULL;