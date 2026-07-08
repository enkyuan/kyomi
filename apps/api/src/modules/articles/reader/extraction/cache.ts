import { createHash } from "node:crypto";
import type { db } from "@adapters/db/client";
import { articleExtractionCache } from "@kyomi/db";
import { eq } from "drizzle-orm";

type DB = typeof db;

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
  return createHash("sha256").update(input).digest("hex");
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
  return sha256(`${html}\0${text}`);
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

export async function readFreshExtractionCache(
  database: DB,
  urlKey: string,
  now = new Date(),
): Promise<
  | { kind: "ready"; html: string; text: string }
  | { kind: "failed"; errorCode: string; message: string }
  | null
> {
  const [row] = await database
    .select({
      status: articleExtractionCache.status,
      contentHtml: articleExtractionCache.contentHtml,
      contentText: articleExtractionCache.contentText,
      errorCode: articleExtractionCache.errorCode,
      errorMessage: articleExtractionCache.errorMessage,
      fetchedAt: articleExtractionCache.fetchedAt,
    })
    .from(articleExtractionCache)
    .where(eq(articleExtractionCache.urlKey, urlKey))
    .limit(1);

  if (!row || !isFreshCacheRow(row, now)) {
    return null;
  }

  if (row.status === "ready" && row.contentHtml?.trim()) {
    return { kind: "ready", html: row.contentHtml, text: row.contentText ?? "" };
  }

  if (row.status === "failed") {
    return {
      kind: "failed",
      errorCode: row.errorCode ?? "EXTRACTION_FAILED",
      message: safeExtractErrorMessage(row.errorMessage ?? "Full text could not be extracted."),
    };
  }

  return null;
}

export async function upsertReadyExtractionCache(
  database: DB,
  input: {
    urlKey: string;
    sourceUrl: string;
    finalUrl: string | null;
    html: string;
    text: string;
  },
) {
  const now = new Date();
  await database
    .insert(articleExtractionCache)
    .values({
      id: extractionCacheId(input.urlKey),
      urlKey: input.urlKey,
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl,
      contentHash: extractionContentHash(input.html, input.text),
      contentHtml: input.html,
      contentText: input.text,
      status: "ready",
      errorCode: null,
      errorMessage: null,
      fetchedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: articleExtractionCache.urlKey,
      set: {
        sourceUrl: input.sourceUrl,
        finalUrl: input.finalUrl,
        contentHash: extractionContentHash(input.html, input.text),
        contentHtml: input.html,
        contentText: input.text,
        status: "ready",
        errorCode: null,
        errorMessage: null,
        fetchedAt: now,
        updatedAt: now,
      },
    });
}

export async function upsertFailedExtractionCache(
  database: DB,
  input: {
    urlKey: string;
    sourceUrl: string;
    finalUrl?: string | null;
    errorCode: string;
    message: string;
  },
) {
  const now = new Date();
  await database
    .insert(articleExtractionCache)
    .values({
      id: extractionCacheId(input.urlKey),
      urlKey: input.urlKey,
      sourceUrl: input.sourceUrl,
      finalUrl: input.finalUrl ?? null,
      contentHash: null,
      contentHtml: null,
      contentText: null,
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.message,
      fetchedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: articleExtractionCache.urlKey,
      set: {
        sourceUrl: input.sourceUrl,
        finalUrl: input.finalUrl ?? null,
        contentHash: null,
        contentHtml: null,
        contentText: null,
        status: "failed",
        errorCode: input.errorCode,
        errorMessage: input.message,
        fetchedAt: now,
        updatedAt: now,
      },
    });
}
