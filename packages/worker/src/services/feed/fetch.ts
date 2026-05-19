import { FETCH_TIMEOUT_MS, MAX_BYTES } from "./constants";
import type { FetchFeedDocumentResult } from "./types";

export async function fetchFeedDocument(
  url: string,
  etag?: string | null,
  lastModified?: string | null,
): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
    };
    if (etag) headers["if-none-match"] = etag;
    if (lastModified) headers["if-modified-since"] = lastModified;

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });

    if (response.status === 304) {
      return {
        ok: true,
        notModified: true,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "Feed response too large" };
    }

    return {
      ok: true,
      finalUrl: response.url,
      body: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      contentType: response.headers.get("content-type") ?? "",
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      notModified: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
