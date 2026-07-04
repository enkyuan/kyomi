import { and, eq, inArray } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  toCategorySlug,
} from "@kyomi/db";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

const FEED_CATEGORY_PROVENANCE = "feed";

type CategoryAssignmentDatabase = Pick<FeedIngestDatabase, "delete" | "insert">;

type CategoryRecord = {
  slug: string;
  label: string;
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

async function upsertCategories(
  database: CategoryAssignmentDatabase,
  records: CategoryRecord[],
  now: Date,
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
        provenance: FEED_CATEGORY_PROVENANCE,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: categories.slug,
      set: { updatedAt: now },
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
  const categoryIdsBySlug = await upsertCategories(database, allRecords, now);

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
