-- Splits the single classifier-assignment unique index into two PARTIAL indexes so keyword
-- and embedding classifier rows can coexist for the same (feed/item, category) slot without
-- either (a) throwing "no unique or exclusion constraint matching the ON CONFLICT
-- specification" when the app's onConflictDoUpdate target doesn't match a real constraint, or
-- (b) silently duplicating explicit-provenance rows, since Postgres treats every NULL as
-- distinct in a plain (non-partial) unique index and explicit rows always have model_id NULL.
-- The `model_id IS NULL` index preserves the original 3-column dedupe behavior for explicit
-- rows exactly; the `model_id IS NOT NULL` index lets each classifier hold one row per
-- (feed/item, category) independent of any other classifier's row.
DROP INDEX "feed_category_assignments_feed_category_provenance_unique";--> statement-breakpoint
DROP INDEX "feed_item_category_assignments_item_category_provenance_unique";--> statement-breakpoint
ALTER TABLE "feed_category_assignments" ADD COLUMN "classifier_method" text;--> statement-breakpoint
ALTER TABLE "feed_item_category_assignments" ADD COLUMN "classifier_method" text;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_category_assignments_feed_category_provenance_model_unique" ON "feed_category_assignments" USING btree ("feed_id","category_id","provenance","model_id") WHERE model_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_category_assignments_item_category_prov_model_unique" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance","model_id") WHERE model_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_category_assignments_feed_category_provenance_unique" ON "feed_category_assignments" USING btree ("feed_id","category_id","provenance") WHERE model_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "feed_item_category_assignments_item_category_provenance_unique" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance") WHERE model_id IS NULL;--> statement-breakpoint
UPDATE "feed_category_assignments" SET "classifier_method" = 'keyword' WHERE "provenance" = 'classifier' AND "classifier_method" IS NULL;--> statement-breakpoint
UPDATE "feed_item_category_assignments" SET "classifier_method" = 'keyword' WHERE "provenance" = 'classifier' AND "classifier_method" IS NULL;
