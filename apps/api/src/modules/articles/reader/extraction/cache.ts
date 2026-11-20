import { DateTime, Effect } from "effect";
import { Db } from "@adapters/db/service";
import { articleExtractionCache } from "@kyomi/db";
import { toStoredDocumentColumns, type StoredDocument } from "@kyomi/ingest/lib/stored-document";
import { eq } from "drizzle-orm";

const READY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FAILED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function safeExtractErrorMessage(raw: string, maxLen = 280): string {
  const t = raw.trim();
  if (!t) {
    return "Full text could not be extracted.";
  }
  return t.length > maxLen ? `${t.slice(0, maxLen)}...` : t;
}

function sha256(input: string): string {
  return new Bun.CryptoHasher("sha256").update(input).digest("hex");
}

export function normalizeExtractionUrlKey(url: URL): string {
  const normalized = new URL(url.href);
  normalized.hash = "";
  normalized.hostname = normalized.hostname.toLowerCase();
  if (normalized.pathname.length > 1 && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }
  return normalized.href;
}

function extractionCacheId(urlKey: string): string {
  return `article_extract_${sha256(urlKey)}`;
}

function extractionContentHash(html: string, text: string): string {
  return new Bun.CryptoHasher("sha256").update(html).update("\0").update(text).digest("hex");
}

function isFreshCacheRow(
  row: { status: string; fetchedAt: Date },
  now: Date,
): row is { status: "ready" | "failed"; fetchedAt: Date } {
  const age = now.getTime() - row.fetchedAt.getTime();
  return (
    (row.status === "ready" && age <= READY_CACHE_TTL_MS) ||
    (row.status === "failed" && age <= FAILED_CACHE_TTL_MS)
  );
}

export type FreshExtractionCache =
  | {
      kind: "ready";
      html: string;
      text: string;
      sanitizerVersion: string | null;
      rawHtml: string | null;
      document: StoredDocument | null;
      finalUrl: string | null;
    }
  | { kind: "failed"; errorCode: string; message: string };

export const readFreshExtractionCache = Effect.fn("extraction.cache.read")(function* (
  urlKey: string,
) {
  const db = yield* Db;
  const now = yield* DateTime.nowAsDate;
  const [row] = yield* db.use("select article_extraction_cache", (client) =>
    client
      .select({
        status: articleExtractionCache.status,
        contentHtml: articleExtractionCache.contentHtml,
        contentText: articleExtractionCache.contentText,
        sanitizerVersion: articleExtractionCache.sanitizerVersion,
        rawHtml: articleExtractionCache.rawHtml,
        document: articleExtractionCache.document,
        documentVersion: articleExtractionCache.documentVersion,
        compilerVersion: articleExtractionCache.compilerVersion,
        finalUrl: articleExtractionCache.finalUrl,
        errorCode: articleExtractionCache.errorCode,
        errorMessage: articleExtractionCache.errorMessage,
        fetchedAt: articleExtractionCache.fetchedAt,
      })
      .from(articleExtractionCache)
      .where(eq(articleExtractionCache.urlKey, urlKey))
      .limit(1),
  );

  if (!row || !isFreshCacheRow(row, now)) {
    return null;
  }

  if (row.status === "ready" && row.contentHtml?.trim()) {
    return {
      kind: "ready",
      html: row.contentHtml,
      text: row.contentText ?? "",
      sanitizerVersion: row.sanitizerVersion,
      rawHtml: row.rawHtml,
      document:
        row.document && row.documentVersion !== null && row.compilerVersion
          ? {
              document: row.document as StoredDocument["document"],
              documentVersion: row.documentVersion,
              compilerVersion: row.compilerVersion,
            }
          : null,
      finalUrl: row.finalUrl,
    } satisfies FreshExtractionCache;
  }

  if (row.status === "failed") {
    return {
      kind: "failed",
      errorCode: row.errorCode ?? "EXTRACTION_FAILED",
      message: safeExtractErrorMessage(row.errorMessage ?? "Full text could not be extracted."),
    } satisfies FreshExtractionCache;
  }

  return null;
});

/** Columns an upsert writes; the row's identity (`id`, `urlKey`) is only set on insert. */
type CacheColumns = Omit<typeof articleExtractionCache.$inferInsert, "id" | "urlKey">;

const upsertExtractionCache = (operation: string, urlKey: string, columns: CacheColumns) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.use(operation, (client) =>
      client
        .insert(articleExtractionCache)
        .values({ id: extractionCacheId(urlKey), urlKey, ...columns })
        .onConflictDoUpdate({ target: articleExtractionCache.urlKey, set: columns }),
    );
  });

export const upsertReadyExtractionCache = Effect.fn("extraction.cache.upsertReady")(
  function* (input: {
    urlKey: string;
    sourceUrl: string;
    finalUrl: string | null;
    html: string;
    text: string;
    sanitizerVersion: string;
    rawHtml: string | null;
    document?: StoredDocument | null;
  }) {
    const now = yield* DateTime.nowAsDate;
    const documentColumns = toStoredDocumentColumns(input.document ?? null);
    yield* upsertExtractionCache("upsert ready article_extraction_cache", input.urlKey, {
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl,
      contentHash: extractionContentHash(input.html, input.text),
      contentHtml: input.html,
      contentText: input.text,
      sanitizerVersion: input.sanitizerVersion,
      rawHtml: input.rawHtml,
      document: documentColumns.document,
      documentVersion: documentColumns.documentVersion,
      compilerVersion: documentColumns.compilerVersion,
      status: "ready",
      errorCode: null,
      errorMessage: null,
      fetchedAt: now,
      updatedAt: now,
    });
  },
);

export const upsertFailedExtractionCache = Effect.fn("extraction.cache.upsertFailed")(
  function* (input: {
    urlKey: string;
    sourceUrl: string;
    finalUrl?: string | null;
    errorCode: string;
    message: string;
  }) {
    const now = yield* DateTime.nowAsDate;
    yield* upsertExtractionCache("upsert failed article_extraction_cache", input.urlKey, {
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl ?? null,
      contentHash: null,
      contentHtml: null,
      contentText: null,
      sanitizerVersion: null,
      rawHtml: null,
      document: null,
      documentVersion: null,
      compilerVersion: null,
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.message,
      fetchedAt: now,
      updatedAt: now,
    });
  },
);
