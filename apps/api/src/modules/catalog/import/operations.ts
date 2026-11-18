import { Effect, Stream } from "effect";
import { toCategorySlug } from "@kyomi/db";
import { AppLogger } from "@adapters/logger/service";
import { serializeError } from "@shared/errors/serialize";
import { CatalogFileError } from "../errors";
import { DEFAULT_IMPORT_BATCH_SIZE, type CatalogImportOptions } from "./cli";
import {
  normalizeImportRecord,
  parseRecord,
  reportValidation,
  type CatalogFeedRecord,
  type ImportStats,
  type NormalizedImportRecord,
  type ValidationReport,
} from "./records";
import { upsertCatalogFeeds } from "./upsert";

const PROGRESS_INTERVAL = 10_000;

export type CatalogImportResult = {
  stats: ImportStats;
  validation: ValidationReport;
  duplicateCanonicalUrls: number;
};

/** Lines of a file, streamed; the reader is released when iteration ends or is interrupted. */
async function* readLines(filePath: string): AsyncIterable<string> {
  const reader = Bun.file(filePath).stream().getReader();
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
      // The stream may already be closed; releasing is best effort.
    }
  }
}

/**
 * `catalog:import`: streams a JSONL catalog file, normalizes each record, and upserts feeds in
 * batches. Malformed lines count as `failed`, duplicates as `skipped`; a failed batch is logged
 * and counted as failed without stopping the run. With `dryRun` nothing is written.
 */
export const importCatalogFile = Effect.fn("catalog.import.run")(function* (
  inputPath: string,
  dryRun: boolean,
  options: CatalogImportOptions = { batchSize: DEFAULT_IMPORT_BATCH_SIZE },
) {
  const log = yield* AppLogger;
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

  const flushPendingRecords = Effect.gen(function* () {
    if (pendingRecords.length === 0) {
      return;
    }
    const batch = pendingRecords;
    pendingRecords = [];

    yield* upsertCatalogFeeds(batch, categoryIdCache).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          stats.imported += result.imported;
          stats.failed += result.failed;
          stats.categoryAssignments += result.categoryAssignments;
          stats.languageAssignments += result.languageAssignments;
        }),
      ),
      Effect.catchTag("DatabaseError", (error) =>
        log
          .warn("catalog.import.batch_failed", {
            records: batch.length,
            error: serializeError(error.cause),
          })
          .pipe(
            Effect.andThen(
              Effect.sync(() => {
                stats.failed += batch.length;
              }),
            ),
          ),
      ),
    );
    if (stats.processed - lastProgressAt >= PROGRESS_INTERVAL) {
      lastProgressAt = stats.processed;
      yield* log.info("catalog.import.progress", {
        processed: stats.processed,
        imported: stats.imported,
      });
    }
  });

  const importLine = Effect.fnUntraced(function* (line: string) {
    if (!line.trim()) {
      return;
    }
    stats.processed += 1;

    let record: CatalogFeedRecord | null;
    try {
      record = parseRecord(line);
    } catch {
      stats.failed += 1;
      return;
    }
    if (!record) {
      stats.skipped += 1;
      return;
    }

    let normalized: NormalizedImportRecord;
    try {
      normalized = normalizeImportRecord(record);
    } catch {
      stats.failed += 1;
      return;
    }

    if (seenCanonicalUrls.has(normalized.canonicalUrl)) {
      // A later user/import pass may follow the same canonical feed; skip the redundant
      // upsert so `imported` counts distinct feeds and we do not re-write metadata.
      duplicateCanonicalUrls += 1;
      stats.skipped += 1;
      return;
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
      return;
    }

    pendingRecords.push(normalized);
    if (pendingRecords.length >= options.batchSize) {
      yield* flushPendingRecords;
    }
  });

  // Strictly in file order: duplicate detection and batching depend on it.
  yield* Stream.fromAsyncIterable(
    readLines(inputPath),
    (cause) => new CatalogFileError({ path: inputPath, cause }),
  ).pipe(Stream.runForEach(importLine));
  yield* flushPendingRecords;

  return { stats, validation, duplicateCanonicalUrls } satisfies CatalogImportResult;
});
