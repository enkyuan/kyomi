import {
  fetchRemoteDocument,
  type RemoteDocumentErrorCode,
  type RemoteDocumentFetchResult,
} from "@shared/net/remote-document";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FEED_FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
} as const;

export type FetchFeedErrorCode = RemoteDocumentErrorCode;
export type FetchFeedDocumentResult = RemoteDocumentFetchResult;

function toFeedFetchResult(result: RemoteDocumentFetchResult): FetchFeedDocumentResult {
  if (result.ok) {
    return result;
  }
  if (result.code === "FETCH_TIMEOUT") {
    return { ...result, error: "Feed fetch timed out" };
  }
  if (result.code === "RESPONSE_TOO_LARGE") {
    return { ...result, error: "Feed response too large" };
  }
  return result;
}

export async function fetchFeedDocument(
  url: string,
  options?: { ignoreTlsError?: boolean },
): Promise<FetchFeedDocumentResult> {
  const result = await fetchRemoteDocument(url, {
    ignoreTlsError: options?.ignoreTlsError,
    headers: FEED_FETCH_HEADERS,
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
  });
  return toFeedFetchResult(result);
}
