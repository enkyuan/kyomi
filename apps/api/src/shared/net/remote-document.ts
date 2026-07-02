import { assertHttpOrHttpsUrl } from "./http-url";
import {
  BlockedOutboundUrlError,
  TooManyRedirectsError,
  fetchWithSafeRedirects,
  readResponseBodyWithByteLimit,
} from "./safe-fetch";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export type RemoteDocumentErrorCode =
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "TLS_CERTIFICATE_FAILED"
  | "HTTP_ERROR"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "BLOCKED_URL";

export type RemoteDocumentFetchResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string; code: RemoteDocumentErrorCode; status?: number };

export type FetchRemoteDocumentOptions = {
  ignoreTlsError?: boolean;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const TLS_CERT_ERROR_PATTERNS = [
  /unable to verify the first certificate/i,
  /unable to get local issuer certificate/i,
  /self[- ]signed certificate/i,
  /certificate has expired/i,
  /cert_.*invalid/i,
] as const;

function failed(
  code: RemoteDocumentErrorCode,
  error: string,
  status?: number,
): Extract<RemoteDocumentFetchResult, { ok: false }> {
  return { ok: false, error, code, status };
}

function classifyRemoteDocumentError(
  error: unknown,
): Extract<RemoteDocumentFetchResult, { ok: false }> {
  if (error instanceof BlockedOutboundUrlError) {
    return failed("BLOCKED_URL", error.message);
  }
  if (error instanceof TooManyRedirectsError) {
    return failed("TOO_MANY_REDIRECTS", "Too many redirects");
  }
  if (error instanceof Error && error.name === "AbortError") {
    return failed("FETCH_TIMEOUT", "Document fetch timed out");
  }
  if (
    error instanceof Error &&
    TLS_CERT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
  ) {
    return failed("TLS_CERTIFICATE_FAILED", error.message);
  }
  const message = error instanceof Error ? error.message : "fetch failed";
  return failed("FETCH_FAILED", message);
}

export async function fetchRemoteDocument(
  url: string,
  options: FetchRemoteDocumentOptions = {},
): Promise<RemoteDocumentFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
      signal: controller.signal,
      headers: options.headers,
    };
    if (options.ignoreTlsError) {
      init.tls = { rejectUnauthorized: false };
    }

    const { response, finalUrl } = await fetchWithSafeRedirects(assertHttpOrHttpsUrl(url), init, {
      maxRedirects: options.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    });

    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      return failed("HTTP_ERROR", `HTTP ${response.status}`, response.status);
    }

    const body = await readResponseBodyWithByteLimit(
      response,
      options.maxBytes ?? DEFAULT_MAX_BYTES,
    );
    if (!body.ok) {
      return failed("RESPONSE_TOO_LARGE", "Document response too large");
    }

    return {
      ok: true,
      finalUrl: finalUrl.href,
      body: body.body,
      contentType: response.headers.get("content-type") ?? "",
    };
  } catch (error) {
    return classifyRemoteDocumentError(error);
  } finally {
    clearTimeout(timer);
  }
}
