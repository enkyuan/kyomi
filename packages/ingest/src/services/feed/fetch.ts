import type { FetchFeedDocumentResult } from "./types";
import { fetchPublic, type ResolveAddresses } from "../../lib/outbound";
import { cancelResponseBody, readResponseBodyWithByteLimit } from "../../lib/response-body";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export const FEED_FETCH_ACCEPT =
  "application/feed+json,application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8,application/json;q=0.7,text/html;q=0.5,*/*;q=0.1";

const HTML_FETCH_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5";

type FetchFeedDocumentOptions = {
  accept?: "feed" | "html";
  /** How a name becomes addresses; real DNS unless a test says otherwise. */
  resolve?: ResolveAddresses;
};

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

    const { response, finalUrl } = await fetchPublic(
      url,
      { signal: controller.signal, headers },
      { maxRedirects: MAX_REDIRECTS, resolve: options?.resolve },
    );

    if (response.status === 304) {
      return {
        ok: true,
        notModified: true,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }

    if (!response.ok) {
      await cancelResponseBody(response);
      return { ok: false, error: `HTTP ${response.status}`, httpStatus: response.status };
    }

    const result = await readResponseBodyWithByteLimit(response, { maxBytes: MAX_BYTES });
    if (!result.ok) {
      return { ok: false, error: "Feed response too large" };
    }

    return {
      ok: true,
      finalUrl,
      body: result.body,
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
