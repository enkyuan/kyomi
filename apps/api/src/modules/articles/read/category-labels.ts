import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
} from "@kyomi/db";
import { sql } from "drizzle-orm";

/**
 * Correlated subquery yielding up to two category labels per feed item, as a text[]. Ranks
 * explicit item labels first, then classifier item labels, then explicit feed labels, then
 * classifier feed fallbacks, so deterministic inferred categories never hide a more specific
 * explicit source. The scalar subquery keeps article queries a single round trip (no N+1).
 */
export const feedCategoryLabelsSql = sql<string[]>`(
  SELECT COALESCE(array_agg(fc.label ORDER BY fc.source_rank, fc.label, fc.id), ARRAY[]::text[])
  FROM (
    SELECT ${categories.label} AS label, ${categories.id} AS id, min(category_sources.source_rank) AS source_rank
    FROM (
      SELECT
        ${feedItemCategoryAssignments.categoryId} AS category_id,
        CASE WHEN ${feedItemCategoryAssignments.provenance} = 'classifier' THEN 1 ELSE 0 END AS source_rank
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
      UNION ALL
      SELECT
        ${feedCategoryAssignments.categoryId} AS category_id,
        CASE WHEN ${feedCategoryAssignments.provenance} = 'classifier' THEN 3 ELSE 2 END AS source_rank
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
    ) AS category_sources
    INNER JOIN ${categories} ON ${categories.id} = category_sources.category_id
    GROUP BY ${categories.label}, ${categories.id}
    ORDER BY source_rank, ${categories.label}, ${categories.id}
    LIMIT 2
  ) AS fc
)`;
