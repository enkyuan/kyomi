import { sql } from "drizzle-orm";
import {
  categories,
  feedCategoryAssignments,
  feeds,
  mapCategoryLabelToCanonical,
} from "../../packages/db/src";
import { canonicalWinsOnConflictSql } from "../../packages/worker/src";
import { db, pool } from "../../apps/api/src/adapters/db/client";
import { assertApiDatabaseReady } from "../../apps/api/src/adapters/db/script-preflight";
import {
  upsertFeedSearchDocuments,
  type FeedSearchDocument,
} from "../../apps/api/src/adapters/search/meili";
import {
  domainFromUrl,
  type ImportStats,
  type NormalizedImportRecord,
  normalizeImportRecord,
  parseRecord,
  reportValidation,
  toCategorySlug,
  type ValidationReport,
  type CatalogFeedRecord,
} from "../../apps/api/src/modules/catalog/import";

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

type CatalogBatchResult = {
  imported: number;
  categoryAssignments: number;
  languageAssignments: number;
};

const DEFAULT_IMPORT_BATCH_SIZE = 1000;
const CATALOG_PROVENANCE = "catalog";

function positiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveCanonicalCategory(record: NormalizedImportRecord): {
  label: string;
  slug: string;
} | null {
  const canonicalCategory = record.category ? mapCategoryLabelToCanonical(record.category) : null;
  const slug = canonicalCategory ? toCategorySlug(canonicalCategory) : "";
  return canonicalCategory && slug ? { label: canonicalCategory, slug } : null;
}

function toSearchDocument(
  feed: {
    id: string;
    url: string;
    title: string;
    description: string | null;
    link: string | null;
    sourceKind: string;
    language: string | null;
    contentType: string | null;
    qualityScore: number | null;
    faviconUrl: string | null;
  },
  categorySlug: string | null,
): FeedSearchDocument {
  return {
    id: feed.id,
    url: feed.url,
    title: feed.title,
    description: feed.description,
    link: feed.link,
    faviconUrl: feed.faviconUrl,
    sourceKind: feed.sourceKind,
    language: feed.language,
    contentType: feed.contentType,
    qualityScore: feed.qualityScore,
    domain: domainFromUrl(feed.link ?? feed.url),
    categories: categorySlug ? [categorySlug] : [],
  };
}

