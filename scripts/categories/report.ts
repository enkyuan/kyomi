import { sql } from "drizzle-orm";
import { feedCategoryAssignments, feedItemCategoryAssignments, feedItems } from "@kyomi/db";
import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { EMBEDDING_CLASSIFIER_METHOD, KEYWORD_CLASSIFIER_METHOD } from "@kyomi/worker";

export type CategoryCoverageArgs = {
  days: number;
  feedId: string | null;
};

export type CategoryCoverageReport = CategoryCoverageArgs & {
  eligibleItems: number;
  itemsWithExplicitLabels: number;
  itemsWithEmbedding: number;
  itemsWithEmbeddingItem: number;
  itemsWithEmbeddingFeed: number;
  keywordFallbackItems: number;
  unclassifiedItems: number;
  embeddingCoveragePercent: number;
  keywordFallbackPercent: number;
};

type CategoryCoverageRow = {
  eligible_items: number;
  items_with_explicit_labels: number;
  items_with_embedding: number;
  items_with_embedding_item: number;
  items_with_embedding_feed: number;
  keyword_fallback_items: number;
  unclassified_items: number;
};

type CategoryCoverageDatabase = Pick<typeof db, "execute">;

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function positiveIntFlag(argv: string[], flag: string, fallback: number): number {
  const value = valueAfter(argv, flag);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value: ${value}`);
  }
  return parsed;
}

export function parseCategoryCoverageArgs(argv: string[]): CategoryCoverageArgs {
  return {
    days: positiveIntFlag(argv, "--days", 7),
    feedId: valueAfter(argv, "--feed-id"),
  };
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

function toInt(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function buildCategoryCoverageReport(
  args: CategoryCoverageArgs,
  row: Partial<CategoryCoverageRow> | null | undefined,
): CategoryCoverageReport {
  const eligibleItems = toInt(row?.eligible_items);
  const itemsWithEmbedding = toInt(row?.items_with_embedding);
  const keywordFallbackItems = toInt(row?.keyword_fallback_items);

  return {
    days: args.days,
    feedId: args.feedId,
    eligibleItems,
    itemsWithExplicitLabels: toInt(row?.items_with_explicit_labels),
    itemsWithEmbedding,
    itemsWithEmbeddingItem: toInt(row?.items_with_embedding_item),
    itemsWithEmbeddingFeed: toInt(row?.items_with_embedding_feed),
    keywordFallbackItems,
    unclassifiedItems: toInt(row?.unclassified_items),
    embeddingCoveragePercent: percent(itemsWithEmbedding, eligibleItems),
    keywordFallbackPercent: percent(keywordFallbackItems, eligibleItems),
  };
}

export function summarizeCategoryCoverageReport(report: CategoryCoverageReport): string {
  const scope = report.feedId ? `feed ${report.feedId}` : "all feeds";
  return (
    `CATEGORY COVERAGE (${scope}, last ${report.days}d): ${report.eligibleItems} recent items; ` +
    `embedding coverage ${report.embeddingCoveragePercent.toFixed(2)}% ` +
    `(${report.itemsWithEmbedding} items: ${report.itemsWithEmbeddingItem} item-level, ` +
    `${report.itemsWithEmbeddingFeed} feed-level); ` +
    `keyword fallback ${report.keywordFallbackPercent.toFixed(2)}% ` +
    `(${report.keywordFallbackItems} items); ` +
    `explicit labels present on ${report.itemsWithExplicitLabels} items; ` +
    `unclassified ${report.unclassifiedItems} items.`
  );
}

export async function runCategoryCoverageReport(
  args: CategoryCoverageArgs,
  database: CategoryCoverageDatabase = db,
): Promise<CategoryCoverageReport> {
  const result = await database.execute(sql<CategoryCoverageRow>`
    WITH recent_items AS (
      SELECT ${feedItems.id} AS id, ${feedItems.feedId} AS feed_id
      FROM ${feedItems}
      WHERE ${feedItems.publishedAt} >= now() - (${args.days}::int * interval '1 day')
      ${args.feedId ? sql`AND ${feedItems.feedId} = ${args.feedId}` : sql``}
    ),
    item_embedding AS (
      SELECT DISTINCT ${feedItemCategoryAssignments.feedItemId} AS feed_item_id
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.provenance} = 'classifier'
        AND ${feedItemCategoryAssignments.classifierMethod} = ${EMBEDDING_CLASSIFIER_METHOD}
    ),
    feed_embedding AS (
      SELECT DISTINCT ${feedCategoryAssignments.feedId} AS feed_id
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.provenance} = 'classifier'
        AND ${feedCategoryAssignments.classifierMethod} = ${EMBEDDING_CLASSIFIER_METHOD}
    ),
    item_keyword AS (
      SELECT DISTINCT ${feedItemCategoryAssignments.feedItemId} AS feed_item_id
      FROM ${feedItemCategoryAssignments}
      WHERE ${feedItemCategoryAssignments.provenance} = 'classifier'
        AND ${feedItemCategoryAssignments.classifierMethod} = ${KEYWORD_CLASSIFIER_METHOD}
    ),
    feed_keyword AS (
      SELECT DISTINCT ${feedCategoryAssignments.feedId} AS feed_id
      FROM ${feedCategoryAssignments}
      WHERE ${feedCategoryAssignments.provenance} = 'classifier'
        AND ${feedCategoryAssignments.classifierMethod} = ${KEYWORD_CLASSIFIER_METHOD}
    ),
    explicit_labels AS (
      SELECT DISTINCT recent_items.id AS feed_item_id
      FROM recent_items
      LEFT JOIN ${feedItemCategoryAssignments}
        ON ${feedItemCategoryAssignments.feedItemId} = recent_items.id
       AND ${feedItemCategoryAssignments.provenance} <> 'classifier'
      LEFT JOIN ${feedCategoryAssignments}
        ON ${feedCategoryAssignments.feedId} = recent_items.feed_id
       AND ${feedCategoryAssignments.provenance} <> 'classifier'
      WHERE ${feedItemCategoryAssignments.feedItemId} IS NOT NULL
         OR ${feedCategoryAssignments.feedId} IS NOT NULL
    )
    SELECT
      count(*)::int AS eligible_items,
      count(*) FILTER (WHERE explicit_labels.feed_item_id IS NOT NULL)::int AS items_with_explicit_labels,
      count(*) FILTER (
        WHERE item_embedding.feed_item_id IS NOT NULL OR feed_embedding.feed_id IS NOT NULL
      )::int AS items_with_embedding,
      count(*) FILTER (WHERE item_embedding.feed_item_id IS NOT NULL)::int AS items_with_embedding_item,
      count(*) FILTER (WHERE feed_embedding.feed_id IS NOT NULL)::int AS items_with_embedding_feed,
      count(*) FILTER (
        WHERE item_embedding.feed_item_id IS NULL
          AND feed_embedding.feed_id IS NULL
          AND (item_keyword.feed_item_id IS NOT NULL OR feed_keyword.feed_id IS NOT NULL)
      )::int AS keyword_fallback_items,
      count(*) FILTER (
        WHERE item_embedding.feed_item_id IS NULL
          AND feed_embedding.feed_id IS NULL
          AND item_keyword.feed_item_id IS NULL
          AND feed_keyword.feed_id IS NULL
          AND explicit_labels.feed_item_id IS NULL
      )::int AS unclassified_items
    FROM recent_items
    LEFT JOIN item_embedding ON item_embedding.feed_item_id = recent_items.id
    LEFT JOIN feed_embedding ON feed_embedding.feed_id = recent_items.feed_id
    LEFT JOIN item_keyword ON item_keyword.feed_item_id = recent_items.id
    LEFT JOIN feed_keyword ON feed_keyword.feed_id = recent_items.feed_id
    LEFT JOIN explicit_labels ON explicit_labels.feed_item_id = recent_items.id
  `);

  return buildCategoryCoverageReport(args, rowsFromExecute<CategoryCoverageRow>(result)[0]);
}

if (import.meta.main) {
  const args = parseCategoryCoverageArgs(process.argv);
  try {
    await assertApiDatabaseReady({
      commandName: "categories:report",
      ensureSchema: true,
    });
    const report = await runCategoryCoverageReport(args);
    console.log(summarizeCategoryCoverageReport(report));
  } finally {
    await pool.end();
  }
}
