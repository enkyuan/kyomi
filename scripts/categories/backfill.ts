import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  categories,
  feedCategoryBackfillStatus,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  feedItems,
  feeds,
  mapCategoryLabelToCanonical,
  toCategorySlug,
} from "../../packages/db/src";
import { db, pool } from "../../apps/api/src/adapters/db/client";
import { assertApiDatabaseReady } from "../../apps/api/src/adapters/db/script-preflight";
import {
  canonicalWinsOnConflictSql,
  classifyFeedCategories,
  classifyFeedEmbedding,
  classifyItemCategories,
  classifyItemEmbedding,
  embeddingModelInfo,
  shouldSuppressFallback,
  syncInferredFeedCategories,
  CATEGORY_CLASSIFIER_PROVENANCE,
  CLASSIFIER_TAXONOMY_VERSION,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  MAX_CLASSIFIER_LABELS,
  type ClassifierModelInfo,
  type EmbeddingClassifierConfig,
  type InferredCategoryLabel,
} from "../../packages/worker/src";

const BACKFILL_CLASSIFIER_MODEL: ClassifierModelInfo = {
  modelId: KEYWORD_CLASSIFIER_MODEL_ID,
  taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
  classifierMethod: KEYWORD_CLASSIFIER_METHOD,
};
const DEFAULT_FEED_LIMIT = 500;
const DEFAULT_FEED_BATCH_SIZE = 1000;
const BACKFILL_STATUS_PROCESSED = "processed";
const BACKFILL_STATUS_FAILED = "failed";
const BACKFILL_PROGRESS_INTERVAL = 10_000;

export type BackfillClassifierMethod = "keyword" | "embedding";

type BackfillClassifier =
  | {
      method: "keyword";
      model: ClassifierModelInfo;
    }
  | {
      method: "embedding";
      model: ClassifierModelInfo;
      embeddingConfig: EmbeddingClassifierConfig;
    };

export type BackfillArgs = {
  apply: boolean;
  all: boolean;
  limit: number;
  batchSize: number;
  itemLimit: number | null;
  feedId: string | null;
  classifier: BackfillClassifierMethod;
  recentDays: number | null;
  normalizeExisting: boolean;
  retryFailed: boolean;
};

export type BackfillStats = {
  apply: boolean;
  classifierMethod: BackfillClassifierMethod;
  classifierModelId: string;
  feedsScanned: number;
  feedsWithClassifierCategories: number;
  feedClassifierFallbacksSuppressed: number;
  feedsFailed: number;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
  itemClassifierAbstentions: number;
  feedBackfillStatusesRecorded: number;
  normalizedExistingAssignments: boolean;
  assignmentsScanned: number;
  assignmentsRewritten: number;
  assignmentsDroppedUnmapped: number;
  itemEmbeddingFailures: number;
};

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function positiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalPositiveIntFlag(argv: string[], flag: string): number | null {
  const value = valueAfter(argv, flag);
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // Unlike a missing flag (which intentionally means "no limit"), a present-but-invalid
    // value must not silently fall back to the same "no limit" behavior — that would make
    // a typo indistinguishable from an explicit unbounded --apply run.
    throw new Error(`Invalid ${flag} value: ${value}`);
  }
  return parsed;
}

function parseBackfillClassifier(argv: string[]): BackfillClassifierMethod {
  const value = valueAfter(argv, "--classifier");
  const shorthand = argv.includes("--embedding");
  if (shorthand && value && value !== "embedding") {
    throw new Error("--embedding cannot be combined with --classifier keyword");
  }
  if (shorthand) {
    return "embedding";
  }
  if (!value) {
    return "keyword";
  }
  if (value === "keyword" || value === "embedding") {
    return value;
  }
  throw new Error(`Invalid --classifier value: ${value}`);
}

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  const all = argv.includes("--all");
  const itemLimit = optionalPositiveIntFlag(argv, "--item-limit");
  const recentDays = optionalPositiveIntFlag(argv, "--recent-days");
  if (all && itemLimit !== null) {
    throw new Error(
      "--all cannot be combined with --item-limit; coverage requires full item scans",
    );
  }
  if (all && recentDays !== null) {
    throw new Error(
      "--all cannot be combined with --recent-days; coverage requires full item scans",
    );
  }
  return {
    apply: argv.includes("--apply"),
    all,
    limit: positiveInt(valueAfter(argv, "--limit"), DEFAULT_FEED_LIMIT),
    batchSize: positiveInt(valueAfter(argv, "--batch-size"), DEFAULT_FEED_BATCH_SIZE),
    itemLimit,
    feedId: valueAfter(argv, "--feed-id"),
    classifier: parseBackfillClassifier(argv),
    recentDays,
    normalizeExisting: argv.includes("--normalize-existing"),
    retryFailed: argv.includes("--retry-failed"),
  };
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function summarizeBackfill(stats: BackfillStats): string {
  const action = stats.apply ? "APPLIED" : "DRY RUN";
  const verb = stats.apply ? "wrote" : "would write";
  const assignmentVerb = stats.apply ? "rewrote" : "would rewrite";
  const coverageVerb = stats.apply ? "wrote" : "would write";
  const assignmentSummary = stats.normalizedExistingAssignments
    ? `${assignmentVerb} ${stats.assignmentsRewritten} of ${stats.assignmentsScanned} existing assignments to canonical categories and dropped ${stats.assignmentsDroppedUnmapped} unmapped assignments.`
    : "Skipped existing assignment normalization.";
  return (
    `${action} (${stats.classifierMethod}/${stats.classifierModelId}): scanned ${stats.feedsScanned} feeds and ${stats.itemsScanned} items; ${verb} classifier categories for ${stats.feedsWithClassifierCategories} feeds and ${stats.itemsWithClassifierCategories} items. ` +
    `${assignmentSummary} ` +
    `Suppressed classifier feed fallback for ${stats.feedClassifierFallbacksSuppressed} broad feeds; item classifier abstained on ${stats.itemClassifierAbstentions} items. ` +
    `${coverageVerb} coverage status for ${pluralize(stats.feedBackfillStatusesRecorded, "feed")}; ${pluralize(stats.feedsFailed, "feed")} failed.`
  );
}

