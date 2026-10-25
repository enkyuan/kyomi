import { compileStoredDocument } from "../../lib/stored-document";
import type { ParsedFeedItem } from "./types";

const DOCUMENT_COMPILE_CONCURRENCY = 4;

const FORMAT_BY_SOURCE = {
  feed_html: "html",
  feed_markdown: "markdown",
  text_fallback: "text",
} as const;

async function mapBounded<T, R>(
  values: readonly T[],
  limit: number,
  fn: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Compiles each item's retained raw body into a KDM document, with bounded concurrency. Items the
 * compiler skips or fails on keep null document fields and still ingest with their HTML body.
 */
export async function attachItemDocuments(
  items: ParsedFeedItem[],
  concurrency = DOCUMENT_COMPILE_CONCURRENCY,
): Promise<ParsedFeedItem[]> {
  return mapBounded(items, concurrency, async (item) => {
    const format =
      item.contentRaw && item.content
        ? FORMAT_BY_SOURCE[item.contentSource as keyof typeof FORMAT_BY_SOURCE]
        : undefined;
    if (!format || !item.contentRaw) {
      return item;
    }
    const stored = await compileStoredDocument({
      raw: item.contentRaw,
      format,
      origin: item.contentSource as keyof typeof FORMAT_BY_SOURCE,
      baseUrl: item.link,
      title: item.title,
    });
    return stored
      ? {
          ...item,
          contentDocument: stored.document,
          contentDocumentVersion: stored.documentVersion,
          contentCompilerVersion: stored.compilerVersion,
        }
      : item;
  });
}
