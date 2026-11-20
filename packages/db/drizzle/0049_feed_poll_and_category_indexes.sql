DROP INDEX "feeds_subscribed_due_idx";--> statement-breakpoint
DROP INDEX "feeds_catalog_due_idx";--> statement-breakpoint
CREATE INDEX "feeds_subscribed_poll_idx" ON "feeds" USING btree (coalesce("next_refresh_at", '-infinity'::timestamp),"id") WHERE "feeds"."subscriber_count" > 0 AND "feeds"."refresh_status" NOT IN ('running', 'queued');--> statement-breakpoint
CREATE INDEX "feeds_catalog_poll_idx" ON "feeds" USING btree (coalesce("next_refresh_at", '-infinity'::timestamp),"id") WHERE "feeds"."subscriber_count" = 0 AND "feeds"."refresh_status" NOT IN ('running', 'queued');--> statement-breakpoint
CREATE INDEX "feed_category_assignments_feed_provenance_idx" ON "feed_category_assignments" USING btree ("feed_id","provenance");--> statement-breakpoint
CREATE INDEX "feed_item_category_assignments_item_provenance_idx" ON "feed_item_category_assignments" USING btree ("feed_item_id","provenance");