function loadFeeds(args: BackfillArgs) {
  const columns = {
    id: feeds.id,
    title: feeds.title,
    description: feeds.description,
    url: feeds.url,
    link: feeds.link,
    sourceKind: feeds.sourceKind,
  };

  if (args.recentDays) {
    const recentFeedItems = db
      .select({
        feedId: feedItems.feedId,
        latestPublishedAt: sql<Date>`max(${feedItems.publishedAt})`.as("latest_published_at"),
      })
      .from(feedItems)
      .where(sql`${feedItems.publishedAt} >= now() - (${args.recentDays}::int * interval '1 day')`)
      .groupBy(feedItems.feedId)
      .as("recent_feed_items");

    if (args.feedId) {
      return db
        .select(columns)
        .from(feeds)
        .innerJoin(recentFeedItems, eq(feeds.id, recentFeedItems.feedId))
        .where(eq(feeds.id, args.feedId))
        .orderBy(desc(recentFeedItems.latestPublishedAt), feeds.id)
        .limit(args.limit);
    }

    return db
      .select(columns)
      .from(feeds)
      .innerJoin(recentFeedItems, eq(feeds.id, recentFeedItems.feedId))
      .orderBy(desc(recentFeedItems.latestPublishedAt), feeds.id)
      .limit(args.limit);
  }

  if (!args.feedId) {
    return db.select(columns).from(feeds).orderBy(feeds.id).limit(args.limit);
  }

  return db
    .select(columns)
    .from(feeds)
    .where(eq(feeds.id, args.feedId))
    .orderBy(feeds.id)
    .limit(args.limit);
}

function loadUncoveredFeedsPage(
  args: BackfillArgs,
  classifier: BackfillClassifier,
  cursorFeedId: string | null,
) {
  const columns = {
    id: feeds.id,
    title: feeds.title,
    description: feeds.description,
    url: feeds.url,
    link: feeds.link,
    sourceKind: feeds.sourceKind,
  };
  const statusJoin = and(
    eq(feedCategoryBackfillStatus.feedId, feeds.id),
    eq(feedCategoryBackfillStatus.classifierMethod, classifier.model.classifierMethod),
    eq(feedCategoryBackfillStatus.modelId, classifier.model.modelId),
    eq(feedCategoryBackfillStatus.taxonomyVersion, classifier.model.taxonomyVersion),
  );
  const statusFilter = args.retryFailed
    ? or(
        isNull(feedCategoryBackfillStatus.feedId),
        eq(feedCategoryBackfillStatus.status, BACKFILL_STATUS_FAILED),
      )
    : isNull(feedCategoryBackfillStatus.feedId);
  const whereClause = cursorFeedId ? and(gt(feeds.id, cursorFeedId), statusFilter) : statusFilter;

  return db
    .select(columns)
    .from(feeds)
    .leftJoin(feedCategoryBackfillStatus, statusJoin)
    .where(whereClause)
    .orderBy(feeds.id)
    .limit(args.batchSize);
}

function loadNextFeedBatch(
  args: BackfillArgs,
  classifier: BackfillClassifier,
  cursorFeedId: string | null,
) {
  if (args.all && !args.feedId) {
    return loadUncoveredFeedsPage(args, classifier, cursorFeedId);
  }
  return loadFeeds(args);
}

const ITEM_BACKFILL_BATCH_SIZE = 500;

function loadItemsPage(feedId: string, limit: number, offset: number, recentDays: number | null) {
  const feedFilter = eq(feedItems.feedId, feedId);
  const whereClause = recentDays
    ? and(
        feedFilter,
        sql`${feedItems.publishedAt} >= now() - (${recentDays}::int * interval '1 day')`,
      )
    : feedFilter;

  return db
    .select({
      id: feedItems.id,
      title: feedItems.title,
      summary: feedItems.summary,
      contentText: feedItems.contentText,
      link: feedItems.link,
      canonicalUrl: feedItems.canonicalUrl,
    })
    .from(feedItems)
    .where(whereClause)
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(limit)
    .offset(offset);
}

function loadItemsForFeeds(feedIds: string[]) {
  if (feedIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: feedItems.id,
      feedId: feedItems.feedId,
      title: feedItems.title,
      summary: feedItems.summary,
      contentText: feedItems.contentText,
      link: feedItems.link,
      canonicalUrl: feedItems.canonicalUrl,
    })
    .from(feedItems)
    .where(inArray(feedItems.feedId, feedIds))
    .orderBy(feedItems.feedId, desc(feedItems.publishedAt), desc(feedItems.id));
}

