import { sql, type SQL } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
} from "../../packages/db/src";
import { feeds, feedItems } from "../../packages/db/src";
import { buildCategoryLabelsSql } from "../../apps/api/src/modules/articles/read/labels";

export type CategoryAuditFormat = "jsonl" | "summary";

export type CategoryAuditArgs = {
  days: number;
  limit: number;
  feedId: string | null;
  labelsFile: string | null;
  format: CategoryAuditFormat;
};

export type CategoryAuditItem = {
  feedItemId: string;
  title: string;
  url: string;
  canonicalUrl: string;
  publishedAt: string;
  feedId: string;
  feedTitle: string;
  feedUrl: string;
  explicitCategories: string[];
  keywordCategories: string[];
  embeddingCategories: string[];
};

export type CategoryAuditLabel = {
  feedItemId: string;
  expectedCategories: string[];
};

export type CategoryAuditMetrics = {
  labeledItems: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
};

export type CategoryAuditScoreReport = {
  labeledItems: number;
  missingItemIds: string[];
  keyword: CategoryAuditMetrics;
  embedding: CategoryAuditMetrics;
};

type CategoryAuditRow = {
  feed_item_id: string;
  title: string;
  url: string;
  canonical_url: string;
  published_at: Date | string;
  feed_id: string;
  feed_title: string;
  feed_url: string;
  explicit_categories: unknown;
  keyword_categories: unknown;
  embedding_categories: unknown;
};

type CategoryAuditDatabase = {
  execute: (query: SQL) => Promise<unknown> | unknown;
};

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

function formatFlag(argv: string[]): CategoryAuditFormat {
  const value = valueAfter(argv, "--format") ?? "jsonl";
  if (value !== "jsonl" && value !== "summary") {
    throw new Error(`Invalid --format value: ${value}`);
  }
  return value;
}

