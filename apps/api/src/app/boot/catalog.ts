import { sql } from "drizzle-orm";
import { categories, feedCategoryAssignments, feeds, mapCategoryLabelToCanonical } from "@kyomi/db";
import { canonicalWinsOnConflictSql } from "@kyomi/worker";
import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { type FeedSearchDocument, upsertFeedSearchDocuments } from "@adapters/search/meili";
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
} from "@modules/catalog/import";

const DEFAULT_CATALOG_IMPORT_BATCH_SIZE = 1_000;

type CatalogImportOptions = {
  batchSize: number;
};

function getArgValue(flag: string, argv = process.argv): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function positiveIntArg(flag: string, fallback: number, argv = process.argv): number {
  const value = getArgValue(flag, argv);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value: ${value}`);
  }
  return parsed;
}

export function parseCatalogImportOptions(argv = process.argv): CatalogImportOptions {
  return {
    batchSize: positiveIntArg("--batch-size", DEFAULT_CATALOG_IMPORT_BATCH_SIZE, argv),
  };
}

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
async function resolveCatalogCategoryIds(
  labels: string[],
  now: Date,
  cache: Map<string, string>,
): Promise<Map<string, string>> {
  const pendingBySlug = new Map<
    string,
    {
      id: string;
      slug: string;
      label: string;
      provenance: "catalog";
      createdAt: Date;
      updatedAt: Date;
    }
  >();

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
    const rows = await db
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
      .returning({ id: categories.id, slug: categories.slug });

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
}

async function upsertCatalogFeeds(
  records: NormalizedImportRecord[],
  categoryIdCache: Map<string, string>,
): Promise<BatchUpsertResult> {
  if (records.length === 0) {
    return { imported: 0, failed: 0, categoryAssignments: 0, languageAssignments: 0 };
  }

  const now = new Date();
  const rows = await db
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
    });

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

  const categoryIdsByLabel = await resolveCatalogCategoryIds(canonicalLabels, now, categoryIdCache);
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
    await db
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
  }

  await upsertFeedSearchDocuments(searchDocuments).catch(() => undefined);

  return {
    imported: rows.length,
    failed: records.length - rows.length,
    categoryAssignments,
    languageAssignments,
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
  options: CatalogImportOptions = { batchSize: DEFAULT_CATALOG_IMPORT_BATCH_SIZE },
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
  const categoryIdCache = new Map<string, string>();
  let pendingRecords: NormalizedImportRecord[] = [];
  let duplicateCanonicalUrls = 0;
  let lastProgressAt = 0;

  async function flushPendingRecords(): Promise<void> {
    if (pendingRecords.length === 0) {
      return;
    }
    const batch = pendingRecords;
    pendingRecords = [];

    try {
      const result = await upsertCatalogFeeds(batch, categoryIdCache);
      stats.imported += result.imported;
      stats.failed += result.failed;
      stats.categoryAssignments += result.categoryAssignments;
      stats.languageAssignments += result.languageAssignments;
    } catch {
      stats.failed += batch.length;
    }
    if (stats.processed - lastProgressAt >= 10_000) {
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

    if (dryRun) {
      stats.imported += 1;
      if (normalized.category && toCategorySlug(normalized.category)) {
        stats.categoryAssignments += 1;
      }
      if (normalized.language) {
        stats.languageAssignments += 1;
      }
      continue;
    }

    pendingRecords.push(normalized);
    if (pendingRecords.length >= options.batchSize) {
      await flushPendingRecords();
    }
  }
  await flushPendingRecords();

  return { stats, validation, duplicateCanonicalUrls };
}

async function main() {
  const input = getArgValue("--input");
  if (!input) {
    throw new Error("Missing required --input <jsonl-path>");
  }

  const dryRun = hasFlag("--dry-run");
  const options = parseCatalogImportOptions();
  if (!dryRun) {
    await assertApiDatabaseReady({
      commandName: "catalog:import",
      ensureSchema: true,
    });
  }
  const { stats, validation, duplicateCanonicalUrls } = await importCatalogFile(
    input,
    dryRun,
    options,
  );

  console.log(
    JSON.stringify(
      {
        input,
        dryRun,
        batchSize: options.batchSize,
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