type AssignmentRewritePlan = {
  scanned: number;
  rewritten: number;
  droppedUnmapped: number;
};

async function resolveCanonicalCategoryId(
  cache: Map<string, string>,
  canonicalLabel: string,
  now: Date,
): Promise<string> {
  const cached = cache.get(canonicalLabel);
  if (cached) {
    return cached;
  }
  const slug = toCategorySlug(canonicalLabel);
  const [upserted] = await db
    .insert(categories)
    .values({
      id: crypto.randomUUID(),
      slug,
      label: canonicalLabel,
      provenance: "feed",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
        provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
        updatedAt: now,
      },
    })
    .returning({ id: categories.id });
  const categoryId = upserted!.id;
  cache.set(canonicalLabel, categoryId);
  return categoryId;
}

async function normalizeFeedCategoryAssignments(
  apply: boolean,
  now: Date,
  cache: Map<string, string>,
): Promise<AssignmentRewritePlan> {
  const rows = await db
    .select({
      id: feedCategoryAssignments.id,
      subjectId: feedCategoryAssignments.feedId,
      categoryId: feedCategoryAssignments.categoryId,
      provenance: feedCategoryAssignments.provenance,
      categoryLabel: categories.label,
    })
    .from(feedCategoryAssignments)
    .innerJoin(categories, eq(categories.id, feedCategoryAssignments.categoryId));

  const plan: AssignmentRewritePlan = { scanned: rows.length, rewritten: 0, droppedUnmapped: 0 };
  const idsToDelete: string[] = [];
  for (const row of rows) {
    const canonical = mapCategoryLabelToCanonical(row.categoryLabel);
    if (!canonical) {
      plan.droppedUnmapped += 1;
      idsToDelete.push(row.id);
      continue;
    }
    if (canonical === row.categoryLabel) {
      continue;
    }
    plan.rewritten += 1;
    if (!apply) {
      continue;
    }
    const categoryId = await resolveCanonicalCategoryId(cache, canonical, now);
    // Retargeting a row's category id can collide with another assignment already on the
    // canonical category for the same (feed, provenance): the unique index on
    // (feed, category, provenance) would reject a plain UPDATE in that case, so upsert
    // instead and drop the old row.
    await db
      .insert(feedCategoryAssignments)
      .values({
        id: crypto.randomUUID(),
        feedId: row.subjectId,
        categoryId,
        provenance: row.provenance,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          feedCategoryAssignments.feedId,
          feedCategoryAssignments.categoryId,
          feedCategoryAssignments.provenance,
        ],
        set: { updatedAt: now },
      });
    await db.delete(feedCategoryAssignments).where(eq(feedCategoryAssignments.id, row.id));
  }
  if (apply && idsToDelete.length > 0) {
    await db
      .delete(feedCategoryAssignments)
      .where(inArray(feedCategoryAssignments.id, idsToDelete));
  }
  return plan;
}

async function normalizeFeedItemCategoryAssignments(
  apply: boolean,
  now: Date,
  cache: Map<string, string>,
): Promise<AssignmentRewritePlan> {
  const rows = await db
    .select({
      id: feedItemCategoryAssignments.id,
      subjectId: feedItemCategoryAssignments.feedItemId,
      categoryId: feedItemCategoryAssignments.categoryId,
      provenance: feedItemCategoryAssignments.provenance,
      categoryLabel: categories.label,
    })
    .from(feedItemCategoryAssignments)
    .innerJoin(categories, eq(categories.id, feedItemCategoryAssignments.categoryId));

  const plan: AssignmentRewritePlan = { scanned: rows.length, rewritten: 0, droppedUnmapped: 0 };
  const idsToDelete: string[] = [];
  for (const row of rows) {
    const canonical = mapCategoryLabelToCanonical(row.categoryLabel);
    if (!canonical) {
      plan.droppedUnmapped += 1;
      idsToDelete.push(row.id);
      continue;
    }
    if (canonical === row.categoryLabel) {
      continue;
    }
    plan.rewritten += 1;
    if (!apply) {
      continue;
    }
    const categoryId = await resolveCanonicalCategoryId(cache, canonical, now);
    await db
      .insert(feedItemCategoryAssignments)
      .values({
        id: crypto.randomUUID(),
        feedItemId: row.subjectId,
        categoryId,
        provenance: row.provenance,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          feedItemCategoryAssignments.feedItemId,
          feedItemCategoryAssignments.categoryId,
          feedItemCategoryAssignments.provenance,
        ],
        set: { updatedAt: now },
      });
    await db.delete(feedItemCategoryAssignments).where(eq(feedItemCategoryAssignments.id, row.id));
  }
  if (apply && idsToDelete.length > 0) {
    await db
      .delete(feedItemCategoryAssignments)
      .where(inArray(feedItemCategoryAssignments.id, idsToDelete));
  }
  return plan;
}

