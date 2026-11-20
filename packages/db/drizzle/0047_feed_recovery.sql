CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
LOCK TABLE feed_subscriptions IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"source_key" text PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"etag" text,
	"last_modified" text,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
DROP INDEX "feeds_refresh_due_idx";--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "subscriber_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "feeds_subscribed_due_idx" ON "feeds" USING btree ("next_refresh_at" NULLS FIRST,"id") WHERE "feeds"."subscriber_count" > 0 AND "feeds"."refresh_status" NOT IN ('running', 'queued');--> statement-breakpoint
CREATE INDEX "feeds_catalog_due_idx" ON "feeds" USING btree ("next_refresh_at" NULLS FIRST,"id") WHERE "feeds"."subscriber_count" = 0 AND "feeds"."refresh_status" NOT IN ('running', 'queued');--> statement-breakpoint
CREATE INDEX "feeds_lease_idx" ON "feeds" USING btree ("refresh_status","updated_at") WHERE "feeds"."refresh_status" IN ('queued','running');--> statement-breakpoint
CREATE INDEX "feeds_title_search_idx" ON "feeds" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "feeds_url_search_idx" ON "feeds" USING gin ("url" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "feed_items_extraction_backfill_idx" ON "feed_items" USING btree ("created_at","id") WHERE "feed_items"."content_source" = 'link_only' AND "feed_items"."extracted_content_status" = 'pending' AND "feed_items"."extracted_content_updated_at" IS NULL;
--> statement-breakpoint
UPDATE feeds f SET subscriber_count = s.total
FROM (SELECT feed_id, count(*)::int AS total FROM feed_subscriptions GROUP BY feed_id) s
WHERE f.id = s.feed_id;
--> statement-breakpoint
CREATE FUNCTION update_feed_subscriber_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.feed_id = NEW.feed_id THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN
    UPDATE feeds SET subscriber_count = subscriber_count - 1 WHERE id = OLD.feed_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE feeds SET subscriber_count = subscriber_count + 1 WHERE id = NEW.feed_id;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER maintain_feed_subscriber_count AFTER INSERT OR DELETE OR UPDATE OF feed_id
ON feed_subscriptions FOR EACH ROW EXECUTE FUNCTION update_feed_subscriber_count();
