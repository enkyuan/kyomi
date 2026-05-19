import { assertHttpOrHttpsUrl } from "./normalize-feed-url";
import { assertSafeOutboundUrl, BlockedOutboundUrlError } from "./outbound-fetch-policy";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (VolsRssFeedFetcher/1.0)",
} as const;

export type FetchFeedErrorCode =
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "TLS_CERTIFICATE_FAILED"
  | "HTTP_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "BLOCKED_URL";

export type FetchFeedDocumentResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string; code: FetchFeedErrorCode; status?: number };

const TLS_CERT_ERROR_PATTERNS = [
  /unable to verify the first certificate/i,
  /unable to get local issuer certificate/i,
  /self[- ]signed certificate/i,
  /certificate has expired/i,
  /cert_.*invalid/i,
] as const;

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function fetchFailed(
  code: FetchFeedErrorCode,
  error: string,
  status?: number,
): Extract<FetchFeedDocumentResult, { ok: false }> {
  return { ok: false, error, code, status };
}

function classifyFetchError(error: unknown): Extract<FetchFeedDocumentResult, { ok: false }> {
  if (error instanceof BlockedOutboundUrlError) {
    return fetchFailed("BLOCKED_URL", error.message);
  }

  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return fetchFailed("FETCH_TIMEOUT", "Feed fetch timed out");
  }

  if (
    error instanceof Error &&
    TLS_CERT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
  ) {
    return fetchFailed("TLS_CERTIFICATE_FAILED", error.message);
  }

  const message = error instanceof Error ? error.message : "fetch failed";
  return fetchFailed("FETCH_FAILED", message);
}

async function fetchOnce(
  url: URL,
  signal: AbortSignal,
  ignoreTlsError?: boolean,
): Promise<Response> {
  await assertSafeOutboundUrl(url);
  const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
    redirect: "manual",
    signal,
    headers: FETCH_HEADERS,
  };
  if (ignoreTlsError) {
    init.tls = { rejectUnauthorized: false };
  }
  return fetch(url.href, init);
}

function resolveRedirectTarget(
  response: Response,
  currentUrl: URL,
  redirectCount: number,
): URL | FetchFeedDocumentResult {
  const location = response.headers.get("location");
  if (!location) {
    return fetchFailed("HTTP_ERROR", `HTTP ${response.status}`, response.status);
  }
  if (redirectCount === MAX_REDIRECTS) {
    return fetchFailed("TOO_MANY_REDIRECTS", "Too many redirects");
  }
  try {
    return assertHttpOrHttpsUrl(new URL(location, currentUrl).href);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid redirect target";
    return fetchFailed("FETCH_FAILED", message);
  }
}

async function fetchFollowingRedirects(
  initialUrl: URL,
  signal: AbortSignal,
  ignoreTlsError?: boolean,
): Promise<{ response: Response; finalUrl: URL } | FetchFeedDocumentResult> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchOnce(currentUrl, signal, ignoreTlsError);
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

  return fetchFailed("TOO_MANY_REDIRECTS", "Too many redirects");
}

export async function fetchFeedDocument(
  url: string,
  options?: { ignoreTlsError?: boolean },
): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const fetched = await fetchFollowingRedirects(
      assertHttpOrHttpsUrl(url),
      controller.signal,
      options?.ignoreTlsError,
    );
    if ("ok" in fetched) {
      return fetched;
    }

    const { response, finalUrl } = fetched;
    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      return fetchFailed("HTTP_ERROR", `HTTP ${response.status}`, response.status);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return fetchFailed("RESPONSE_TOO_LARGE", "Feed response too large");
    }

    const body = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return {
      ok: true,
      finalUrl: finalUrl.href,
      body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return classifyFetchError(error);
  } finally {
    clearTimeout(timer);
  }
}
