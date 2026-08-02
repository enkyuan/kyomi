import { db, pool } from "@adapters/db/client";
import { assertApiDatabaseReady } from "@adapters/db/script-preflight";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";
import { and, asc, eq, gt, isNotNull, isNull, ne, or } from "drizzle-orm";
import {
  ARTICLE_HTML_SANITIZER_VERSION,
  processArticleHtml,
} from "@modules/articles/reader/content";

export const BACKFILL_SCOPES = [
  "feed-original",
  "feed-extracted",
  "clip-original",
  "clip-extracted",
  "extraction-cache",
] as const;

export type BackfillScope = (typeof BACKFILL_SCOPES)[number];

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_SLEEP_MS = 100;

export type BackfillSanitizerVersionArgs = {
  apply: boolean;
  batchSize: number;
  sleepMs: number;
  scopes: BackfillScope[];
};

function valueAfter(argv: string[], flag: string): string | null {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  const value = argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function boundedIntFlag(
  argv: string[],
  flag: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = valueAfter(argv, flag);
  if (value === null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${flag} value: ${value} (expected ${min}..${max})`);
  }
  return parsed;
}

function parseScopes(argv: string[]): BackfillScope[] {
  const scopes: BackfillScope[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--scope") {
      continue;
    }
    const value = argv[index + 1];
    if (!value || !(BACKFILL_SCOPES as readonly string[]).includes(value)) {
      throw new Error(`Invalid --scope value: ${value ?? ""}`);
    }
    scopes.push(value as BackfillScope);
  }
  return scopes.length > 0 ? scopes : [...BACKFILL_SCOPES];
}

export function parseBackfillSanitizerVersionArgs(argv: string[]): BackfillSanitizerVersionArgs {
  return {
    apply: argv.includes("--apply"),
    batchSize: boundedIntFlag(argv, "--batch-size", DEFAULT_BATCH_SIZE, 1, 500),
    sleepMs: boundedIntFlag(argv, "--sleep-ms", DEFAULT_SLEEP_MS, 0, 10_000),
    scopes: parseScopes(argv),
  };
}

export type ProcessedSanitizerVersionRow =
  | { skipped: true; failed: false }
  | { skipped: false; failed: false; html: string; text: string; sanitizerVersion: string }
  | { skipped: false; failed: true; error: string };

/** Pure per-row transform: current-version rows are skipped; everything else is reprocessed. */
export function processSanitizerVersionRow(input: {
  html: string;
  sanitizerVersion: string | null;
  baseUrl?: string | null;
}): ProcessedSanitizerVersionRow {
  if (input.sanitizerVersion === ARTICLE_HTML_SANITIZER_VERSION) {
    return { skipped: true, failed: false };
  }
  try {
    const processed = processArticleHtml(input.html, {
      baseUrl: input.baseUrl,
      sanitizerVersion: input.sanitizerVersion,
    });
    return {
      skipped: false,
      failed: false,
      html: processed.html,
      text: processed.text,
      sanitizerVersion: processed.sanitizerVersion,
    };
  } catch (error) {
    return {
      skipped: false,
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type ScopeBackfillResult = {
  scope: BackfillScope;
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  bytesBefore: number;
  bytesAfter: number;
  durationMs: number;
};

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

type DB = typeof db;
type StaleRow = { id: string; html: string | null; sanitizerVersion: string | null };

/** One scope's read-page + update, isolated per table so each stays type-safe and simple. */
type ScopeRunner = {
  readPage: (database: DB, cursor: string | null, limit: number) => Promise<StaleRow[]>;
  applyUpdate: (
    database: DB,
    id: string,
    previousVersion: string | null,
    processed: Extract<ProcessedSanitizerVersionRow, { skipped: false; failed: false }>,
  ) => Promise<void>;
};

function staleVersionFilter(versionColumn: { name: string }) {
  return or(
    isNull(versionColumn as never),
    ne(versionColumn as never, ARTICLE_HTML_SANITIZER_VERSION),
  );
}

/** Guards an update to only apply if the column still holds the version it was read at. */
function versionGuard(versionColumn: { name: string }, previousVersion: string | null) {
  return previousVersion === null
    ? isNull(versionColumn as never)
    : eq(versionColumn as never, previousVersion);
}

const SCOPE_RUNNERS: Record<BackfillScope, ScopeRunner> = {
  "feed-original": {
    readPage: (database, cursor, limit) =>
      database
        .select({
          id: feedItems.id,
          html: feedItems.contentHtml,
          sanitizerVersion: feedItems.contentSanitizerVersion,
        })
        .from(feedItems)
        .where(
          and(
            isNotNull(feedItems.contentHtml),
            staleVersionFilter(feedItems.contentSanitizerVersion),
            cursor ? gt(feedItems.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(feedItems.id))
        .limit(limit),
    applyUpdate: (database, id, previousVersion, processed) =>
      database
        .update(feedItems)
        .set({
          contentHtml: processed.html,
          contentText: processed.text,
          contentSanitizerVersion: processed.sanitizerVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(feedItems.id, id),
            versionGuard(feedItems.contentSanitizerVersion, previousVersion),
          ),
        )
        .then(() => undefined),
  },
  "feed-extracted": {
    readPage: (database, cursor, limit) =>
      database
        .select({
          id: feedItems.id,
          html: feedItems.extractedContentHtml,
          sanitizerVersion: feedItems.extractedContentSanitizerVersion,
        })
        .from(feedItems)
        .where(
          and(
            isNotNull(feedItems.extractedContentHtml),
            staleVersionFilter(feedItems.extractedContentSanitizerVersion),
            cursor ? gt(feedItems.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(feedItems.id))
        .limit(limit),
    applyUpdate: (database, id, previousVersion, processed) =>
      database
        .update(feedItems)
        .set({
          extractedContentHtml: processed.html,
          extractedContentText: processed.text,
          extractedContentSanitizerVersion: processed.sanitizerVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(feedItems.id, id),
            versionGuard(feedItems.extractedContentSanitizerVersion, previousVersion),
          ),
        )
        .then(() => undefined),
  },
  "clip-original": {
    readPage: (database, cursor, limit) =>
      database
        .select({
          id: articleClips.id,
          html: articleClips.contentHtml,
          sanitizerVersion: articleClips.contentSanitizerVersion,
        })
        .from(articleClips)
        .where(
          and(
            isNotNull(articleClips.contentHtml),
            staleVersionFilter(articleClips.contentSanitizerVersion),
            cursor ? gt(articleClips.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(articleClips.id))
        .limit(limit),
    applyUpdate: (database, id, previousVersion, processed) =>
      database
        .update(articleClips)
        .set({
          contentHtml: processed.html,
          contentText: processed.text,
          contentSanitizerVersion: processed.sanitizerVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(articleClips.id, id),
            versionGuard(articleClips.contentSanitizerVersion, previousVersion),
          ),
        )
        .then(() => undefined),
  },
  "clip-extracted": {
    readPage: (database, cursor, limit) =>
      database
        .select({
          id: articleClips.id,
          html: articleClips.extractedContentHtml,
          sanitizerVersion: articleClips.extractedContentSanitizerVersion,
        })
        .from(articleClips)
        .where(
          and(
            isNotNull(articleClips.extractedContentHtml),
            staleVersionFilter(articleClips.extractedContentSanitizerVersion),
            cursor ? gt(articleClips.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(articleClips.id))
        .limit(limit),
    applyUpdate: (database, id, previousVersion, processed) =>
      database
        .update(articleClips)
        .set({
          extractedContentHtml: processed.html,
          extractedContentText: processed.text,
          extractedContentSanitizerVersion: processed.sanitizerVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(articleClips.id, id),
            versionGuard(articleClips.extractedContentSanitizerVersion, previousVersion),
          ),
        )
        .then(() => undefined),
  },
  "extraction-cache": {
    readPage: (database, cursor, limit) =>
      database
        .select({
          id: articleExtractionCache.id,
          html: articleExtractionCache.contentHtml,
          sanitizerVersion: articleExtractionCache.sanitizerVersion,
        })
        .from(articleExtractionCache)
        .where(
          and(
            isNotNull(articleExtractionCache.contentHtml),
            staleVersionFilter(articleExtractionCache.sanitizerVersion),
            cursor ? gt(articleExtractionCache.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(articleExtractionCache.id))
        .limit(limit),
    applyUpdate: (database, id, previousVersion, processed) =>
      database
        .update(articleExtractionCache)
        .set({
          contentHtml: processed.html,
          contentText: processed.text,
          sanitizerVersion: processed.sanitizerVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(articleExtractionCache.id, id),
            versionGuard(articleExtractionCache.sanitizerVersion, previousVersion),
          ),
        )
        .then(() => undefined),
  },
};

/** Runs one scope to completion, keyset-batched by primary key, sleeping between batches. */
export async function runSanitizerVersionBackfillScope(
  database: DB,
  scope: BackfillScope,
  options: { apply: boolean; batchSize: number; sleepMs: number },
): Promise<ScopeBackfillResult> {
  const runner = SCOPE_RUNNERS[scope];
  const startedAt = Date.now();
  const result: ScopeBackfillResult = {
    scope,
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    durationMs: 0,
  };

  let cursor: string | null = null;
  while (true) {
    const rows = await runner.readPage(database, cursor, options.batchSize);
    if (rows.length === 0) {
      break;
    }
    cursor = rows[rows.length - 1]!.id;

    for (const row of rows) {
      result.scanned += 1;
      if (!row.html) {
        continue;
      }
      const processed = processSanitizerVersionRow({
        html: row.html,
        sanitizerVersion: row.sanitizerVersion,
      });

      if (processed.skipped) {
        result.skipped += 1;
        continue;
      }
      if (processed.failed) {
        result.failed += 1;
        console.warn(`[content:sanitizer-backfill] ${scope} row ${row.id} failed`, {
          error: processed.error,
        });
        continue;
      }

      result.bytesBefore += utf8Bytes(row.html);
      result.bytesAfter += utf8Bytes(processed.html);
      result.updated += 1;

      if (options.apply) {
        await runner.applyUpdate(database, row.id, row.sanitizerVersion, processed);
      }
    }

    if (rows.length < options.batchSize) {
      break;
    }
    await sleep(options.sleepMs);
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

if (import.meta.main) {
  const args = parseBackfillSanitizerVersionArgs(process.argv);
  try {
    await assertApiDatabaseReady({ commandName: "content:sanitizer-backfill" });
    const results: ScopeBackfillResult[] = [];
    for (const scope of args.scopes) {
      const result = await runSanitizerVersionBackfillScope(db, scope, args);
      results.push(result);
      console.log(JSON.stringify(result));
    }
    const summary = results.reduce(
      (acc, result) => ({
        scanned: acc.scanned + result.scanned,
        updated: acc.updated + result.updated,
        skipped: acc.skipped + result.skipped,
        failed: acc.failed + result.failed,
      }),
      { scanned: 0, updated: 0, skipped: 0, failed: 0 },
    );
    console.log(
      `${args.apply ? "APPLIED" : "DRY RUN"}: scanned ${summary.scanned}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`,
    );
    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}
