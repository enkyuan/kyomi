import type { FetchFeedDocumentResult } from "./types";
import { isSafeEnrichmentUrl } from "../../lib/safe-url";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export const FEED_FETCH_ACCEPT =
  "application/feed+json,application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,application/json;q=0.7,text/html;q=0.5,*/*;q=0.1";

const HTML_FETCH_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5";

type FetchFeedDocumentOptions = {
  accept?: "feed" | "html";
};

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function assertSafeFetchUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (!isSafeEnrichmentUrl(url.href)) {
    throw new Error("Private network URLs are not allowed");
  }
  return url;
}

async function fetchWithBoundedRedirects(
  rawUrl: string,
  init: RequestInit,
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = assertSafeFetchUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl.href, {
      ...init,
      redirect: "manual",
    });

    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl.href };
    }

    const location = response.headers.get("location");
    if (!location) {
      return { response, finalUrl: currentUrl.href };
    }

    response.body?.cancel().catch(() => undefined);
    if (redirectCount === MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }
    currentUrl = assertSafeFetchUrl(new URL(location, currentUrl).href);
  }

  throw new Error("Too many redirects");
}

export async function fetchFeedDocument(
  url: string,
  etag?: string | null,
  lastModified?: string | null,
  options?: FetchFeedDocumentOptions,
): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      accept: options?.accept === "html" ? HTML_FETCH_ACCEPT : FEED_FETCH_ACCEPT,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (KyomiFeedFetcher/1.0)",
    };
    if (etag) headers["if-none-match"] = etag;
    if (lastModified) headers["if-modified-since"] = lastModified;

    const { response, finalUrl } = await fetchWithBoundedRedirects(url, {
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
      return { ok: false, error: `HTTP ${response.status}`, httpStatus: response.status };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "Feed response too large" };
    }

    return {
      ok: true,
      finalUrl,
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
