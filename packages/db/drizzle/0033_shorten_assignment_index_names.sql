-- Keep assignment unique-index identifiers comfortably below Postgres's 63-byte identifier
-- limit. The previous descriptive names were readable, but several lived close to the cap
-- or had already been truncated in local databases.
CREATE UNIQUE INDEX IF NOT EXISTS "fitag_item_slug_prov_uidx" ON "feed_item_tag_assignments" USING btree ("feed_item_id","slug","provenance");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fcat_feed_cat_prov_uidx" ON "feed_category_assignments" USING btree ("feed_id","category_id","provenance") WHERE model_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fcat_feed_cat_prov_model_uidx" ON "feed_category_assignments" USING btree ("feed_id","category_id","provenance","model_id") WHERE model_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ficat_item_cat_prov_uidx" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance") WHERE model_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ficat_item_cat_prov_model_uidx" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance","model_id") WHERE model_id IS NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "feed_item_tag_assignments_item_slug_provenance_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_category_assignments_feed_category_provenance_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_category_assignments_feed_category_provenance_model_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_item_category_assignments_item_category_prov_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_item_category_assignments_item_category_prov_model_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_item_category_assignments_item_category_provenance_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_item_category_assignments_item_category_provenance_model_u";