async function normalizeExistingAssignments(
  apply: boolean,
  now: Date,
): Promise<{ scanned: number; rewritten: number; droppedUnmapped: number }> {
  const cache = new Map<string, string>();
  const feedPlan = await normalizeFeedCategoryAssignments(apply, now, cache);
  const itemPlan = await normalizeFeedItemCategoryAssignments(apply, now, cache);
  return {
    scanned: feedPlan.scanned + itemPlan.scanned,
    rewritten: feedPlan.rewritten + itemPlan.rewritten,
    droppedUnmapped: feedPlan.droppedUnmapped + itemPlan.droppedUnmapped,
  };
}

export function nextItemBackfillBatchSize(input: {
  itemLimit: number | null;
  processed: number;
}): number | null {
  if (input.itemLimit === null) {
    return ITEM_BACKFILL_BATCH_SIZE;
  }
  const remaining = input.itemLimit - input.processed;
  if (remaining <= 0) {
    return null;
  }
  return Math.min(ITEM_BACKFILL_BATCH_SIZE, remaining);
}

type BackfillFeedRow = {
  title: string;
  description: string | null;
  url: string;
  link: string | null;
  sourceKind: string | null;
};

type BackfillFeedRecord = BackfillFeedRow & { id: string };

type BackfillItemRow = {
  title: string;
  summary: string | null;
  contentText: string | null;
  link: string | null;
  canonicalUrl: string;
};

type BackfillItemRecord = BackfillItemRow & {
  id: string;
  feedId: string;
};

type ProcessedFeedStats = {
  feedClassifierCategories: number;
  feedClassifierFallbackSuppressed: boolean;
  itemsScanned: number;
  itemsWithClassifierCategories: number;
  itemClassifierAbstentions: number;
};

type CategoryRecord = {
  slug: string;
  label: string;
  confidence?: number;
};

type InferredBackfillItem = {
  id: string;
  feedId: string;
  inferredCategoryLabels: InferredCategoryLabel[];
};

type ProcessedFeedBatchEntry = {
  feed: BackfillFeedRecord;
  feedCategories: InferredCategoryLabel[];
  items: InferredBackfillItem[];
  stats: ProcessedFeedStats;
};

type BackfillStatusRecord = {
  feedId: string;
  status: typeof BACKFILL_STATUS_PROCESSED | typeof BACKFILL_STATUS_FAILED;
  stats: ProcessedFeedStats;
  errorMessage: string | null;
};

function resolveBackfillClassifier(args: BackfillArgs): BackfillClassifier {
  if (args.classifier === "keyword") {
    return { method: "keyword", model: BACKFILL_CLASSIFIER_MODEL };
  }

  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is required when --classifier embedding is used");
  }
  const embeddingConfig: EmbeddingClassifierConfig = { apiKey };
  return {
    method: "embedding",
    embeddingConfig,
    model: embeddingModelInfo(embeddingConfig),
  };
}

export function inferFeedCategories(feed: BackfillFeedRow): {
  categories: InferredCategoryLabel[];
  suppressedFallback: boolean;
} {
  const classificationInput = {
    feedTitle: feed.title,
    feedDescription: feed.description,
    feedUrl: feed.url,
    feedSiteUrl: feed.link,
    sourceKind: feed.sourceKind,
  };
  if (shouldSuppressFallback(classificationInput)) {
    return { categories: [], suppressedFallback: true };
  }
  return {
    categories: classifyFeedCategories(classificationInput).categories,
    suppressedFallback: false,
  };
}

export function inferItemCategories(
  feed: BackfillFeedRow,
  item: BackfillItemRow,
): InferredCategoryLabel[] {
  return classifyItemCategories({
    feedTitle: feed.title,
    feedDescription: feed.description,
    feedUrl: feed.url,
    feedSiteUrl: feed.link,
    sourceKind: feed.sourceKind,
    itemTitle: item.title,
    itemSummary: item.summary,
    itemContentText: item.contentText,
    itemUrl: item.link || item.canonicalUrl,
  }).categories;
}

export async function inferFeedEmbedding(
  feed: BackfillFeedRow,
  config: EmbeddingClassifierConfig,
): Promise<{
  categories: InferredCategoryLabel[];
  suppressedFallback: boolean;
}> {
  const classificationInput = {
    feedTitle: feed.title,
    feedDescription: feed.description,
    feedUrl: feed.url,
    feedSiteUrl: feed.link,
    sourceKind: feed.sourceKind,
  };
  if (shouldSuppressFallback(classificationInput)) {
    return { categories: [], suppressedFallback: true };
  }
  return {
    categories: (await classifyFeedEmbedding(classificationInput, config)).categories,
    suppressedFallback: false,
  };
}

export async function inferItemEmbedding(
  feed: BackfillFeedRow,
  item: BackfillItemRow,
  config: EmbeddingClassifierConfig,
): Promise<InferredCategoryLabel[]> {
  return (
    await classifyItemEmbedding(
      {
        feedTitle: feed.title,
        feedDescription: feed.description,
        feedUrl: feed.url,
        feedSiteUrl: feed.link,
        sourceKind: feed.sourceKind,
        itemTitle: item.title,
        itemSummary: item.summary,
        itemContentText: item.contentText,
        itemUrl: item.link || item.canonicalUrl,
      },
      config,
      MAX_CLASSIFIER_LABELS,
    )
  ).categories;
}

/**
 * A failing embedding call (rate limit, transient network error) must not abort a bulk backfill
 * run that may be hours into processing thousands of items — it's counted and logged instead,
 * mirroring the online refresh path's best-effort handling of the same calls.
 */
