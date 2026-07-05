import { assertHttpOrHttpsUrl } from "./normalize";
import { BlockedOutboundUrlError } from "@shared/net/outbound-policy";
import {
  TooManyRedirectsError,
  fetchWithSafeRedirects,
  readResponseBodyWithByteLimit,
} from "@shared/net/safe-fetch";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,application/atom+xml,application/json,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (KyomiFeedFetcher/1.0)",
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

  if (error instanceof TooManyRedirectsError) {
    return fetchFailed("TOO_MANY_REDIRECTS", "Too many redirects");
  }

  if (error instanceof Error && error.name === "AbortError") {
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

export async function fetchFeedDocument(
  url: string,
  options?: { ignoreTlsError?: boolean },
): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
      signal: controller.signal,
      headers: FETCH_HEADERS,
    };
    if (options?.ignoreTlsError) {
      init.tls = { rejectUnauthorized: false };
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(assertHttpOrHttpsUrl(url), init, {
      maxRedirects: MAX_REDIRECTS,
    });
    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      return fetchFailed("HTTP_ERROR", `HTTP ${response.status}`, response.status);
    }

    const body = await readResponseBodyWithByteLimit(response, MAX_BYTES);
    if (!body.ok) {
      return fetchFailed("RESPONSE_TOO_LARGE", "Feed response too large");
    }

    return {
      ok: true,
      finalUrl: finalUrl.href,
      body: body.body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return classifyFetchError(error);
  } finally {
    clearTimeout(timer);
  }
}