async function upsertCatalogBatch(records: NormalizedImportRecord[]): Promise<CatalogBatchResult> {
  if (records.length === 0) {
    return { imported: 0, categoryAssignments: 0, languageAssignments: 0 };
  }

  const now = new Date();
  const categoriesByUrl = new Map<string, { label: string; slug: string }>();
  const categoryValuesBySlug = new Map<string, { label: string; slug: string }>();

  for (const record of records) {
    const category = resolveCanonicalCategory(record);
    if (!category) {
      continue;
    }
    categoriesByUrl.set(record.canonicalUrl, category);
    categoryValuesBySlug.set(category.slug, category);
  }

  const feedRows = await db
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
        metadataProvenance: CATALOG_PROVENANCE,
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
        updatedAt: now,
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
    });

  const categoryRows =
    categoryValuesBySlug.size > 0
      ? await db
          .insert(categories)
          .values(
            [...categoryValuesBySlug.values()].map((category) => ({
              id: crypto.randomUUID(),
              slug: category.slug,
              label: category.label,
              provenance: CATALOG_PROVENANCE,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .onConflictDoUpdate({
            target: categories.slug,
            set: {
              label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
              provenance: canonicalWinsOnConflictSql(
                categories.provenance,
                sql`excluded.provenance`,
              ),
              updatedAt: now,
            },
          })
          .returning({ id: categories.id, slug: categories.slug })
      : [];
  const categoryIdsBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  const assignmentValues = feedRows.flatMap((feed) => {
    const category = categoriesByUrl.get(feed.url);
    const categoryId = category ? categoryIdsBySlug.get(category.slug) : null;
    return categoryId
      ? [
          {
            id: crypto.randomUUID(),
            feedId: feed.id,
            categoryId,
            provenance: CATALOG_PROVENANCE,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [];
  });

  if (assignmentValues.length > 0) {
    await db
      .insert(feedCategoryAssignments)
      .values(assignmentValues)
      .onConflictDoUpdate({
        target: [
          feedCategoryAssignments.feedId,
          feedCategoryAssignments.categoryId,
          feedCategoryAssignments.provenance,
        ],
        targetWhere: sql`model_id IS NULL`,
        set: { updatedAt: now },
      });
  }

  await upsertFeedSearchDocuments(
    feedRows.map((feed) => toSearchDocument(feed, categoriesByUrl.get(feed.url)?.slug ?? null)),
  ).catch(() => undefined);

  return {
    imported: feedRows.length,
    categoryAssignments: assignmentValues.length,
    languageAssignments: feedRows.filter((feed) => feed.language != null).length,
  };
}

async function* readLines(filePath: string): AsyncIterable<string> {
  const stream = Bun.file(filePath).stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line;
      }
    }
    // Flush any remaining bytes
    buffer += decoder.decode();
    if (buffer) {
      yield buffer;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Stream may already be closed; ignore cleanup errors
    }
  }
}

export async function importCatalogFile(
  inputPath: string,
  dryRun: boolean,
  batchSize = DEFAULT_IMPORT_BATCH_SIZE,
): Promise<{ stats: ImportStats; validation: ValidationReport; duplicateCanonicalUrls: number }> {
  const stats: ImportStats = {
    processed: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    categoryAssignments: 0,
    languageAssignments: 0,
  };
  const validation: ValidationReport = {
    missingTitle: 0,
    missingSiteUrl: 0,
    missingLanguage: 0,
    missingCategory: 0,
  };
  const seenCanonicalUrls = new Set<string>();
  let duplicateCanonicalUrls = 0;
  let lastProgressAt = 0;
  const batch: NormalizedImportRecord[] = [];

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) {
      return;
    }

    const records = batch.splice(0);
    if (dryRun) {
      stats.imported += records.length;
      stats.categoryAssignments += records.filter(resolveCanonicalCategory).length;
      stats.languageAssignments += records.filter((record) => record.language != null).length;
    } else {
      const result = await upsertCatalogBatch(records);
      stats.imported += result.imported;
      stats.categoryAssignments += result.categoryAssignments;
      stats.languageAssignments += result.languageAssignments;
    }

    if (!dryRun && stats.processed - lastProgressAt >= 10_000) {
      lastProgressAt = stats.processed;
      console.error(
        `[catalog-import] processed ${stats.processed} records; imported ${stats.imported} feeds`,
      );
    }
  }

  for await (const line of readLines(inputPath)) {
    if (!line.trim()) {
      continue;
    }
    stats.processed += 1;

    let record: CatalogFeedRecord | null = null;
    try {
      record = parseRecord(line);
    } catch {
      stats.failed += 1;
      continue;
    }
    if (!record) {
      stats.skipped += 1;
      continue;
    }

    let normalized: NormalizedImportRecord;
    try {
      normalized = normalizeImportRecord(record);
    } catch {
      stats.failed += 1;
      continue;
    }

    if (seenCanonicalUrls.has(normalized.canonicalUrl)) {
      // A later user/import pass may follow the same canonical feed; skip the redundant
      // upsert so `imported` counts distinct feeds and we do not re-write metadata.
      duplicateCanonicalUrls += 1;
      stats.skipped += 1;
      continue;
    }
    seenCanonicalUrls.add(normalized.canonicalUrl);
    reportValidation(validation, normalized, normalized.title === normalized.canonicalUrl);

    batch.push(normalized);
    if (batch.length >= batchSize) {
      await flushBatch();
    }
  }
  await flushBatch();

  return { stats, validation, duplicateCanonicalUrls };
}

async function main() {
  const input = getArgValue("--input");
  if (!input) {
    throw new Error("Missing required --input <jsonl-path>");
  }

  const dryRun = hasFlag("--dry-run");
  const batchSize = positiveInt(getArgValue("--batch-size"), DEFAULT_IMPORT_BATCH_SIZE);
  if (!dryRun) {
    await assertApiDatabaseReady({
      commandName: "catalog:import",
      ensureSchema: true,
    });
  }
  const { stats, validation, duplicateCanonicalUrls } = await importCatalogFile(
    input,
    dryRun,
    batchSize,
  );

  console.log(
    JSON.stringify(
      {
        input,
        dryRun,
        batchSize,
        ...stats,
        duplicateCanonicalUrls,
        validation,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main()
    .catch((error: unknown) => {
      const maybeCause =
        typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        (error as { cause?: unknown }).cause
          ? (error as { cause?: unknown }).cause
          : null;

      console.error(
        "[catalog-import] failed:",
        error instanceof Error ? error.message : String(error),
      );
      if (maybeCause) {
        console.error("[catalog-import] cause:", maybeCause);
      }
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end().catch(() => undefined);
    });
}
