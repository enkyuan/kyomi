import { env } from "@config/env";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
  MISCELLANEOUS_CATEGORY_LABEL,
} from "@kyomi/db";
import { sql, type SQL } from "drizzle-orm";

export type CategoryClassifierReadMode = "keyword" | "embedding";

function itemCategorySourceRankSql(readMode: CategoryClassifierReadMode): SQL<number> {
  if (readMode === "embedding") {
    return sql<number>`CASE
      WHEN ${feedItemCategoryAssignments.provenance} <> 'classifier' THEN 0
      WHEN ${feedItemCategoryAssignments.classifierMethod} = 'embedding' THEN 1
      WHEN ${feedItemCategoryAssignments.classifierMethod} = 'keyword' THEN 2
      ELSE 99
    END`;
  }

  return sql<number>`CASE
    WHEN ${feedItemCategoryAssignments.provenance} <> 'classifier' THEN 0
    WHEN ${feedItemCategoryAssignments.classifierMethod} = 'keyword' THEN 1
    ELSE 99
  END`;
}

function feedCategorySourceRankSql(readMode: CategoryClassifierReadMode): SQL<number> {
  if (readMode === "embedding") {
    return sql<number>`CASE
      WHEN ${feedCategoryAssignments.provenance} <> 'classifier' THEN 3
      WHEN ${feedCategoryAssignments.classifierMethod} = 'embedding' THEN 4
      WHEN ${feedCategoryAssignments.classifierMethod} = 'keyword' THEN 5
      ELSE 99
    END`;
  }

  return sql<number>`CASE
    WHEN ${feedCategoryAssignments.provenance} <> 'classifier' THEN 2
    WHEN ${feedCategoryAssignments.classifierMethod} = 'keyword' THEN 3
    ELSE 99
  END`;
}

/**
 * Correlated subquery yielding up to two category labels per feed item, as a text[].
 * Item-level labels suppress feed-level fallbacks, and embedding mode treats keyword rows as
 * fallback rows instead of peer labels. The scalar subquery keeps article queries a single
 * round trip (no N+1).
 */
export function buildCategoryLabelsSql(readMode: CategoryClassifierReadMode): SQL<string[]> {
  const itemSourceRank = itemCategorySourceRankSql(readMode);
  const feedSourceRank = feedCategorySourceRankSql(readMode);
  const itemKeywordFallbackFilter =
    readMode === "embedding"
      ? sql`
    AND (
      raw_item_sources.classifier_method IS DISTINCT FROM 'keyword'
      OR NOT EXISTS (
        SELECT 1
        FROM raw_item_sources AS embedding_item_sources
        WHERE embedding_item_sources.classifier_method = 'embedding'
          AND (
            embedding_item_sources.assignment_provenance IS DISTINCT FROM 'classifier'
            OR embedding_item_sources.label <> ${MISCELLANEOUS_CATEGORY_LABEL}
          )
      )
    )`
      : sql``;
  const feedKeywordFallbackFilter =
    readMode === "embedding"
      ? sql`
    AND (
      raw_feed_sources.classifier_method IS DISTINCT FROM 'keyword'
      OR NOT EXISTS (
        SELECT 1
        FROM raw_feed_sources AS embedding_feed_sources
        WHERE embedding_feed_sources.classifier_method = 'embedding'
          AND (
            embedding_feed_sources.assignment_provenance IS DISTINCT FROM 'classifier'
            OR embedding_feed_sources.label <> ${MISCELLANEOUS_CATEGORY_LABEL}
          )
      )
    )`
      : sql``;

  return sql<string[]>`(
  WITH raw_item_sources AS (
    SELECT
      ${categories.label} AS label,
      ${categories.id} AS id,
      ${feedItemCategoryAssignments.confidence} AS confidence,
      ${feedItemCategoryAssignments.provenance} AS assignment_provenance,
      ${feedItemCategoryAssignments.classifierMethod} AS classifier_method,
      ${itemSourceRank} AS source_rank
    FROM ${feedItemCategoryAssignments}
    INNER JOIN ${categories} ON ${categories.id} = ${feedItemCategoryAssignments.categoryId}
    WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
  ),
  item_sources AS (
    SELECT
      raw_item_sources.label,
      raw_item_sources.id,
      raw_item_sources.confidence,
      raw_item_sources.source_rank
    FROM raw_item_sources
    WHERE raw_item_sources.source_rank < 99
      AND (
        raw_item_sources.assignment_provenance IS DISTINCT FROM 'classifier'
        OR raw_item_sources.label <> ${MISCELLANEOUS_CATEGORY_LABEL}
      )
      ${itemKeywordFallbackFilter}
  ),
  raw_feed_sources AS (
    SELECT
      ${categories.label} AS label,
      ${categories.id} AS id,
      ${feedCategoryAssignments.confidence} AS confidence,
      ${feedCategoryAssignments.provenance} AS assignment_provenance,
      ${feedCategoryAssignments.classifierMethod} AS classifier_method,
      ${feedSourceRank} AS source_rank
    FROM ${feedCategoryAssignments}
    INNER JOIN ${categories} ON ${categories.id} = ${feedCategoryAssignments.categoryId}
    WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
  ),
  feed_sources AS (
    SELECT
      raw_feed_sources.label,
      raw_feed_sources.id,
      raw_feed_sources.confidence,
      raw_feed_sources.source_rank
    FROM raw_feed_sources
    WHERE raw_feed_sources.source_rank < 99
      AND (
        raw_feed_sources.assignment_provenance IS DISTINCT FROM 'classifier'
        OR raw_feed_sources.label <> ${MISCELLANEOUS_CATEGORY_LABEL}
      )
      ${feedKeywordFallbackFilter}
      AND NOT EXISTS (SELECT 1 FROM item_sources)
  ),
  category_sources AS (
    SELECT * FROM item_sources
    UNION ALL
    SELECT * FROM feed_sources
  )
  SELECT COALESCE(array_agg(fc.label ORDER BY fc.source_rank, fc.confidence DESC NULLS LAST, fc.label, fc.id), ARRAY[]::text[])
  FROM (
    SELECT category_sources.label, category_sources.id, min(category_sources.source_rank) AS source_rank, max(category_sources.confidence) AS confidence
    FROM category_sources
    GROUP BY category_sources.label, category_sources.id
    ORDER BY source_rank, confidence DESC NULLS LAST, category_sources.label, category_sources.id
    LIMIT 2
  ) AS fc
)`;
}

export const categoryLabelsSql = buildCategoryLabelsSql(env.CATEGORY_CLASSIFIER_READ_MODE);
