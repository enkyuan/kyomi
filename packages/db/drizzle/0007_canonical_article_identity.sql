CREATE OR REPLACE FUNCTION kyomi_normalize_article_url(raw_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text;
  without_hash text;
  base_no_query text;
  query text;
  scheme text;
  host text;
  suffix text;
  param text;
  param_key text;
  kept_params text[] := ARRAY[]::text[];
BEGIN
  trimmed := btrim(raw_url);
  without_hash := regexp_replace(trimmed, '#.*$', '');
  base_no_query := split_part(without_hash, '?', 1);

  scheme := substring(base_no_query from '^([A-Za-z][A-Za-z0-9+.-]*://)');
  host := substring(base_no_query from '^[A-Za-z][A-Za-z0-9+.-]*://([^/?#]+)');
  suffix := substring(base_no_query from '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]+(.*)$');
  IF scheme IS NOT NULL AND host IS NOT NULL THEN
    base_no_query := lower(scheme) || lower(host) || COALESCE(suffix, '');
  END IF;

  IF base_no_query !~ '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]+/$' THEN
    base_no_query := regexp_replace(base_no_query, '/$', '');
  END IF;

  query := substring(without_hash from '\?(.*)$');
  IF query IS NULL OR query = '' THEN
    RETURN base_no_query;
  END IF;

  FOREACH param IN ARRAY string_to_array(query, '&')
  LOOP
    param_key := lower(split_part(param, '=', 1));
    IF param_key NOT LIKE 'utm\_%' ESCAPE '\' AND param_key NOT IN ('fbclid', 'gclid', 'mc_cid') THEN
      kept_params := array_append(kept_params, param);
    END IF;
  END LOOP;

  IF array_length(kept_params, 1) IS NULL THEN
    RETURN base_no_query;
  END IF;

  RETURN base_no_query || '?' || array_to_string(kept_params, '&');
END;
$$;

ALTER TABLE "feed_items" ADD COLUMN IF NOT EXISTS "canonical_url" text;

UPDATE "feed_items"
SET "canonical_url" = kyomi_normalize_article_url("link")
WHERE "canonical_url" IS NULL;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY feed_id, canonical_url
      ORDER BY
        (
          CASE WHEN NULLIF(btrim(summary), '') IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN length(btrim(title)) >= 6 THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(btrim(content_text), '') IS NOT NULL THEN 3 ELSE 0 END +
          CASE WHEN NULLIF(btrim(content_html), '') IS NOT NULL THEN 2 ELSE 0 END
        ) DESC,
        published_at DESC,
        id DESC
    ) AS keep_id
  FROM "feed_items"
  WHERE canonical_url IS NOT NULL
),
state_rollup AS (
  SELECT
    s.user_id,
    r.keep_id AS feed_item_id,
    CASE
      WHEN bool_or(s.read_override IS FALSE) THEN false
      WHEN bool_or(s.read_override IS TRUE) THEN true
      ELSE NULL
    END AS read_override,
    bool_or(s.is_saved) AS is_saved,
    max(s.updated_at) AS updated_at
  FROM "feed_item_user_state" s
  JOIN ranked r ON r.id = s.feed_item_id
  GROUP BY s.user_id, r.keep_id
)
INSERT INTO "feed_item_user_state" ("user_id", "feed_item_id", "read_override", "is_saved", "updated_at")
SELECT user_id, feed_item_id, read_override, is_saved, updated_at
FROM state_rollup
ON CONFLICT ("user_id", "feed_item_id") DO UPDATE SET
  "read_override" = CASE
    WHEN "feed_item_user_state"."read_override" IS FALSE OR excluded."read_override" IS FALSE THEN false
    WHEN "feed_item_user_state"."read_override" IS TRUE OR excluded."read_override" IS TRUE THEN true
    ELSE NULL
  END,
  "is_saved" = "feed_item_user_state"."is_saved" OR excluded."is_saved",
  "updated_at" = GREATEST("feed_item_user_state"."updated_at", excluded."updated_at");

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY feed_id, canonical_url
      ORDER BY
        (
          CASE WHEN NULLIF(btrim(summary), '') IS NOT NULL THEN 2 ELSE 0 END +
          CASE WHEN length(btrim(title)) >= 6 THEN 1 ELSE 0 END +
          CASE WHEN NULLIF(btrim(content_text), '') IS NOT NULL THEN 3 ELSE 0 END +
          CASE WHEN NULLIF(btrim(content_html), '') IS NOT NULL THEN 2 ELSE 0 END
        ) DESC,
        published_at DESC,
        id DESC
    ) AS keep_id
  FROM "feed_items"
  WHERE canonical_url IS NOT NULL
)
DELETE FROM "feed_items"
USING ranked
WHERE "feed_items"."id" = ranked.id
  AND ranked.id <> ranked.keep_id;

ALTER TABLE "feed_items" ALTER COLUMN "canonical_url" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "feed_items_feed_id_canonical_url_unique"
  ON "feed_items" ("feed_id", "canonical_url");
DROP FUNCTION kyomi_normalize_article_url(text);
