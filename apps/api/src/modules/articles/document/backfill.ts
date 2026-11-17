import { Clock, Effect } from "effect";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";
import { compileStoredDocument, type StoredDocumentInput } from "@kyomi/ingest/lib/stored-document";
import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { DocumentTarget } from "@kyomi/ingest";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { enqueueEnrichmentForStoredDocument } from "./enrich";

export const DOCUMENT_BACKFILL_SCOPES = [
  "feed-original",
  "feed-extracted",
  "clip-original",
  "clip-extracted",
  "extraction-cache",
] as const;

export type DocumentBackfillScope = (typeof DOCUMENT_BACKFILL_SCOPES)[number];

type ScopeSpec = {
  table: PgTable;
  id: PgColumn;
  raw: PgColumn;
  /** Column holding `content_source`; null for scopes that are always extracted HTML. */
  source: PgColumn | null;
  baseUrl: SQL;
  title: PgColumn | null;
  document: PgColumn;
  documentVersion: PgColumn;
  compilerVersion: PgColumn;
  /** Property names on the Drizzle table, used to build the update `set`. */
  keys: { document: string; documentVersion: string; compilerVersion: string };
  /** Enrichment target for rows of this scope; null for the extraction cache, which is not served. */
  target: Pick<DocumentTarget, "table" | "body"> | null;
};

const SCOPES: Record<DocumentBackfillScope, ScopeSpec> = {
  "feed-original": {
    table: feedItems,
    id: feedItems.id,
    raw: feedItems.contentRaw,
    source: feedItems.contentSource,
    baseUrl: sql`${feedItems.link}`,
    title: feedItems.title,
    document: feedItems.contentDocument,
    documentVersion: feedItems.contentDocumentVersion,
    compilerVersion: feedItems.contentCompilerVersion,
    keys: {
      document: "contentDocument",
      documentVersion: "contentDocumentVersion",
      compilerVersion: "contentCompilerVersion",
    },
    target: { table: "feed_items", body: "original" },
  },
  "feed-extracted": {
    table: feedItems,
    id: feedItems.id,
    raw: feedItems.extractedContentRaw,
    source: null,
    baseUrl: sql`${feedItems.link}`,
    title: feedItems.title,
    document: feedItems.extractedContentDocument,
    documentVersion: feedItems.extractedContentDocumentVersion,
    compilerVersion: feedItems.extractedContentCompilerVersion,
    keys: {
      document: "extractedContentDocument",
      documentVersion: "extractedContentDocumentVersion",
      compilerVersion: "extractedContentCompilerVersion",
    },
    target: { table: "feed_items", body: "extracted" },
  },
  "clip-original": {
    table: articleClips,
    id: articleClips.id,
    raw: articleClips.contentRaw,
    source: articleClips.contentSource,
    baseUrl: sql`${articleClips.url}`,
    title: articleClips.title,
    document: articleClips.contentDocument,
    documentVersion: articleClips.contentDocumentVersion,
    compilerVersion: articleClips.contentCompilerVersion,
    keys: {
      document: "contentDocument",
      documentVersion: "contentDocumentVersion",
      compilerVersion: "contentCompilerVersion",
    },
    target: { table: "article_clips", body: "original" },
  },
  "clip-extracted": {
    table: articleClips,
    id: articleClips.id,
    raw: articleClips.extractedContentRaw,
    source: null,
    baseUrl: sql`${articleClips.url}`,
    title: articleClips.title,
    document: articleClips.extractedContentDocument,
    documentVersion: articleClips.extractedContentDocumentVersion,
    compilerVersion: articleClips.extractedContentCompilerVersion,
    keys: {
      document: "extractedContentDocument",
      documentVersion: "extractedContentDocumentVersion",
      compilerVersion: "extractedContentCompilerVersion",
    },
    target: { table: "article_clips", body: "extracted" },
  },
  "extraction-cache": {
    table: articleExtractionCache,
    id: articleExtractionCache.id,
    raw: articleExtractionCache.rawHtml,
    source: null,
    baseUrl: sql`COALESCE(${articleExtractionCache.finalUrl}, ${articleExtractionCache.sourceUrl})`,
    title: null,
    document: articleExtractionCache.document,
    documentVersion: articleExtractionCache.documentVersion,
    compilerVersion: articleExtractionCache.compilerVersion,
    keys: {
      document: "document",
      documentVersion: "documentVersion",
      compilerVersion: "compilerVersion",
    },
    target: null,
  },
};

const ORIGIN_BY_SOURCE: Record<string, StoredDocumentInput["format"] | undefined> = {
  feed_html: "html",
  feed_markdown: "markdown",
  text_fallback: "text",
};

