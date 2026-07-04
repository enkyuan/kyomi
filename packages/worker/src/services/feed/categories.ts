import { and, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  toCategorySlug,
} from "@kyomi/db";
import { CATEGORY_CLASSIFIER_PROVENANCE } from "./taxonomy";
import type { InferredCategoryLabel } from "./classifier";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

const FEED_CATEGORY_PROVENANCE = "feed";

type CategoryAssignmentDatabase = Pick<FeedIngestDatabase, "delete" | "insert">;

type CategoryRecord = {
  slug: string;
  label: string;
  confidence?: number;
};

type InferredItemCategoryInput = {
  id: string;
  inferredCategoryLabels?: InferredCategoryLabel[];
};

function normalizeCategoryRecords(labels: string[]): CategoryRecord[] {
  const bySlug = new Map<string, CategoryRecord>();
  for (const label of labels) {
    const trimmed = label.trim();
    const slug = toCategorySlug(trimmed);
    if (!slug || bySlug.has(slug)) {
      continue;
    }
    bySlug.set(slug, { slug, label: trimmed });
  }
  return Array.from(bySlug.values());
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
  return Array.from(bySlug.values());
}

async function upsertCategories(
  database: CategoryAssignmentDatabase,
  records: CategoryRecord[],
  now: Date,
  provenance: string,
): Promise<Map<string, string>> {
  if (records.length === 0) {
    return new Map();
  }

  const rows = await database
    .insert(categories)
    .values(
      records.map((record) => ({
        id: crypto.randomUUID(),
        slug: record.slug,
        label: record.label,
        provenance,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: categories.slug,
      // categories.slug is unique across ALL provenances (feed/catalog/classifier share one
      // dictionary row per slug). Only let an explicit source overwrite the label/provenance
      // of a slug an earlier classifier-only insert claimed; never let a later classifier
      // insert downgrade an existing explicit row.
      set: {
        label: sql`CASE WHEN ${categories.provenance} = ${CATEGORY_CLASSIFIER_PROVENANCE} THEN excluded.label ELSE ${categories.label} END`,
        provenance: sql`CASE WHEN ${categories.provenance} = ${CATEGORY_CLASSIFIER_PROVENANCE} THEN excluded.provenance ELSE ${categories.provenance} END`,
        updatedAt: now,
      },
    })
    .returning({ id: categories.id, slug: categories.slug });

  return new Map(rows.map((row) => [row.slug, row.id]));
}

export async function syncParsedFeedCategories(
  database: CategoryAssignmentDatabase,
  input: {
    feedId: string;
    feedLabels: string[];
    items: ParsedFeedItem[];
  },
  now: Date,
): Promise<void> {
  await database
    .delete(feedCategoryAssignments)
    .where(
      and(
        eq(feedCategoryAssignments.feedId, input.feedId),
        eq(feedCategoryAssignments.provenance, FEED_CATEGORY_PROVENANCE),
      ),
    );

  const itemIds = input.items.map((item) => item.id);
  if (itemIds.length > 0) {
    await database
      .delete(feedItemCategoryAssignments)
      .where(
        and(
          inArray(feedItemCategoryAssignments.feedItemId, itemIds),
          eq(feedItemCategoryAssignments.provenance, FEED_CATEGORY_PROVENANCE),
        ),
      );
  }

  const allRecords = normalizeCategoryRecords([
    ...input.feedLabels,
    ...input.items.flatMap((item) => item.categoryLabels),
  ]);
  const categoryIdsBySlug = await upsertCategories(
    database,
    allRecords,
    now,
    FEED_CATEGORY_PROVENANCE,
  );

  const feedAssignments = normalizeCategoryRecords(input.feedLabels).flatMap((record) => {
    const categoryId = categoryIdsBySlug.get(record.slug);
    return categoryId
      ? [
          {
            id: crypto.randomUUID(),
            feedId: input.feedId,
            categoryId,
            provenance: FEED_CATEGORY_PROVENANCE,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [];
  });
  if (feedAssignments.length > 0) {
    await database
      .insert(feedCategoryAssignments)
      .values(feedAssignments)
      .onConflictDoUpdate({
        target: [
          feedCategoryAssignments.feedId,
          feedCategoryAssignments.categoryId,
          feedCategoryAssignments.provenance,
        ],
        set: { updatedAt: now },
      });
  }

  const itemAssignments = input.items.flatMap((item) =>
    normalizeCategoryRecords(item.categoryLabels).flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId
        ? [
            {
              id: crypto.randomUUID(),
              feedItemId: item.id,
              categoryId,
              provenance: FEED_CATEGORY_PROVENANCE,
              createdAt: now,
              updatedAt: now,
            },
          ]
        : [];
    }),
  );
  if (itemAssignments.length > 0) {
    await database
      .insert(feedItemCategoryAssignments)
      .values(itemAssignments)
      .onConflictDoUpdate({
        target: [
          feedItemCategoryAssignments.feedItemId,
          feedItemCategoryAssignments.categoryId,
          feedItemCategoryAssignments.provenance,
        ],
        set: { updatedAt: now },
      });
  }
}

/**
 * Syncs deterministic classifier fallback categories. Only rewrites
 * `provenance = "classifier"` rows, so it never deletes or overwrites explicit
 * `feed`/`catalog` assignments.
 */
export async function syncInferredFeedCategories(
  database: CategoryAssignmentDatabase,
  input: {
    feedId: string;
    feedCategories: InferredCategoryLabel[];
    items: InferredItemCategoryInput[];
  },
  now: Date,
): Promise<void> {
  await database
    .delete(feedCategoryAssignments)
    .where(
      and(
        eq(feedCategoryAssignments.feedId, input.feedId),
        eq(feedCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
      ),
    );

  const itemIds = input.items.map((item) => item.id);
  if (itemIds.length > 0) {
    await database
      .delete(feedItemCategoryAssignments)
      .where(
        and(
          inArray(feedItemCategoryAssignments.feedItemId, itemIds),
          eq(feedItemCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
        ),
      );
  }

  const feedRecords = normalizeInferredRecords(input.feedCategories);
  const itemRecordsBySlug = input.items.map((item) => ({
    id: item.id,
    records: normalizeInferredRecords(item.inferredCategoryLabels ?? []),
  }));
  const allRecords = normalizeCategoryRecords([
    ...feedRecords.map((record) => record.label),
    ...itemRecordsBySlug.flatMap((item) => item.records.map((record) => record.label)),
  ]);
  const categoryIdsBySlug = await upsertCategories(
    database,
    allRecords,
    now,
    CATEGORY_CLASSIFIER_PROVENANCE,
  );

  const feedAssignments = feedRecords.flatMap((record) => {
    const categoryId = categoryIdsBySlug.get(record.slug);
    return categoryId
      ? [
          {
            id: crypto.randomUUID(),
            feedId: input.feedId,
            categoryId,
            provenance: CATEGORY_CLASSIFIER_PROVENANCE,
            confidence: record.confidence,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [];
  });
  if (feedAssignments.length > 0) {
    await database
      .insert(feedCategoryAssignments)
      .values(feedAssignments)
      .onConflictDoUpdate({
        target: [
          feedCategoryAssignments.feedId,
          feedCategoryAssignments.categoryId,
          feedCategoryAssignments.provenance,
        ],
        set: { confidence: sql`excluded.confidence`, updatedAt: now },
      });
  }

  const itemAssignments = itemRecordsBySlug.flatMap((item) =>
    item.records.flatMap((record) => {
      const categoryId = categoryIdsBySlug.get(record.slug);
      return categoryId
        ? [
            {
              id: crypto.randomUUID(),
              feedItemId: item.id,
              categoryId,
              provenance: CATEGORY_CLASSIFIER_PROVENANCE,
              confidence: record.confidence,
              createdAt: now,
              updatedAt: now,
            },
          ]
        : [];
    }),
  );
  if (itemAssignments.length > 0) {
    await database
      .insert(feedItemCategoryAssignments)
      .values(itemAssignments)
      .onConflictDoUpdate({
        target: [
          feedItemCategoryAssignments.feedItemId,
          feedItemCategoryAssignments.categoryId,
          feedItemCategoryAssignments.provenance,
        ],
        set: { confidence: sql`excluded.confidence`, updatedAt: now },
      });
  }
}
