-- Postgres truncates identifiers past 63 bytes. The original feed-item classifier model index
-- name was 68 bytes, so local databases created it as
-- `feed_item_category_assignments_item_category_provenance_model_u`; the schema guard then
-- could never see the intended full name. Recreate it with a stable <=63-byte name.
DROP INDEX IF EXISTS "feed_item_category_assignments_item_category_provenance_model_u";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "feed_item_category_assignments_item_category_prov_model_unique" ON "feed_item_category_assignments" USING btree ("feed_item_id","category_id","provenance","model_id") WHERE model_id IS NOT NULL;
