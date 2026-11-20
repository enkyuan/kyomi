ALTER TABLE "feeds" ADD COLUMN "catalog_preview" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "catalog_expires_at" timestamp;--> statement-breakpoint
CREATE INDEX "feed_items_catalog_expiry_idx" ON "feed_items" USING btree ("catalog_expires_at","id") WHERE "feed_items"."catalog_expires_at" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_feed_subscriber_count() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.feed_id = NEW.feed_id THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN
    UPDATE feeds SET subscriber_count = subscriber_count - 1 WHERE id = OLD.feed_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE feeds SET next_refresh_at = CASE WHEN subscriber_count = 0 AND catalog_preview
      THEN NOW() ELSE next_refresh_at END, subscriber_count = subscriber_count + 1 WHERE id = NEW.feed_id;
    UPDATE feed_items SET catalog_expires_at = NULL WHERE feed_id = NEW.feed_id AND catalog_expires_at IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;
