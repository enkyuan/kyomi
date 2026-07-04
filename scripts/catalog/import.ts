import { sql } from "drizzle-orm";
import { categories, feedCategoryAssignments, feeds, mapCategoryLabelToCanonical } from "../../packages/db/src";
import { canonicalWinsOnConflictSql } from "../../packages/worker/src";
import { db, pool } from "../../apps/api/src/adapters/db/client";
import { assertApiDatabaseReady } from "../../apps/api/src/adapters/db/script-preflight";
import { upsertFeedSearchDocument } from "../../apps/api/src/adapters/search/meili";
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

type UpsertResult = {
  ok: boolean;
  categoryAssigned: boolean;
  languageAssigned: boolean;
};

/**
 * Upsert a `catalog`-provenance category and assign it to the feed. Returns true on assign.
 * Callers must pass an already-canonical label: the raw catalog category is a signal, not a
 * chip label, so only canonical mappings are ever inserted into the shared `categories`
 * dictionary.
 */
async function assignCatalogCategory(feedId: string, label: string): Promise<boolean> {
  const slug = toCategorySlug(label);
  if (!slug) {
    return false;
  }
  const now = new Date();
  const categoryRows = await db
    .insert(categories)
    .values({ id: crypto.randomUUID(), slug, label, provenance: "catalog", createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        label: canonicalWinsOnConflictSql(categories.label, sql`excluded.label`),
        provenance: canonicalWinsOnConflictSql(categories.provenance, sql`excluded.provenance`),
        updatedAt: now,
      },
    })
    .returning({ id: categories.id });
  const categoryId = categoryRows[0]?.id;
  if (!categoryId) {
    return false;
  }
  await db
    .insert(feedCategoryAssignments)
    .values({
      id: crypto.randomUUID(),
      feedId,
      categoryId,
      provenance: "catalog",
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
  return true;
}

async function upsertCatalogFeed(record: NormalizedImportRecord): Promise<UpsertResult> {
  const now = new Date();
  const metadata = {
    catalogSource: record.catalogSource,
    language: record.language,
    contentType: record.contentType,
    qualityScore: record.qualityScore,
    catalogUpdatedAt: now,
    metadataProvenance: "catalog",
  };
  const rows = await db
    .insert(feeds)
    .values({
      id: crypto.randomUUID(),
      url: record.canonicalUrl,
      title: record.title,
      description: record.description,
      link: record.link,
      ...metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: feeds.url,
      set: {
        title: record.title,
        description: record.description,
        link: record.link,
        ...metadata,
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

  const upserted = rows[0];
  if (!upserted) {
    return { ok: false, categoryAssigned: false, languageAssigned: false };
  }

  const canonicalCategory = record.category ? mapCategoryLabelToCanonical(record.category) : null;
  const categoryAssigned = canonicalCategory
    ? await assignCatalogCategory(upserted.id, canonicalCategory)
    : false;

  await upsertFeedSearchDocument({
    id: upserted.id,
    url: upserted.url,
    title: upserted.title,
    description: upserted.description,
    link: upserted.link,
    faviconUrl: upserted.faviconUrl,
    sourceKind: upserted.sourceKind,
    language: upserted.language,
    contentType: upserted.contentType,
    qualityScore: upserted.qualityScore,
    domain: domainFromUrl(upserted.link ?? upserted.url),
    categories: canonicalCategory ? [toCategorySlug(canonicalCategory)].filter(Boolean) : [],
  }).catch(() => undefined);

  return { ok: true, categoryAssigned, languageAssigned: record.language != null };
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

    const result = await upsertCatalogFeed(normalized);
    if (!result.ok) {
      stats.failed += 1;
      continue;
    }

    stats.imported += 1;
    if (result.categoryAssigned) {
      stats.categoryAssignments += 1;
    }
    if (result.languageAssigned) {
      stats.languageAssignments += 1;
    }
  }

  return { stats, validation, duplicateCanonicalUrls };
}

async function main() {
  const input = getArgValue("--input");
  if (!input) {
    throw new Error("Missing required --input <jsonl-path>");
  }

  const dryRun = hasFlag("--dry-run");
  if (!dryRun) {
    await assertApiDatabaseReady({
      commandName: "catalog:import",
      ensureSchema: true,
    });
  }
  const { stats, validation, duplicateCanonicalUrls } = await importCatalogFile(input, dryRun);

  console.log(
    JSON.stringify(
      {
        input,
        dryRun,
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
