import type { db } from "@adapters/db/client";
import { articleClips, articleExtractionCache, feedItems } from "@kyomi/db";
import { compileStoredDocument, type StoredDocumentInput } from "@kyomi/worker/lib/stored-document";
import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { DocumentTarget } from "@kyomi/worker";
import { enqueueEnrichmentForStoredDocument } from "./enrich";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

type DB = typeof db;

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
  log?: (message: string) => void;
  /** Queues enrichment for a rewritten document; defaults to the real queue. */
  enqueueEnrichment?: (target: DocumentTarget, document: object) => Promise<void>;
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

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Recompiles stored documents from retained raw source for one scope, keyset-batched by id so a
 * run can resume from `lastId`. Rows already at the current compiler version, or without raw
 * source, are never selected. Dry runs compile and count but write nothing. Each write is guarded
 * on the compiler version read, so a concurrent fresh ingest is never overwritten.
 */
export async function runDocumentBackfillScope(
  database: DB,
  scope: DocumentBackfillScope,
  options: DocumentBackfillOptions,
): Promise<DocumentBackfillResult> {
  const spec = SCOPES[scope];
  const startedAt = Date.now();
  const log = options.log ?? (() => undefined);
  const enqueue =
    options.enqueueEnrichment ??
    ((target: DocumentTarget, document: object) =>
      enqueueEnrichmentForStoredDocument(database, target, document));
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
    const rows = await database
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
          result.lastId ? gt(spec.id, result.lastId) : undefined,
        ),
      )
      .orderBy(asc(spec.id))
      .limit(options.batchSize);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows as {
      id: string;
      raw: string | null;
      source: string | null;
      baseUrl: string | null;
      title: string | null;
      compilerVersion: string | null;
    }[]) {
      result.lastId = row.id;
      result.scanned += 1;
      const format = spec.source ? ORIGIN_BY_SOURCE[row.source ?? ""] : "html";
      if (!row.raw || !format) {
        result.skipped += 1;
        continue;
      }
      const stored = await compileStoredDocument({
        raw: row.raw,
        format,
        origin: spec.source ? (row.source as StoredDocumentInput["origin"]) : "extracted_html",
        baseUrl: row.baseUrl,
        title: row.title,
      });
      if (!stored) {
        result.failed += 1;
        log(`[document-backfill] ${scope} row ${row.id} produced no document`);
        continue;
      }
      result.updated += 1;
      if (options.apply) {
        await database
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
          );
        if (spec.target) {
          await enqueue({ ...spec.target, id: row.id }, stored.document);
        }
      }
    }

    log(
      `[document-backfill] ${scope} scanned=${result.scanned} updated=${result.updated} skipped=${result.skipped} failed=${result.failed} lastId=${result.lastId}`,
    );
    if (rows.length < options.batchSize) {
      break;
    }
    await sleep(options.sleepMs);
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}
