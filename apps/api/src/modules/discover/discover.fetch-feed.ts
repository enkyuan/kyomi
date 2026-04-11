import { assertHttpOrHttpsUrl } from "./discover.normalize-feed-url";
import { assertSafeOutboundUrl, BlockedOutboundUrlError } from "./discover.outbound-fetch-policy";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept:
    "application/rss+xml, application/atom+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8",
  "user-agent": "CronosFeedFetcher/1.0",
} as const;

export type FetchFeedDocumentResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string; code: "FETCH_FAILED" | "BLOCKED_URL" };

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function fetchFailed(error: string): FetchFeedDocumentResult {
  return { ok: false, error, code: "FETCH_FAILED" };
}

async function fetchOnce(url: URL, signal: AbortSignal): Promise<Response> {
  await assertSafeOutboundUrl(url);
  return fetch(url.href, {
    redirect: "manual",
    signal,
    headers: FETCH_HEADERS,
  });
}

function resolveRedirectTarget(
  response: Response,
  currentUrl: URL,
  redirectCount: number,
): URL | FetchFeedDocumentResult {
  const location = response.headers.get("location");
  if (!location) {
    return fetchFailed(`HTTP ${response.status}`);
  }
  if (redirectCount === MAX_REDIRECTS) {
    return fetchFailed("Too many redirects");
  }
  return assertHttpOrHttpsUrl(new URL(location, currentUrl).href);
}

async function fetchFollowingRedirects(
  initialUrl: URL,
  signal: AbortSignal,
): Promise<{ response: Response; finalUrl: URL } | FetchFeedDocumentResult> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchOnce(currentUrl, signal);
    if (!isRedirectStatus(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    const nextUrl = resolveRedirectTarget(response, currentUrl, redirectCount);
    // Drain/cancel the redirect response body so the connection is released promptly.
    response.body?.cancel().catch(() => undefined);
    if ("ok" in nextUrl) {
      return nextUrl;
    }
    currentUrl = nextUrl;
  }

  return fetchFailed("Too many redirects");
}

export async function fetchFeedDocument(url: string): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const fetched = await fetchFollowingRedirects(assertHttpOrHttpsUrl(url), controller.signal);
    if ("ok" in fetched) {
      return fetched;
    }

    const { response, finalUrl } = fetched;
    if (!response.ok) {
      return fetchFailed(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return fetchFailed("Feed response too large");
    }

    const body = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return {
      ok: true,
      finalUrl: finalUrl.href,
      body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    if (error instanceof BlockedOutboundUrlError) {
      return { ok: false, error: error.message, code: "BLOCKED_URL" };
    }
    const message = error instanceof Error ? error.message : "fetch failed";
    return fetchFailed(message);
  } finally {
    clearTimeout(timer);
  }
}
