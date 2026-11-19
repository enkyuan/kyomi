import { Effect } from "effect";
import { sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feeds,
  mapCategoryLabelToCanonical,
  toCategorySlug,
} from "@kyomi/db";
import { canonicalWinsOnConflictSql } from "@kyomi/ingest";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { FeedSearch, type FeedSearchDocument } from "@adapters/search/service";
import { serializeError } from "@shared/errors/serialize";
import { currentDate } from "@shared/effect/clock";
import { domainFromUrl, type NormalizedImportRecord } from "./records";

type BatchUpsertResult = {
  imported: number;
  failed: number;
  categoryAssignments: number;
  languageAssignments: number;
};

/**
 * Upsert `catalog`-provenance categories once per canonical slug and cache their ids across
 * batches. Raw catalog categories are signals, not chip labels, so only canonical mappings ever
 * enter the shared `categories` dictionary.
 */
const resolveCatalogCategoryIds = Effect.fn("catalog.import.resolveCategories")(function* (
  labels: string[],
  now: Date,
  cache: Map<string, string>,
) {
  const pendingBySlug = new Map<string, typeof categories.$inferInsert>();
  for (const label of labels) {
    const slug = toCategorySlug(label);
    if (!slug || cache.has(slug) || pendingBySlug.has(slug)) {
      continue;
    }
    pendingBySlug.set(slug, {
      id: crypto.randomUUID(),
      slug,
      label,
      provenance: "catalog",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (pendingBySlug.size > 0) {
    const db = yield* Db;
    const rows = yield* db.use("catalog.import.upsertCategories", async (client) =>
      client
        .insert(categories)
        .values([...pendingBySlug.values()])
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
            provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
            updatedAt: now,
          },
        })
        .returning({ id: categories.id, slug: categories.slug }),
    );
    for (const row of rows) {
      cache.set(row.slug, row.id);
    }
  }

  const idsByLabel = new Map<string, string>();
  for (const label of labels) {
    const slug = toCategorySlug(label);
    const id = slug ? cache.get(slug) : undefined;
    if (id) {
      idsByLabel.set(label, id);
    }
  }
  return idsByLabel;
});

/**
 * Upserts one batch of feeds, their canonical category assignments and their search documents.
 * A search index failure is logged and does not fail the batch: the database is the source of
 * truth and the index is rebuilt from it.
 */
export const upsertCatalogFeeds = Effect.fn("catalog.import.upsertFeeds")(function* (
  records: NormalizedImportRecord[],
  categoryIdCache: Map<string, string>,
) {
  if (records.length === 0) {
    return { imported: 0, failed: 0, categoryAssignments: 0, languageAssignments: 0 };
  }
  const db = yield* Db;
  const search = yield* FeedSearch;
  const log = yield* AppLogger;
  const now = yield* currentDate;

  const rows = yield* db.use("catalog.import.upsertFeeds", async (client) =>
    client
      .insert(feeds)
      .values(
        records.map((record) => ({
          id: crypto.randomUUID(),
          url: record.canonicalUrl,
          title: record.title,
          description: record.description,
          link: record.link,
          catalogSource: record.catalogSource,
          language: record.language,
          contentType: record.contentType,
          qualityScore: record.qualityScore,
          catalogUpdatedAt: now,
          metadataProvenance: "catalog",
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: feeds.url,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          link: sql`excluded.link`,
          catalogSource: sql`excluded.catalog_source`,
          language: sql`excluded.language`,
          contentType: sql`excluded.content_type`,
          qualityScore: sql`excluded.quality_score`,
          catalogUpdatedAt: sql`excluded.catalog_updated_at`,
          metadataProvenance: sql`excluded.metadata_provenance`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({
        id: feeds.id,
        url: feeds.url,
        title: feeds.title,
        description: feeds.description,
        link: feeds.link,
        sourceKind: feeds.sourceKind,
        language: feeds.language,
        contentType: feeds.contentType,
        qualityScore: feeds.qualityScore,
        faviconUrl: feeds.faviconUrl,
      }),
  );

  const recordsByUrl = new Map(records.map((record) => [record.canonicalUrl, record]));
  const canonicalCategoryByUrl = new Map<string, string>();
  const canonicalLabels: string[] = [];

  for (const record of records) {
    const canonicalCategory = record.category ? mapCategoryLabelToCanonical(record.category) : null;
    if (!canonicalCategory) {
      continue;
    }
    canonicalCategoryByUrl.set(record.canonicalUrl, canonicalCategory);
    canonicalLabels.push(canonicalCategory);
  }

  const categoryIdsByLabel = yield* resolveCatalogCategoryIds(
    canonicalLabels,
    now,
    categoryIdCache,
  );
  const assignments: (typeof feedCategoryAssignments.$inferInsert)[] = [];
  const searchDocuments: FeedSearchDocument[] = [];
  let categoryAssignments = 0;
  let languageAssignments = 0;

  for (const row of rows) {
    const record = recordsByUrl.get(row.url);
    if (record?.language) {
      languageAssignments += 1;
    }

    const canonicalCategory = canonicalCategoryByUrl.get(row.url) ?? null;
    const categoryId = canonicalCategory ? categoryIdsByLabel.get(canonicalCategory) : undefined;
    const categorySlug = canonicalCategory ? toCategorySlug(canonicalCategory) : "";
    if (categoryId) {
      assignments.push({
        id: crypto.randomUUID(),
        feedId: row.id,
        categoryId,
        provenance: "catalog",
        createdAt: now,
        updatedAt: now,
      });
      categoryAssignments += 1;
    }

    searchDocuments.push({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      link: row.link,
      faviconUrl: row.faviconUrl,
      sourceKind: row.sourceKind,
      language: row.language,
      contentType: row.contentType,
      qualityScore: row.qualityScore,
      domain: domainFromUrl(row.link ?? row.url),
      categories: categorySlug ? [categorySlug] : [],
    });
  }

  if (assignments.length > 0) {
    yield* db.use("catalog.import.upsertAssignments", async (client) => {
      await client
        .insert(feedCategoryAssignments)
        .values(assignments)
        .onConflictDoUpdate({
          target: [
            feedCategoryAssignments.feedId,
            feedCategoryAssignments.categoryId,
            feedCategoryAssignments.provenance,
          ],
          set: { updatedAt: now },
        });
    });
  }

  yield* search.upsert(searchDocuments).pipe(
    Effect.catch((error) =>
      log.warn("catalog.import.search_index_failed", {
        documents: searchDocuments.length,
        error: serializeError(error),
      }),
    ),
  );

  return {
    imported: rows.length,
    failed: records.length - rows.length,
    categoryAssignments,
    languageAssignments,
  } satisfies BatchUpsertResult;
});