async function inferClassifierFeed(
  feed: BackfillFeedRow,
  classifier: BackfillClassifier,
  stats: BackfillStats,
): Promise<{
  categories: InferredCategoryLabel[];
  suppressedFallback: boolean;
}> {
  if (classifier.method === "keyword") {
    return inferFeedCategories(feed);
  }
  try {
    return await inferFeedEmbedding(feed, classifier.embeddingConfig);
  } catch (error) {
    stats.itemEmbeddingFailures += 1;
    console.warn("[categories:backfill] feed embedding classification failed", {
      feedUrl: feed.url,
      error: error instanceof Error ? error.message : String(error),
    });
    return { categories: [], suppressedFallback: false };
  }
}

async function inferClassifierItem(
  feed: BackfillFeedRow,
  item: BackfillItemRow,
  classifier: BackfillClassifier,
  stats: BackfillStats,
): Promise<InferredCategoryLabel[]> {
  if (classifier.method === "keyword") {
    return inferItemCategories(feed, item);
  }
  try {
    return await inferItemEmbedding(feed, item, classifier.embeddingConfig);
  } catch (error) {
    stats.itemEmbeddingFailures += 1;
    console.warn("[categories:backfill] item embedding classification failed", {
      feedUrl: feed.url,
      itemUrl: item.link || item.canonicalUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function createProcessedFeedStats(): ProcessedFeedStats {
  return {
    feedClassifierCategories: 0,
    feedClassifierFallbackSuppressed: false,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
    itemClassifierAbstentions: 0,
  };
}

function mergeProcessedFeedStats(stats: BackfillStats, feedStats: ProcessedFeedStats): void {
  if (feedStats.feedClassifierCategories > 0) {
    stats.feedsWithClassifierCategories += 1;
  }
  if (feedStats.feedClassifierFallbackSuppressed) {
    stats.feedClassifierFallbacksSuppressed += 1;
  }
  stats.itemsScanned += feedStats.itemsScanned;
  stats.itemsWithClassifierCategories += feedStats.itemsWithClassifierCategories;
  stats.itemClassifierAbstentions += feedStats.itemClassifierAbstentions;
}

function shouldTrackBackfillStatus(args: BackfillArgs): boolean {
  return args.itemLimit === null && args.recentDays === null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeInferredRecords(labels: InferredCategoryLabel[]): CategoryRecord[] {
  const bySlug = new Map<string, CategoryRecord>();
  for (const label of labels) {
    const trimmed = label.label.trim();
    const slug = toCategorySlug(trimmed);
    if (!slug || bySlug.has(slug)) {
      continue;
    }
    bySlug.set(slug, {
      slug,
      label: trimmed,
      confidence: Math.max(0, Math.min(1, label.confidence)),
    });
  }
  return [...bySlug.values()];
}

async function upsertClassifierCategories(
  records: CategoryRecord[],
  now: Date,
): Promise<Map<string, string>> {
  const uniqueRecords = new Map<string, CategoryRecord>();
  for (const record of records) {
    if (!uniqueRecords.has(record.slug)) {
      uniqueRecords.set(record.slug, record);
    }
  }
  if (uniqueRecords.size === 0) {
    return new Map();
  }

  const rows = await db
    .insert(categories)
    .values(
      [...uniqueRecords.values()].map((record) => ({
        id: crypto.randomUUID(),
        slug: record.slug,
        label: record.label,
        provenance: CATEGORY_CLASSIFIER_PROVENANCE,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
        provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
        updatedAt: now,
      },
    })
    .returning({ id: categories.id, slug: categories.slug });

  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function syncInferredFeedBatch(
  entries: ProcessedFeedBatchEntry[],
  classifier: BackfillClassifier,
  now: Date,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const feedIds = entries.map((entry) => entry.feed.id);
  const itemIds = entries.flatMap((entry) => entry.items.map((item) => item.id));

  await db
    .delete(feedCategoryAssignments)
    .where(
      and(
        inArray(feedCategoryAssignments.feedId, feedIds),
        eq(feedCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
        eq(feedCategoryAssignments.modelId, classifier.model.modelId),
      ),
    );

  if (itemIds.length > 0) {
    await db
      .delete(feedItemCategoryAssignments)
      .where(
        and(
          inArray(feedItemCategoryAssignments.feedItemId, itemIds),
          eq(feedItemCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
          eq(feedItemCategoryAssignments.modelId, classifier.model.modelId),
        ),
      );
  }

  const feedRecordsByFeedId = new Map<string, CategoryRecord[]>();
  const itemRecordsByItemId = new Map<string, CategoryRecord[]>();
  const allRecords: CategoryRecord[] = [];

  for (const entry of entries) {
    const feedRecords = normalizeInferredRecords(entry.feedCategories);
    feedRecordsByFeedId.set(entry.feed.id, feedRecords);
    allRecords.push(...feedRecords);

    for (const item of entry.items) {
      const itemRecords = normalizeInferredRecords(item.inferredCategoryLabels);
      itemRecordsByItemId.set(item.id, itemRecords);
      allRecords.push(...itemRecords);
    }
  }

  const categoryIdsBySlug = await upsertClassifierCategories(allRecords, now);
  const feedAssignments = entries.flatMap((entry) =>
    (feedRecordsByFeedId.get(entry.feed.id) ?? []).flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId
        ? [
            {
              id: crypto.randomUUID(),
              feedId: entry.feed.id,
              categoryId,
              provenance: CATEGORY_CLASSIFIER_PROVENANCE,
              confidence: record.confidence,
              modelId: classifier.model.modelId,
              taxonomyVersion: classifier.model.taxonomyVersion,
              classifierMethod: classifier.model.classifierMethod,
              createdAt: now,
              updatedAt: now,
            },
          ]
        : [];
    }),
  );

  if (feedAssignments.length > 0) {
    await db
      .insert(feedCategoryAssignments)
      .values(feedAssignments)
      .onConflictDoUpdate({
        target: [
          feedCategoryAssignments.feedId,
          feedCategoryAssignments.categoryId,
          feedCategoryAssignments.provenance,
          feedCategoryAssignments.modelId,
        ],
        targetWhere: sql`model_id IS NOT NULL`,
        set: {
          confidence: sql`excluded.confidence`,
          taxonomyVersion: sql`excluded.taxonomy_version`,
          classifierMethod: sql`excluded.classifier_method`,
          updatedAt: now,
        },
      });
  }

  const itemAssignments = entries.flatMap((entry) =>
    entry.items.flatMap((item) =>
      (itemRecordsByItemId.get(item.id) ?? []).flatMap((record) => {
        const categoryId = categoryIdsBySlug.get(record.slug);
        return categoryId
          ? [
              {
                id: crypto.randomUUID(),
                feedItemId: item.id,
                categoryId,
                provenance: CATEGORY_CLASSIFIER_PROVENANCE,
                confidence: record.confidence,
                modelId: classifier.model.modelId,
                taxonomyVersion: classifier.model.taxonomyVersion,
                classifierMethod: classifier.model.classifierMethod,
                createdAt: now,
                updatedAt: now,
              },
            ]
          : [];
      }),
    ),
  );

  if (itemAssignments.length > 0) {
    await db
      .insert(feedItemCategoryAssignments)
      .values(itemAssignments)
      .onConflictDoUpdate({
        target: [
          feedItemCategoryAssignments.feedItemId,
          feedItemCategoryAssignments.categoryId,
          feedItemCategoryAssignments.provenance,
          feedItemCategoryAssignments.modelId,
        ],
        targetWhere: sql`model_id IS NOT NULL`,
        set: {
          confidence: sql`excluded.confidence`,
          taxonomyVersion: sql`excluded.taxonomy_version`,
          classifierMethod: sql`excluded.classifier_method`,
          updatedAt: now,
        },
      });
  }
}

async function recordFeedBackfillStatuses(
  records: BackfillStatusRecord[],
  classifier: BackfillClassifier,
  now: Date,
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await db
    .insert(feedCategoryBackfillStatus)
    .values(
      records.map((record) => ({
        feedId: record.feedId,
        classifierMethod: classifier.model.classifierMethod,
        modelId: classifier.model.modelId,
        taxonomyVersion: classifier.model.taxonomyVersion,
        status: record.status,
        feedClassifierCategories: record.stats.feedClassifierCategories,
        feedClassifierFallbackSuppressed: record.stats.feedClassifierFallbackSuppressed,
        itemsScanned: record.stats.itemsScanned,
        itemsWithClassifierCategories: record.stats.itemsWithClassifierCategories,
        itemClassifierAbstentions: record.stats.itemClassifierAbstentions,
        lastError: record.errorMessage,
        processedAt: record.status === BACKFILL_STATUS_PROCESSED ? now : null,
        failedAt: record.status === BACKFILL_STATUS_FAILED ? now : null,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [
        feedCategoryBackfillStatus.feedId,
        feedCategoryBackfillStatus.classifierMethod,
        feedCategoryBackfillStatus.modelId,
        feedCategoryBackfillStatus.taxonomyVersion,
      ],
      set: {
        status: sql`excluded.status`,
        feedClassifierCategories: sql`excluded.feed_classifier_categories`,
        feedClassifierFallbackSuppressed: sql`excluded.feed_classifier_fallback_suppressed`,
        itemsScanned: sql`excluded.items_scanned`,
        itemsWithClassifierCategories: sql`excluded.items_with_classifier_categories`,
        itemClassifierAbstentions: sql`excluded.item_classifier_abstentions`,
        lastError: sql`excluded.last_error`,
        processedAt: sql`excluded.processed_at`,
        failedAt: sql`excluded.failed_at`,
        updatedAt: now,
      },
    });
}

async function recordFeedBackfillStatus(input: {
  feedId: string;
  classifier: BackfillClassifier;
  status: typeof BACKFILL_STATUS_PROCESSED | typeof BACKFILL_STATUS_FAILED;
  stats: ProcessedFeedStats;
  errorMessage: string | null;
  now: Date;
}): Promise<void> {
  const processedAt = input.status === BACKFILL_STATUS_PROCESSED ? input.now : null;
  const failedAt = input.status === BACKFILL_STATUS_FAILED ? input.now : null;
  await db
    .insert(feedCategoryBackfillStatus)
    .values({
      feedId: input.feedId,
      classifierMethod: input.classifier.model.classifierMethod,
      modelId: input.classifier.model.modelId,
      taxonomyVersion: input.classifier.model.taxonomyVersion,
      status: input.status,
      feedClassifierCategories: input.stats.feedClassifierCategories,
      feedClassifierFallbackSuppressed: input.stats.feedClassifierFallbackSuppressed,
      itemsScanned: input.stats.itemsScanned,
      itemsWithClassifierCategories: input.stats.itemsWithClassifierCategories,
      itemClassifierAbstentions: input.stats.itemClassifierAbstentions,
      lastError: input.errorMessage,
      processedAt,
      failedAt,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        feedCategoryBackfillStatus.feedId,
        feedCategoryBackfillStatus.classifierMethod,
        feedCategoryBackfillStatus.modelId,
        feedCategoryBackfillStatus.taxonomyVersion,
      ],
      set: {
        status: input.status,
        feedClassifierCategories: input.stats.feedClassifierCategories,
        feedClassifierFallbackSuppressed: input.stats.feedClassifierFallbackSuppressed,
        itemsScanned: input.stats.itemsScanned,
        itemsWithClassifierCategories: input.stats.itemsWithClassifierCategories,
        itemClassifierAbstentions: input.stats.itemClassifierAbstentions,
        lastError: input.errorMessage,
        processedAt,
        failedAt,
        updatedAt: input.now,
      },
    });
}

async function processFeed(
  feed: BackfillFeedRecord,
  args: BackfillArgs,
  classifier: BackfillClassifier,
  now: Date,
  feedStats: ProcessedFeedStats,
): Promise<void> {
  const { categories: feedCategories, suppressedFallback } = await inferClassifierFeed(
    feed,
    classifier,
  );
  feedStats.feedClassifierCategories = feedCategories.length;
  feedStats.feedClassifierFallbackSuppressed = suppressedFallback;

  let itemOffset = 0;
  let remainingItems = args.itemLimit ?? Number.POSITIVE_INFINITY;

  while (remainingItems > 0) {
    const batchSize = nextItemBackfillBatchSize({
      itemLimit: args.itemLimit,
      processed: itemOffset,
    });
    if (batchSize === null) {
      break;
    }
    const items = await loadItemsPage(feed.id, batchSize, itemOffset, args.recentDays);
    if (items.length === 0) {
      break;
    }

    const inferredItems = await Promise.all(
      items.map(async (item) => {
        feedStats.itemsScanned += 1;
        const inferredCategoryLabels = await inferClassifierItem(feed, item, classifier);
        if (inferredCategoryLabels.length > 0) {
          feedStats.itemsWithClassifierCategories += 1;
        } else {
          feedStats.itemClassifierAbstentions += 1;
        }
        return { id: item.id, inferredCategoryLabels };
      }),
    );

    if (args.apply) {
      // syncInferredFeedCategories unconditionally deletes+reinserts the feed's
      // classifier-provenance feed_category_assignments rows on every call, so passing
      // the real feedCategories here would rewrite identical feed-level data once per
      // page. Item-level deletes ARE correctly scoped to this page's item ids, so only
      // the item sync needs to run per page; the feed-level sync happens once below.
      await syncInferredFeedCategories(
        db,
        {
          feedId: feed.id,
          feedCategories: [],
          items: inferredItems,
          model: classifier.model,
        },
        now,
      );
    }

    itemOffset += items.length;
    if (Number.isFinite(remainingItems)) {
      remainingItems -= items.length;
    }
    if (items.length < batchSize) {
      break;
    }
  }

  if (args.apply) {
    // Single feed-level sync per feed, run last so no later per-page call can delete it.
    await syncInferredFeedCategories(
      db,
      {
        feedId: feed.id,
        feedCategories,
        items: [],
        model: classifier.model,
      },
      now,
    );
  }
}

function shouldUseBatchBackfill(args: BackfillArgs): boolean {
  return args.all && !args.feedId && args.itemLimit === null && args.recentDays === null;
}

async function processFeedBatch(
  feedRows: BackfillFeedRecord[],
  classifier: BackfillClassifier,
): Promise<{
  processed: ProcessedFeedBatchEntry[];
  failedStatuses: BackfillStatusRecord[];
}> {
  const items = (await loadItemsForFeeds(feedRows.map((feed) => feed.id))) as BackfillItemRecord[];
  const itemsByFeedId = new Map<string, BackfillItemRecord[]>();
  for (const item of items) {
    const feedItems = itemsByFeedId.get(item.feedId);
    if (feedItems) {
      feedItems.push(item);
    } else {
      itemsByFeedId.set(item.feedId, [item]);
    }
  }

  const processed: ProcessedFeedBatchEntry[] = [];
  const failedStatuses: BackfillStatusRecord[] = [];

  for (const feed of feedRows) {
    const feedStats = createProcessedFeedStats();
    try {
      const { categories: feedCategories, suppressedFallback } = await inferClassifierFeed(
        feed,
        classifier,
      );
      feedStats.feedClassifierCategories = feedCategories.length;
      feedStats.feedClassifierFallbackSuppressed = suppressedFallback;

      const inferredItems: InferredBackfillItem[] = [];
      for (const item of itemsByFeedId.get(feed.id) ?? []) {
        feedStats.itemsScanned += 1;
        const inferredCategoryLabels = await inferClassifierItem(feed, item, classifier);
        if (inferredCategoryLabels.length > 0) {
          feedStats.itemsWithClassifierCategories += 1;
        } else {
          feedStats.itemClassifierAbstentions += 1;
        }
        inferredItems.push({ id: item.id, feedId: feed.id, inferredCategoryLabels });
      }

      processed.push({
        feed,
        feedCategories,
        items: inferredItems,
        stats: feedStats,
      });
    } catch (error) {
      failedStatuses.push({
        feedId: feed.id,
        status: BACKFILL_STATUS_FAILED,
        stats: feedStats,
        errorMessage: toErrorMessage(error),
      });
    }
  }

  return { processed, failedStatuses };
}

export async function runCategoryBackfill(args: BackfillArgs): Promise<BackfillStats> {
  const classifier = resolveBackfillClassifier(args);
  const stats: BackfillStats = {
    apply: args.apply,
    classifierMethod: classifier.method,
    classifierModelId: classifier.model.modelId,
    feedsScanned: 0,
    feedsWithClassifierCategories: 0,
    feedClassifierFallbacksSuppressed: 0,
    feedsFailed: 0,
    itemsScanned: 0,
    itemsWithClassifierCategories: 0,
    itemClassifierAbstentions: 0,
    feedBackfillStatusesRecorded: 0,
    normalizedExistingAssignments: args.normalizeExisting,
    assignmentsScanned: 0,
    assignmentsRewritten: 0,
    assignmentsDroppedUnmapped: 0,
    itemEmbeddingFailures: 0,
  };
  const now = new Date();

  if (args.normalizeExisting) {
    const assignmentPlan = await normalizeExistingAssignments(args.apply, now);
    stats.assignmentsScanned = assignmentPlan.scanned;
    stats.assignmentsRewritten = assignmentPlan.rewritten;
    stats.assignmentsDroppedUnmapped = assignmentPlan.droppedUnmapped;
  }

  let cursorFeedId: string | null = null;
  const trackStatus = shouldTrackBackfillStatus(args);
  const useBatchBackfill = shouldUseBatchBackfill(args);
  let lastProgressAt = 0;

  while (true) {
    const feedRows = await loadNextFeedBatch(args, classifier, cursorFeedId);
    if (feedRows.length === 0) {
      break;
    }
    if (args.all && !args.feedId) {
      cursorFeedId = feedRows[feedRows.length - 1]!.id;
    }

    if (useBatchBackfill) {
      stats.feedsScanned += feedRows.length;
      const { processed, failedStatuses } = await processFeedBatch(feedRows, classifier);
      if (args.apply) {
        await syncInferredFeedBatch(processed, classifier, now);
      }

      for (const entry of processed) {
        mergeProcessedFeedStats(stats, entry.stats);
      }
      stats.feedsFailed += failedStatuses.length;

      const processedStatuses = processed.map<BackfillStatusRecord>((entry) => ({
        feedId: entry.feed.id,
        status: BACKFILL_STATUS_PROCESSED,
        stats: entry.stats,
        errorMessage: null,
      }));
      const statusRecords: BackfillStatusRecord[] = [...processedStatuses, ...failedStatuses];
      if (trackStatus) {
        if (args.apply) {
          await recordFeedBackfillStatuses(statusRecords, classifier, now);
        }
        stats.feedBackfillStatusesRecorded += statusRecords.length;
      }

      if (stats.feedsScanned - lastProgressAt >= BACKFILL_PROGRESS_INTERVAL) {
        lastProgressAt = stats.feedsScanned;
        console.error(
          `[categories-backfill] scanned ${stats.feedsScanned} feeds and ${stats.itemsScanned} items; recorded ${stats.feedBackfillStatusesRecorded} coverage rows`,
        );
      }
      if (feedRows.length < args.batchSize) {
        break;
      }
      continue;
    }

    for (const feed of feedRows) {
      stats.feedsScanned += 1;
      const feedStats = createProcessedFeedStats();
      let aggregated = false;
      try {
        await processFeed(feed, args, classifier, now, feedStats);
        mergeProcessedFeedStats(stats, feedStats);
        aggregated = true;
        if (trackStatus) {
          if (args.apply) {
            await recordFeedBackfillStatus({
              feedId: feed.id,
              classifier,
              status: BACKFILL_STATUS_PROCESSED,
              stats: feedStats,
              errorMessage: null,
              now,
            });
          }
          stats.feedBackfillStatusesRecorded += 1;
        }
      } catch (error) {
        if (!aggregated) {
          mergeProcessedFeedStats(stats, feedStats);
        }
        stats.feedsFailed += 1;
        if (trackStatus) {
          if (args.apply) {
            await recordFeedBackfillStatus({
              feedId: feed.id,
              classifier,
              status: BACKFILL_STATUS_FAILED,
              stats: feedStats,
              errorMessage: toErrorMessage(error),
              now,
            });
          }
          stats.feedBackfillStatusesRecorded += 1;
        }
        if (!args.all) {
          throw error;
        }
      }
    }

    if (!args.all || args.feedId || feedRows.length < args.batchSize) {
      break;
    }
  }

  return stats;
}

if (import.meta.main) {
  const args = parseBackfillArgs(process.argv);
  try {
    await assertApiDatabaseReady({
      commandName: "categories:backfill",
      ensureSchema: true,
    });
    const stats = await runCategoryBackfill(args);
    console.log(summarizeBackfill(stats));
  } finally {
    await pool.end();
  }
}
