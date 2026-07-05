import { env } from "@config/env";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
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
 * Correlated subquery yielding up to two category labels per feed item, as a text[]. Ranks
 * explicit item labels first, then classifier item labels, then explicit feed labels, then
 * classifier feed fallbacks. The read mode controls whether the served classifier rows are
 * keyword-only or embedding-first with keyword fallback. The scalar subquery keeps article
 * queries a single round trip (no N+1).
 */
export function buildCategoryLabelsSql(readMode: CategoryClassifierReadMode): SQL<string[]> {
  const itemSourceRank = itemCategorySourceRankSql(readMode);
  const feedSourceRank = feedCategorySourceRankSql(readMode);

  return sql<string[]>`(
  SELECT COALESCE(array_agg(fc.label ORDER BY fc.source_rank, fc.confidence DESC NULLS LAST, fc.label, fc.id), ARRAY[]::text[])
  FROM (
    SELECT ${categories.label} AS label, ${categories.id} AS id, min(category_sources.source_rank) AS source_rank, max(category_sources.confidence) AS confidence
    FROM (
      SELECT
        ${feedItemCategoryAssignments.categoryId} AS category_id,
        ${feedItemCategoryAssignments.confidence} AS confidence,
        ${itemSourceRank} AS source_rank
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
      UNION ALL
      SELECT
        ${feedCategoryAssignments.categoryId} AS category_id,
        ${feedCategoryAssignments.confidence} AS confidence,
        ${feedSourceRank} AS source_rank
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
    ) AS category_sources
    INNER JOIN ${categories} ON ${categories.id} = category_sources.category_id
    WHERE category_sources.source_rank < 99
    GROUP BY ${categories.label}, ${categories.id}
    ORDER BY source_rank, confidence DESC NULLS LAST, ${categories.label}, ${categories.id}
    LIMIT 2
  ) AS fc
)`;
}

export const categoryLabelsSql = buildCategoryLabelsSql(env.CATEGORY_CLASSIFIER_READ_MODE);