export type DocumentBackfillOptions = {
  apply: boolean;
  batchSize: number;
  sleepMs: number;
  /** Compiler version that counts as current; rows holding any other value are recompiled. */
  compilerVersion: string;
  /** Resume cursor: only rows with an id greater than this are scanned. */
  afterId?: string | null;
};

export type DocumentBackfillResult = {
  scope: DocumentBackfillScope;
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  lastId: string | null;
  durationMs: number;
};

type ScannedRow = {
  id: string;
  raw: string | null;
  source: string | null;
  baseUrl: string | null;
  title: string | null;
  compilerVersion: string | null;
};

/** The next batch of stale rows after `afterId`, in id order. */
const scanBatch = Effect.fn("articles.document.backfill.scan")(function* (
  spec: ScopeSpec,
  options: DocumentBackfillOptions,
  afterId: string | null,
) {
  const db = yield* Db;
  const rows = yield* db.use("articles.document.backfill.scan", (client) =>
    client
      .select({
        id: spec.id,
        raw: spec.raw,
        source: spec.source ?? sql<null>`NULL`,
        baseUrl: spec.baseUrl,
        title: spec.title ?? sql<null>`NULL`,
        compilerVersion: spec.compilerVersion,
      })
      .from(spec.table)
      .where(
        and(
          isNotNull(spec.raw),
          or(isNull(spec.compilerVersion), ne(spec.compilerVersion, options.compilerVersion)),
          afterId ? gt(spec.id, afterId) : undefined,
        ),
      )
      .orderBy(asc(spec.id))
      .limit(options.batchSize),
  );
  return rows as ScannedRow[];
});

/** Recompiles one row and, when applying, writes the document and queues its enrichment. */
const rewriteRow = Effect.fn("articles.document.backfill.row")(function* (
  scope: DocumentBackfillScope,
  spec: ScopeSpec,
  row: ScannedRow,
  apply: boolean,
) {
  const format = spec.source ? ORIGIN_BY_SOURCE[row.source ?? ""] : "html";
  const raw = row.raw;
  if (!raw || !format) {
    return "skipped" as const;
  }
  // Never throws: a compiler failure yields no document.
  const stored = yield* Effect.promise(() =>
    compileStoredDocument({
      raw,
      format,
      origin: spec.source ? (row.source as StoredDocumentInput["origin"]) : "extracted_html",
      baseUrl: row.baseUrl,
      title: row.title,
    }),
  );
  if (!stored) {
    const log = yield* AppLogger;
    yield* log.warn("document.backfill.no_document", { scope, id: row.id });
    return "failed" as const;
  }
  if (apply) {
    const db = yield* Db;
    yield* db.use("articles.document.backfill.write", (client) =>
      client
        .update(spec.table)
        .set({
          [spec.keys.document]: stored.document,
          [spec.keys.documentVersion]: stored.documentVersion,
          [spec.keys.compilerVersion]: stored.compilerVersion,
        })
        .where(
          and(
            eq(spec.id, row.id),
            row.compilerVersion === null
              ? isNull(spec.compilerVersion)
              : eq(spec.compilerVersion, row.compilerVersion),
          ),
        ),
    );
    if (spec.target) {
      yield* enqueueEnrichmentForStoredDocument({ ...spec.target, id: row.id }, stored.document);
    }
  }
  return "updated" as const;
});

/**
 * Recompiles stored documents from retained raw source for one scope, keyset-batched by id so a
 * run can resume from `lastId`. Rows already at the current compiler version, or without raw
 * source, are never selected. Dry runs compile and count but write nothing. Each write is guarded
 * on the compiler version read, so a concurrent fresh ingest is never overwritten. Rows are
 * handled one at a time and batches are `sleepMs` apart, which paces the load on the database.
 */
export const runDocumentBackfillScope = Effect.fn("articles.document.backfill")(function* (
  scope: DocumentBackfillScope,
  options: DocumentBackfillOptions,
) {
  const log = yield* AppLogger;
  const spec = SCOPES[scope];
  const startedAt = yield* Clock.currentTimeMillis;
  const result: DocumentBackfillResult = {
    scope,
    scanned: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    lastId: options.afterId ?? null,
    durationMs: 0,
  };

  while (true) {
    const rows = yield* scanBatch(spec, options, result.lastId);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      result.lastId = row.id;
      result.scanned += 1;
      const outcome = yield* rewriteRow(scope, spec, row, options.apply);
      result[outcome] += 1;
    }

    yield* log.info("document.backfill.batch", {
      scope,
      scanned: result.scanned,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      lastId: result.lastId,
    });
    if (rows.length < options.batchSize) {
      break;
    }
    yield* Effect.sleep(options.sleepMs);
  }

  result.durationMs = (yield* Clock.currentTimeMillis) - startedAt;
  return result;
});
