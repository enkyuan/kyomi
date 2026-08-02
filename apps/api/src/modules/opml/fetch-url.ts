import { assertHttpOrHttpsUrl } from "@shared/net/http-url";
import {
  TooManyRedirectsError,
  fetchWithSafeRedirects,
  readResponseBodyWithByteLimit,
} from "@shared/net/safe-fetch";
import { BlockedOutboundUrlError } from "@shared/net/outbound-policy";
import { AppError } from "@shared/errors/app";
import { OPML_MAX_SOURCE_BYTES } from "./constants";

const DEFAULT_REMOTE_OPML_FILENAME = "remote.opml";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const FETCH_HEADERS = {
  accept: "application/xml,text/xml,application/rss+xml,*/*;q=0.8",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 (KyomiFeedFetcher/1.0)",
} as const;

type FetchOpmlDocumentResult = {
  xml: string;
  finalUrl: string;
  filename: string;
};

const TLS_CERT_ERROR_PATTERNS = [
  /unable to verify the first certificate/i,
  /unable to get local issuer certificate/i,
  /self[- ]signed certificate/i,
  /certificate has expired/i,
  /cert_.*invalid/i,
] as const;

function filenameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment || !/\.(opml|xml)$/i.test(lastSegment)) {
    return DEFAULT_REMOTE_OPML_FILENAME;
  }

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

function parseOpmlImportUrl(rawUrl: string): URL {
  try {
    return assertHttpOrHttpsUrl(rawUrl, "Only http(s) OPML URLs are supported");
  } catch {
    throw new AppError("Invalid OPML URL", { status: 400, code: "OPML_URL_INVALID" });
  }
}

function classifyFetchError(error: unknown): AppError {
  if (error instanceof BlockedOutboundUrlError) {
    return new AppError("This OPML URL cannot be imported", {
      status: 400,
      code: "OPML_URL_BLOCKED",
    });
  }

  if (error instanceof TooManyRedirectsError) {
    return new AppError("OPML URL redirected too many times", {
      status: 400,
      code: "OPML_URL_TOO_MANY_REDIRECTS",
    });
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AppError("Timed out fetching OPML URL", {
      status: 504,
      code: "OPML_URL_FETCH_TIMEOUT",
    });
  }

  if (
    error instanceof Error &&
    TLS_CERT_ERROR_PATTERNS.some((pattern) => pattern.test(error.message))
  ) {
    return new AppError("Could not verify OPML URL certificate", {
      status: 502,
      code: "OPML_URL_TLS_FAILED",
    });
  }

  return new AppError("Could not fetch OPML URL", {
    status: 502,
    code: "OPML_URL_FETCH_FAILED",
  });
}

export async function fetchOpmlDocumentFromUrl(rawUrl: string): Promise<FetchOpmlDocumentResult> {
  const url = parseOpmlImportUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(
      url,
      { signal: controller.signal, headers: FETCH_HEADERS },
      { maxRedirects: MAX_REDIRECTS },
    );

    if (!response.ok) {
      response.body?.cancel().catch(() => undefined);
      throw new AppError("Could not fetch OPML URL", {
        status: 502,
        code: "OPML_URL_HTTP_ERROR",
        details: { status: response.status },
      });
    }

    const body = await readResponseBodyWithByteLimit(response, OPML_MAX_SOURCE_BYTES);
    if (!body.ok) {
      throw new AppError("OPML payload exceeds maximum size", {
        status: 413,
        code: "OPML_TOO_LARGE",
      });
    }

    return {
      xml: body.body,
      finalUrl: finalUrl.href,
      filename: filenameFromUrl(finalUrl.href),
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw classifyFetchError(error);
  } finally {
    clearTimeout(timer);
  }
}
