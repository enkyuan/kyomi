import { and, eq, inArray, sql } from "drizzle-orm";
import { feedItemTagAssignments, toCategorySlug } from "@kyomi/db";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

const SOURCE_TAG_PROVENANCE = "feed";
const MAX_SOURCE_TAGS_PER_ITEM = 20;

type SourceTagAssignmentDatabase = Pick<FeedIngestDatabase, "delete" | "insert">;

type SourceTagRecord = {
  slug: string;
  label: string;
};

export function normalizeSourceTagRecords(labels: readonly string[]): SourceTagRecord[] {
  const bySlug = new Map<string, SourceTagRecord>();
  for (const label of labels) {
    const normalized = label.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }

    const slug = toCategorySlug(normalized);
    if (!slug || bySlug.has(slug)) {
      continue;
    }

    bySlug.set(slug, { slug, label: normalized });
    if (bySlug.size >= MAX_SOURCE_TAGS_PER_ITEM) {
      break;
    }
  }
  return Array.from(bySlug.values());
}

export async function syncParsedFeedItemTags(
  database: SourceTagAssignmentDatabase,
  items: Pick<ParsedFeedItem, "id" | "categoryLabels">[],
  now: Date,
): Promise<number> {
  const itemIds = items.map((item) => item.id);
  if (itemIds.length === 0) {
    return 0;
  }

  await database
    .delete(feedItemTagAssignments)
    .where(
      and(
        inArray(feedItemTagAssignments.feedItemId, itemIds),
        eq(feedItemTagAssignments.provenance, SOURCE_TAG_PROVENANCE),
      ),
    );

  const rows = items.flatMap((item) =>
    normalizeSourceTagRecords(item.categoryLabels).map((tag) => ({
      id: crypto.randomUUID(),
      feedItemId: item.id,
      slug: tag.slug,
      label: tag.label,
      provenance: SOURCE_TAG_PROVENANCE,
      confidence: null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  if (rows.length === 0) {
    return 0;
  }

  await database
    .insert(feedItemTagAssignments)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        feedItemTagAssignments.feedItemId,
        feedItemTagAssignments.slug,
        feedItemTagAssignments.provenance,
      ],
      set: {
        label: sql`excluded.label`,
        confidence: null,
        updatedAt: now,
      },
    });

  return rows.length;
}