export function parseCategoryAuditArgs(argv: string[]): CategoryAuditArgs {
  return {
    days: positiveIntFlag(argv, "--days", 7),
    limit: positiveIntFlag(argv, "--limit", 100),
    feedId: valueAfter(argv, "--feed-id"),
    labelsFile: valueAfter(argv, "--labels-file"),
    format: formatFlag(argv),
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

function normalizeLabelList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function parsePublishedAt(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function explicitCategoryLabelsSql(): SQL<string[]> {
  return sql<string[]>`(
    SELECT COALESCE(array_agg(explicit_labels.label ORDER BY explicit_labels.label), ARRAY[]::text[])
    FROM (
      SELECT DISTINCT ${categories.label} AS label
      FROM ${feedItemCategoryAssignments}
      INNER JOIN ${categories} ON ${categories.id} = ${feedItemCategoryAssignments.categoryId}
      WHERE ${feedItemCategoryAssignments.feedItemId} = ${feedItems.id}
        AND ${feedItemCategoryAssignments.provenance} <> 'classifier'
      UNION
      SELECT DISTINCT ${categories.label} AS label
      FROM ${feedCategoryAssignments}
      INNER JOIN ${categories} ON ${categories.id} = ${feedCategoryAssignments.categoryId}
      WHERE ${feedCategoryAssignments.feedId} = ${feedItems.feedId}
        AND ${feedCategoryAssignments.provenance} <> 'classifier'
    ) AS explicit_labels
  )`;
}

function itemIdFilterSql(feedItemIds: readonly string[] | null): SQL | null {
  if (!feedItemIds || feedItemIds.length === 0) {
    return null;
  }
  return sql`${feedItems.id} IN (${sql.join(
    feedItemIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}

function toAuditItem(row: CategoryAuditRow): CategoryAuditItem {
  return {
    feedItemId: row.feed_item_id,
    title: row.title,
    url: row.url,
    canonicalUrl: row.canonical_url,
    publishedAt: parsePublishedAt(row.published_at),
    feedId: row.feed_id,
    feedTitle: row.feed_title,
    feedUrl: row.feed_url,
    explicitCategories: normalizeLabelList(row.explicit_categories),
    keywordCategories: normalizeLabelList(row.keyword_categories),
    embeddingCategories: normalizeLabelList(row.embedding_categories),
  };
}

export async function runCategoryAudit(
  args: CategoryAuditArgs,
  database: CategoryAuditDatabase,
  feedItemIds: readonly string[] | null = null,
): Promise<CategoryAuditItem[]> {
  if (feedItemIds && feedItemIds.length === 0) {
    return [];
  }

  const itemIdFilter = itemIdFilterSql(feedItemIds);
  const result = await database.execute(sql<CategoryAuditRow>`
    SELECT
      ${feedItems.id} AS feed_item_id,
      ${feedItems.title} AS title,
      ${feedItems.link} AS url,
      ${feedItems.canonicalUrl} AS canonical_url,
      ${feedItems.publishedAt} AS published_at,
      ${feeds.id} AS feed_id,
      ${feeds.title} AS feed_title,
      ${feeds.url} AS feed_url,
      ${explicitCategoryLabelsSql()} AS explicit_categories,
      ${buildCategoryLabelsSql("keyword")} AS keyword_categories,
      ${buildCategoryLabelsSql("embedding")} AS embedding_categories
    FROM ${feedItems}
    INNER JOIN ${feeds} ON ${feeds.id} = ${feedItems.feedId}
    WHERE ${
      itemIdFilter ??
      sql`${feedItems.publishedAt} >= now() - (${args.days}::int * interval '1 day')
      ${args.feedId ? sql`AND ${feedItems.feedId} = ${args.feedId}` : sql``}`
    }
    ORDER BY ${feedItems.publishedAt} DESC, ${feedItems.id} DESC
    ${itemIdFilter ? sql`` : sql`LIMIT ${args.limit}`}
  `);

  return rowsFromExecute<CategoryAuditRow>(result).map(toAuditItem);
}

function validateAuditLabelRecord(record: unknown, lineNumber: number): CategoryAuditLabel {
  if (!record || typeof record !== "object") {
    throw new Error(`Invalid labels JSONL line ${lineNumber}: expected object`);
  }
  const candidate = record as Partial<CategoryAuditLabel>;
  if (typeof candidate.feedItemId !== "string" || candidate.feedItemId.trim().length === 0) {
    throw new Error(`Invalid labels JSONL line ${lineNumber}: feedItemId is required`);
  }
  if (!Array.isArray(candidate.expectedCategories)) {
    throw new Error(`Invalid labels JSONL line ${lineNumber}: expectedCategories must be an array`);
  }
  return {
    feedItemId: candidate.feedItemId.trim(),
    expectedCategories: normalizeLabelList(candidate.expectedCategories),
  };
}

export function parseAuditLabelJsonl(text: string): CategoryAuditLabel[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(
          `Invalid labels JSONL line ${lineNumber}: ${error instanceof Error ? error.message : "malformed JSON"}`,
        );
      }
      const label = validateAuditLabelRecord(record, lineNumber);
      if (seen.has(label.feedItemId)) {
        throw new Error(
          `Invalid labels JSONL line ${lineNumber}: duplicate feedItemId ${label.feedItemId}`,
        );
      }
      seen.add(label.feedItemId);
      return label;
    });
}

export async function readAuditLabelsFile(path: string): Promise<CategoryAuditLabel[]> {
  return parseAuditLabelJsonl(await Bun.file(path).text());
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function metrics(
  truePositives: number,
  falsePositives: number,
  falseNegatives: number,
  labeledItems: number,
): CategoryAuditMetrics {
  const precision = percent(truePositives, truePositives + falsePositives);
  const recall = percent(truePositives, truePositives + falseNegatives);
  return {
    labeledItems,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
  };
}

function scoreClassifier(
  items: CategoryAuditItem[],
  expectedById: Map<string, string[]>,
  selectCategories: (item: CategoryAuditItem) => string[],
): CategoryAuditMetrics {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let labeledItems = 0;

  for (const item of items) {
    const expected = expectedById.get(item.feedItemId);
    if (!expected) {
      continue;
    }
    labeledItems += 1;
    const expectedSet = new Set(expected);
    const predictedSet = new Set(selectCategories(item));

    for (const predicted of predictedSet) {
      if (expectedSet.has(predicted)) {
        truePositives += 1;
      } else {
        falsePositives += 1;
      }
    }
    for (const expectedLabel of expectedSet) {
      if (!predictedSet.has(expectedLabel)) {
        falseNegatives += 1;
      }
    }
  }

  return metrics(truePositives, falsePositives, falseNegatives, labeledItems);
}

export function scoreCategoryAuditItems(
  items: CategoryAuditItem[],
  labels: CategoryAuditLabel[],
): CategoryAuditScoreReport {
  const expectedById = new Map(labels.map((label) => [label.feedItemId, label.expectedCategories]));
  const itemIds = new Set(items.map((item) => item.feedItemId));
  const missingItemIds = labels
    .map((label) => label.feedItemId)
    .filter((feedItemId) => !itemIds.has(feedItemId));

  return {
    labeledItems: labels.length - missingItemIds.length,
    missingItemIds,
    keyword: scoreClassifier(items, expectedById, (item) => item.keywordCategories),
    embedding: scoreClassifier(items, expectedById, (item) => item.embeddingCategories),
  };
}

function formatMetrics(metrics: CategoryAuditMetrics): string {
  return `P=${metrics.precision.toFixed(3)} R=${metrics.recall.toFixed(3)} F1=${metrics.f1.toFixed(3)} TP=${metrics.truePositives} FP=${metrics.falsePositives} FN=${metrics.falseNegatives}`;
}

export function summarizeCategoryAuditScore(report: CategoryAuditScoreReport): string {
  return (
    `CATEGORY AUDIT SCORE: scored ${report.labeledItems} labeled items; ` +
    `keyword ${formatMetrics(report.keyword)}; ` +
    `embedding ${formatMetrics(report.embedding)}; ` +
    `missing ${report.missingItemIds.length} labeled items.`
  );
}

export function summarizeCategoryAuditSample(
  items: CategoryAuditItem[],
  args: CategoryAuditArgs,
): string {
  const scope = args.feedId ? `feed ${args.feedId}` : "all feeds";
  return `CATEGORY AUDIT SAMPLE (${scope}, last ${args.days}d): ${items.length} items.`;
}

export function formatCategoryAuditOutput(
  items: CategoryAuditItem[],
  args: CategoryAuditArgs,
  scoreReport: CategoryAuditScoreReport | null = null,
): string {
  if (scoreReport) {
    return args.format === "jsonl"
      ? JSON.stringify({ type: "category_audit_score", ...scoreReport })
      : summarizeCategoryAuditScore(scoreReport);
  }
  if (args.format === "summary") {
    return summarizeCategoryAuditSample(items, args);
  }
  return items.map((item) => JSON.stringify(item)).join("\n");
}

if (import.meta.main) {
  const args = parseCategoryAuditArgs(process.argv);
  let labels: CategoryAuditLabel[] | null = null;
  const [{ db, pool }, { assertApiDatabaseReady }] = await Promise.all([
    import("../../apps/api/src/adapters/db/client"),
    import("../../apps/api/src/adapters/db/script-preflight"),
  ]);
  try {
    labels = args.labelsFile ? await readAuditLabelsFile(args.labelsFile) : null;
    await assertApiDatabaseReady({
      commandName: "categories:audit",
      ensureSchema: true,
    });
    const items = await runCategoryAudit(
      args,
      db,
      labels ? labels.map((label) => label.feedItemId) : null,
    );
    const scoreReport = labels ? scoreCategoryAuditItems(items, labels) : null;
    const output = formatCategoryAuditOutput(items, args, scoreReport);
    if (output.length > 0) {
      console.log(output);
    }
  } finally {
    await pool.end();
  }
}
