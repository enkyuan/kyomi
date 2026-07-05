import { and, eq, inArray, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import {
  CANONICAL_CATEGORY_LABELS,
  canonicalizeCategoryLabels,
  categories,
  feedCategoryAssignments,
  feedItemCategoryAssignments,
  toCategorySlug,
} from "@kyomi/db";
import { CATEGORY_CLASSIFIER_PROVENANCE } from "./taxonomy";
import type { InferredCategoryLabel } from "./classifier";
import type { FeedIngestDatabase, ParsedFeedItem } from "./types";

const FEED_CATEGORY_PROVENANCE = "feed";

// `sql.join` needs at least one element; CANONICAL_CATEGORY_LABELS is a fixed non-empty
// constant, so this never runs with an empty list.
const CANONICAL_LABELS_SQL_LIST = sql.join(
  CANONICAL_CATEGORY_LABELS.map((label) => sql`${label}`),
  sql`, `,
);

/**
 * `categories.slug` is unique across ALL provenances (feed/catalog/classifier share one
 * dictionary row per slug), so a raw noisy label and a canonical label can collide on the
 * same slug (e.g. raw "MISCELLANEOUS" vs. canonical "Miscellaneous"). Builds the winning-value
 * expression for an `onConflictDoUpdate` column: the incoming (`excluded`) value wins when
 * either (a) the existing row is classifier-provenance (always safe to refresh), or (b) the
 * incoming label is canonical and the existing one is not — a canonical label must never lose
 * a slug race to a raw label, since callers use the returned id to attach assignments and
 * assume the row they get back is canonical.
 */
export function canonicalWinsOnConflictSql(
  existingColumnSql: SQLWrapper,
  excludedColumnSql: SQLWrapper,
): SQL<string> {
  return sql`CASE WHEN ${categories.provenance} = ${CATEGORY_CLASSIFIER_PROVENANCE} OR (excluded.label IN (${CANONICAL_LABELS_SQL_LIST}) AND ${categories.label} NOT IN (${CANONICAL_LABELS_SQL_LIST})) THEN ${excludedColumnSql} ELSE ${existingColumnSql} END`;
}

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
      set: {
        label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
        provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
        updatedAt: now,
      },
    })
    .returning({ id: categories.id, slug: categories.slug });

  return new Map(rows.map((row) => [row.slug, row.id]));
}

/**
 * True when a feed already has at least one explicit (`provenance = "feed"`) category
 * assignment from a prior full fetch. Used to skip re-running the classifier fallback on a
 * `304 Not Modified` response, mirroring the canonical-label check `classifyFeedLevel`
 * runs against freshly parsed metadata on a full fetch — a 304 has no fresh document to check,
 * so this checks persisted state instead.
 */
export async function hasExplicitFeedCategories(
  database: Pick<FeedIngestDatabase, "select">,
  feedId: string,
): Promise<boolean> {
  const rows = await database
    .select({ id: feedCategoryAssignments.id })
    .from(feedCategoryAssignments)
    .where(
      and(
        eq(feedCategoryAssignments.feedId, feedId),
        eq(feedCategoryAssignments.provenance, FEED_CATEGORY_PROVENANCE),
      ),
    )
    .limit(1);
  return rows.length > 0;
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

  // Raw source labels (RSS/Atom/JSON Feed categories) are signals, not chip labels: map them
  // onto the canonical taxonomy before ever inserting a `categories` row, so unmapped noisy
  // labels (hashtags, dates, free-text titles) never reach the dictionary or the chip UI.
  const canonicalFeedLabels = canonicalizeCategoryLabels(input.feedLabels);
  const canonicalItemLabelsById = new Map(
    input.items.map((item) => [item.id, canonicalizeCategoryLabels(item.categoryLabels)]),
  );

  const allRecords = normalizeCategoryRecords([
    ...canonicalFeedLabels,
    ...Array.from(canonicalItemLabelsById.values()).flat(),
  ]);
  const categoryIdsBySlug = await upsertCategories(
    database,
    allRecords,
    now,
    FEED_CATEGORY_PROVENANCE,
  );

  const feedAssignments = normalizeCategoryRecords(canonicalFeedLabels).flatMap((record) => {
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
        // Must match the partial unique index's predicate exactly (`model_id IS NULL`) —
        // explicit rows never set model_id, so this targets the "explicit rows" partial
        // index rather than the "classifier rows" one that also includes model_id in its
        // column list. Omitting this throws "no unique or exclusion constraint matching
        // the ON CONFLICT specification" since a bare 3-column target no longer identifies
        // either partial index unambiguously.
        targetWhere: sql`model_id IS NULL`,
        set: { updatedAt: now },
      });
  }

  const itemAssignments = input.items.flatMap((item) =>
    normalizeCategoryRecords(canonicalItemLabelsById.get(item.id) ?? []).flatMap((record) => {
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
        targetWhere: sql`model_id IS NULL`,
        set: { updatedAt: now },
      });
  }
}

export type ClassifierModelInfo = {
  modelId: string;
  taxonomyVersion: string;
  classifierMethod: string;
};

/**
 * Syncs deterministic classifier fallback categories for one classifier model. Only rewrites
 * `provenance = "classifier"` rows stamped with the given `modelId`, so it never deletes or
 * overwrites explicit `feed`/`catalog` assignments, nor rows written by a different
 * classifier model (e.g. running the embedding classifier never deletes the keyword
 * classifier's rows, and vice versa) — that's what lets both coexist for side-by-side eval.
 */
export async function syncInferredFeedCategories(
  database: CategoryAssignmentDatabase,
  input: {
    feedId: string;
    feedCategories: InferredCategoryLabel[];
    items: InferredItemCategoryInput[];
    model: ClassifierModelInfo;
  },
  now: Date,
): Promise<void> {
  await database
    .delete(feedCategoryAssignments)
    .where(
      and(
        eq(feedCategoryAssignments.feedId, input.feedId),
        eq(feedCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
        eq(feedCategoryAssignments.modelId, input.model.modelId),
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
          eq(feedItemCategoryAssignments.modelId, input.model.modelId),
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
            modelId: input.model.modelId,
            taxonomyVersion: input.model.taxonomyVersion,
            classifierMethod: input.model.classifierMethod,
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
          feedCategoryAssignments.modelId,
        ],
        // Matches the "classifier rows" partial index's predicate — see the targetWhere
        // comment in syncParsedFeedCategories above for why this must be explicit.
        targetWhere: sql`model_id IS NOT NULL`,
        set: {
          confidence: sql`excluded.confidence`,
          taxonomyVersion: sql`excluded.taxonomy_version`,
          classifierMethod: sql`excluded.classifier_method`,
          updatedAt: now,
        },
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
              modelId: input.model.modelId,
              taxonomyVersion: input.model.taxonomyVersion,
              classifierMethod: input.model.classifierMethod,
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
